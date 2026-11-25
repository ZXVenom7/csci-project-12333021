'use strict';

/**
 * Central configuration. Every secret comes from the environment; nothing
 * sensitive is hardcoded and nothing here is ever bundled into the frontend.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

function list(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  isProduction,
  port: integer(process.env.API_PORT || process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  // Managed Postgres (Supabase, Neon, Vercel Postgres) requires TLS.
  databaseSsl: (process.env.DATABASE_SSL || (isProduction ? 'true' : 'false')) === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  sessionHours: integer(process.env.SESSION_HOURS, 12),
  cookieName: 'lms_session',
  // Public URL of the site, used for sitemap, canonical URLs and social previews.
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  // Extra browser origins allowed to call the API (only needed when the
  // frontend is hosted on a different origin than the API).
  corsOrigins: list(process.env.CORS_ORIGINS),
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
    s3: {
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || 'auto',
      bucket: process.env.S3_BUCKET || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      publicUrl: (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, ''),
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
    },
  },
  upload: {
    // Vercel serverless functions reject request bodies above 4.5 MB, so the
    // dashboard uploads one (client-side downscaled) image per request.
    maxFileBytes: integer(process.env.UPLOAD_MAX_MB, 8) * 1024 * 1024,
    maxImagesPerVehicle: integer(process.env.MAX_IMAGES_PER_VEHICLE, 30),
  },
};

function assertConfig() {
  const problems = [];
  if (!config.databaseUrl) problems.push('DATABASE_URL is not set');
  if (!config.jwtSecret) problems.push('JWT_SECRET is not set');
  else if (config.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (!['local', 's3'].includes(config.storage.driver)) {
    problems.push('STORAGE_DRIVER must be "local" or "s3"');
  }
  if (config.storage.driver === 's3') {
    const { bucket, accessKeyId, secretAccessKey, publicUrl } = config.storage.s3;
    if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
      problems.push('STORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL');
    }
  }
  if (problems.length) {
    throw new Error(`Invalid server configuration:\n - ${problems.join('\n - ')}\nSee .env.example.`);
  }
}

module.exports = { config, assertConfig };
