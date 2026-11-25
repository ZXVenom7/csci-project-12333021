'use strict';

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Returns a slug that is unique in `table`, appending -2, -3, ... if needed.
 * `table` is always a hardcoded identifier supplied by our own code.
 */
async function uniqueSlug(db, table, base, excludeId) {
  const root = slugify(base) || 'item';
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = attempt === 1 ? root : `${root}-${attempt}`;
    const { rows } = await db.query(
      `SELECT 1 FROM ${table} WHERE slug = $1 AND ($2::text IS NULL OR id::text <> $2) LIMIT 1`,
      [candidate, excludeId == null ? null : String(excludeId)],
    );
    if (!rows.length) return candidate;
  }
  throw new Error('Could not generate a unique slug');
}

module.exports = { slugify, uniqueSlug };
