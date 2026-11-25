'use strict';

const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const db = require('../../db/pool');
const { config } = require('../../config');
const { notFound, badRequest } = require('../../lib/errors');
const { parse } = require('../../lib/validate');
const { processAndStoreImage, removeStoredImages } = require('../../lib/images');
const { serializeVehicle } = require('../../lib/vehicles');
const { loadVehicle } = require('./vehicles');

const router = express.Router();

const MAX_FILES_PER_REQUEST = 10;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileBytes, files: MAX_FILES_PER_REQUEST, fields: 5 },
  fileFilter(req, file, callback) {
    // First gate only; the real check is on the file's bytes after upload.
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const urlSchema = z.object({
  url: z.url({ protocol: /^https$/, error: 'Enter a full https:// image address' }).max(2000),
});
const imagePatchSchema = z.object({
  isPrimary: z.literal(true).optional(),
  alt: z.string().trim().max(200).optional(),
});
const orderSchema = z.object({ imageIds: z.array(z.uuid()).min(1).max(200) });

async function respondWithVehicle(res, vehicleId, status = 200) {
  res.status(status).json(serializeVehicle(await loadVehicle(vehicleId), { admin: true }));
}

async function insertImage(client, vehicleId, image) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS count, COALESCE(max(sort_order), -1) AS last,
            COALESCE(bool_or(is_primary), false) AS has_primary
     FROM vehicle_images WHERE vehicle_id = $1`,
    [vehicleId],
  );
  if (rows[0].count >= config.upload.maxImagesPerVehicle) {
    throw badRequest(`A vehicle can have at most ${config.upload.maxImagesPerVehicle} images.`);
  }
  await client.query(
    `INSERT INTO vehicle_images
       (vehicle_id, url, thumb_url, storage_key, thumb_key, width, height, is_primary, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [vehicleId, image.url, image.thumbUrl, image.storageKey || null, image.thumbKey || null,
      image.width || null, image.height || null, !rows[0].has_primary, rows[0].last + 1],
  );
}

/** Upload one or more images (multipart field "images"). */
router.post('/vehicles/:id/images', upload.array('images', MAX_FILES_PER_REQUEST), async (req, res) => {
  await loadVehicle(req.params.id);
  if (!req.files || !req.files.length) {
    throw badRequest('Choose at least one JPEG, PNG or WebP image.');
  }
  for (const file of req.files) {
    const stored = await processAndStoreImage(req.params.id, file.buffer);
    try {
      await db.transaction(async (client) => {
        // Serialise concurrent uploads for the same vehicle (ordering, primary flag, image cap).
        await client.query('SELECT 1 FROM vehicles WHERE id = $1 FOR UPDATE', [req.params.id]);
        await insertImage(client, req.params.id, stored);
      });
    } catch (error) {
      await removeStoredImages([{ storage_key: stored.storageKey, thumb_key: stored.thumbKey }]);
      throw error;
    }
  }
  await respondWithVehicle(res, req.params.id, 201);
});

/** Reference an image hosted elsewhere (https only); nothing is downloaded. */
router.post('/vehicles/:id/images/url', async (req, res) => {
  await loadVehicle(req.params.id);
  const { url } = parse(urlSchema, req.body);
  await db.transaction(async (client) => {
    await client.query('SELECT 1 FROM vehicles WHERE id = $1 FOR UPDATE', [req.params.id]);
    await insertImage(client, req.params.id, { url, thumbUrl: url });
  });
  await respondWithVehicle(res, req.params.id, 201);
});

/** Persist a new image order. */
router.put('/vehicles/:id/images/order', async (req, res) => {
  const { imageIds } = parse(orderSchema, req.body);
  await db.transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id FROM vehicle_images WHERE vehicle_id = $1 FOR UPDATE', [req.params.id]);
    const existing = new Set(rows.map((row) => row.id));
    if (existing.size !== imageIds.length || !imageIds.every((id) => existing.has(id))) {
      throw badRequest('The image list is out of date. Reload and try again.');
    }
    await client.query(
      `UPDATE vehicle_images i SET sort_order = o.position::int
       FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position) WHERE i.id = o.id`,
      [imageIds],
    );
  });
  await respondWithVehicle(res, req.params.id);
});

/** Set the primary image and/or edit alt text. */
router.patch('/images/:imageId', async (req, res) => {
  const input = parse(imagePatchSchema, req.body);
  const vehicleId = await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT vehicle_id FROM vehicle_images WHERE id = $1', [req.params.imageId]);
    if (!rows[0]) throw notFound('Image not found.');
    if (input.isPrimary) {
      await client.query('UPDATE vehicle_images SET is_primary = false WHERE vehicle_id = $1 AND is_primary',
        [rows[0].vehicle_id]);
      await client.query('UPDATE vehicle_images SET is_primary = true WHERE id = $1', [req.params.imageId]);
    }
    if (input.alt !== undefined) {
      await client.query('UPDATE vehicle_images SET alt = $2 WHERE id = $1', [req.params.imageId, input.alt]);
    }
    return rows[0].vehicle_id;
  });
  await respondWithVehicle(res, vehicleId);
});

router.delete('/images/:imageId', async (req, res) => {
  const image = await db.transaction(async (client) => {
    const { rows } = await client.query('DELETE FROM vehicle_images WHERE id = $1 RETURNING *', [req.params.imageId]);
    if (!rows[0]) throw notFound('Image not found.');
    if (rows[0].is_primary) {
      // Promote the next image so the vehicle keeps a cover photo.
      await client.query(
        `UPDATE vehicle_images SET is_primary = true WHERE id = (
           SELECT id FROM vehicle_images WHERE vehicle_id = $1 ORDER BY sort_order, created_at LIMIT 1)`,
        [rows[0].vehicle_id],
      );
    }
    return rows[0];
  });
  await removeStoredImages([image]);
  await respondWithVehicle(res, image.vehicle_id);
});

module.exports = router;
