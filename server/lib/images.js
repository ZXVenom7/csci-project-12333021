'use strict';

const crypto = require('crypto');
const sharp = require('sharp');
const { badRequest } = require('./errors');
const { getStorage } = require('./storage');

const FULL_MAX = 1920;
const THUMB_MAX = 640;

/** Detects the real file type from its leading bytes (never trust the name/MIME sent by the browser). */
function sniffImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Validates an uploaded image, re-encodes it (which strips EXIF/GPS metadata
 * and neutralises any payload hidden in the file) into an optimised WebP plus
 * a thumbnail, and stores both. Returns the database fields for the image.
 */
async function processAndStoreImage(vehicleId, buffer) {
  if (!sniffImageType(buffer)) {
    throw badRequest('Unsupported image. Please upload a JPEG, PNG or WebP file.');
  }

  let full;
  let thumb;
  try {
    const base = sharp(buffer, { failOn: 'error', limitInputPixels: 60_000_000 }).rotate();
    full = await base.clone()
      .resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    thumb = await base.clone()
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer();
  } catch {
    throw badRequest('This image could not be read. It may be corrupted or too large.');
  }

  const storage = getStorage();
  const name = crypto.randomUUID();
  const storageKey = `vehicles/${vehicleId}/${name}.webp`;
  const thumbKey = `vehicles/${vehicleId}/${name}-thumb.webp`;
  await storage.put(storageKey, full.data, 'image/webp');
  try {
    await storage.put(thumbKey, thumb, 'image/webp');
  } catch (error) {
    await storage.remove(storageKey).catch(() => {});
    throw error;
  }

  return {
    url: storage.publicUrl(storageKey),
    thumbUrl: storage.publicUrl(thumbKey),
    storageKey,
    thumbKey,
    width: full.info.width,
    height: full.info.height,
  };
}

/** Best-effort removal of stored files; failures are logged, not thrown. */
async function removeStoredImages(images) {
  const storage = getStorage();
  await Promise.all(
    images.flatMap((image) => [image.storage_key, image.thumb_key])
      .filter(Boolean)
      .map((key) => storage.remove(key).catch((error) => {
        console.error(`[storage] could not remove ${key}: ${error.message}`);
      })),
  );
}

module.exports = { sniffImageType, processAndStoreImage, removeStoredImages };
