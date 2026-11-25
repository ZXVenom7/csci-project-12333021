'use strict';

const { query } = require('../db/pool');
const { HttpError } = require('./errors');

/**
 * Fixed-window rate limiter backed by Postgres, so limits are shared by every
 * server/serverless instance. Returns Express middleware.
 *
 * @param {object} options
 * @param {string} options.name      Bucket name, e.g. "login".
 * @param {number} options.limit     Max requests per window.
 * @param {number} options.windowSec Window length in seconds.
 * @param {(req) => string} [options.key] Extra discriminator (defaults to client IP).
 */
function rateLimit({ name, limit, windowSec, key }) {
  return async function rateLimitMiddleware(req, res, next) {
    const subject = key ? key(req) : req.ip;
    const bucket = `${name}:${String(subject).slice(0, 200)}`;
    const { rows } = await query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, now() + make_interval(secs => $2))
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= now()
                         THEN now() + make_interval(secs => $2) ELSE rate_limits.reset_at END
       RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM reset_at - now())))::int AS retry_after`,
      [bucket, windowSec],
    );

    // Opportunistic cleanup of expired buckets.
    if (Math.random() < 0.02) {
      query('DELETE FROM rate_limits WHERE reset_at <= now()').catch(() => {});
    }

    if (rows[0].count > limit) {
      res.set('Retry-After', String(rows[0].retry_after));
      throw new HttpError(429, 'Too many requests. Please wait a moment and try again.');
    }
    next();
  };
}

module.exports = { rateLimit };
