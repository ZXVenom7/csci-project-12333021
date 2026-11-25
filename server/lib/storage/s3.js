'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * S3-compatible object storage: Supabase Storage (S3 endpoint), Cloudflare R2,
 * AWS S3, MinIO, ... Objects are served from S3_PUBLIC_URL (a public bucket
 * URL or CDN in front of it).
 */
function createS3Storage(options) {
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
  });
  return {
    driver: 's3',
    async put(key, buffer, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Keys are unique per upload, so objects can be cached forever.
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }));
    },
    publicUrl(key) {
      return `${options.publicUrl}/${key}`;
    },
  };
}

module.exports = { createS3Storage };
