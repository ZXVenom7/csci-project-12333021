'use strict';

const { TRANSMISSION_TYPES, FUEL_TYPES, CONDITIONS, STATUSES } = require('./validate');

const VEHICLE_SELECT = `
  SELECT v.*,
         b.name AS brand_name, b.slug AS brand_slug,
         c.name AS category_name, c.slug AS category_slug,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'id', i.id, 'url', i.url, 'thumbUrl', i.thumb_url, 'alt', i.alt,
                    'width', i.width, 'height', i.height, 'isPrimary', i.is_primary,
                    'uploaded', i.storage_key IS NOT NULL)
                    ORDER BY i.is_primary DESC, i.sort_order, i.created_at)
           FROM vehicle_images i WHERE i.vehicle_id = v.id), '[]'::json) AS images
  FROM vehicles v
  JOIN brands b ON b.id = v.brand_id
  LEFT JOIN categories c ON c.id = v.category_id`;

const SORTS = {
  recommended: `CASE v.status WHEN 'available' THEN 0 WHEN 'reserved' THEN 1 ELSE 2 END,
                v.is_featured DESC, v.created_at DESC, v.id`,
  newest: 'v.created_at DESC, v.id',
  oldest: 'v.created_at ASC, v.id',
  price_asc: 'v.price ASC NULLS LAST, v.id',
  price_desc: 'v.price DESC NULLS LAST, v.id',
  year_desc: 'v.year DESC, v.id',
  year_asc: 'v.year ASC, v.id',
  mileage_asc: 'v.mileage ASC NULLS LAST, v.id',
  power_desc: 'v.horsepower DESC NULLS LAST, v.id',
};

function discountFor(price, previousPrice) {
  if (price == null || previousPrice == null || previousPrice <= price) return null;
  const amount = Math.round((previousPrice - price) * 100) / 100;
  return { amount, percent: Math.round((amount / previousPrice) * 100) };
}

function titleFor(row) {
  return `${row.year} ${row.brand_name} ${row.model}`;
}

function serializeVehicle(row, { admin = false } = {}) {
  const images = (row.images || []).map((image) => ({ ...image, alt: image.alt || titleFor(row) }));
  const vehicle = {
    id: row.id,
    slug: row.slug,
    title: titleFor(row),
    brand: { id: row.brand_id, name: row.brand_name, slug: row.brand_slug },
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    model: row.model,
    year: row.year,
    price: row.price,
    previousPrice: discountFor(row.price, row.previous_price) ? row.previous_price : null,
    discount: discountFor(row.price, row.previous_price),
    mileage: row.mileage,
    transmissionType: row.transmission_type,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    engine: row.engine,
    horsepower: row.horsepower,
    fuelEconomy: row.fuel_economy,
    exteriorColor: row.exterior_color,
    interiorColor: row.interior_color,
    bodyType: row.body_type,
    drivetrain: row.drivetrain,
    vin: row.vin,
    condition: row.condition,
    status: row.status,
    isFeatured: row.is_featured,
    description: row.description,
    images,
    primaryImage: images[0] || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (admin) {
    vehicle.isPublished = row.is_published;
    // Admins see the stored value even when it is not a valid discount.
    vehicle.previousPrice = row.previous_price;
  }
  return vehicle;
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneOf(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

/**
 * Translates query-string filters into a parameterised WHERE clause.
 * Unknown or malformed values are ignored rather than rejected, so a stale
 * bookmarked URL still returns results. `admin` unlocks unpublished vehicles.
 */
function buildVehicleFilter(q, { admin = false } = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (!admin) where.push('v.is_published');
  else if (q.published === 'true') where.push('v.is_published');
  else if (q.published === 'false') where.push('NOT v.is_published');

  if (typeof q.q === 'string' && q.q.trim()) {
    const tokens = q.q.trim().slice(0, 100).split(/\s+/).slice(0, 6);
    for (const token of tokens) {
      add(
        `(b.name || ' ' || v.model || ' ' || v.year || ' ' || COALESCE(v.body_type, '') || ' ' ||
          COALESCE(v.exterior_color, '') || ' ' || COALESCE(v.engine, '') || ' ' || COALESCE(v.vin, ''))
          ILIKE ?`,
        `%${token.replace(/[\\%_]/g, '\\$&')}%`,
      );
    }
  }
  if (typeof q.brand === 'string' && q.brand) add('b.slug = ?', q.brand.slice(0, 80));
  if (typeof q.category === 'string' && q.category) add('c.slug = ?', q.category.slice(0, 80));
  if (typeof q.bodyType === 'string' && q.bodyType) add('lower(v.body_type) = lower(?)', q.bodyType.slice(0, 60));
  if (typeof q.model === 'string' && q.model.trim()) {
    add('v.model ILIKE ?', `%${q.model.trim().slice(0, 80).replace(/[\\%_]/g, '\\$&')}%`);
  }
  if (oneOf(q.fuelType, FUEL_TYPES)) add('v.fuel_type = ?', q.fuelType);
  if (oneOf(q.transmission, TRANSMISSION_TYPES)) add('v.transmission_type = ?', q.transmission);
  if (oneOf(q.condition, CONDITIONS)) add('v.condition = ?', q.condition);
  if (oneOf(q.status, STATUSES)) add('v.status = ?', q.status);
  if (q.featured === 'true') where.push('v.is_featured');
  if (toInt(q.minYear) !== null) add('v.year >= ?', toInt(q.minYear));
  if (toInt(q.maxYear) !== null) add('v.year <= ?', toInt(q.maxYear));
  if (toNumber(q.minPrice) !== null) add('v.price >= ?', toNumber(q.minPrice));
  if (toNumber(q.maxPrice) !== null) add('v.price <= ?', toNumber(q.maxPrice));
  if (toInt(q.maxMileage) !== null) add('v.mileage <= ?', toInt(q.maxMileage));

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Paginated vehicle listing shared by the public site and the dashboard. */
async function listVehicles(db, q, { admin = false, defaultPageSize = 12, maxPageSize = 60 } = {}) {
  const { whereSql, params } = buildVehicleFilter(q, { admin });
  const pageSize = Math.min(Math.max(toInt(q.pageSize) || defaultPageSize, 1), maxPageSize);
  const orderBy = SORTS[q.sort] || (admin ? SORTS.newest : SORTS.recommended);

  const countResult = await db.query(
    `SELECT count(*)::int AS total FROM vehicles v
     JOIN brands b ON b.id = v.brand_id LEFT JOIN categories c ON c.id = v.category_id ${whereSql}`,
    params,
  );
  const total = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(toInt(q.page) || 1, 1), totalPages);

  const { rows } = await db.query(
    `${VEHICLE_SELECT} ${whereSql} ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: rows.map((row) => serializeVehicle(row, { admin })), total, page, pageSize, totalPages };
}

module.exports = { VEHICLE_SELECT, SORTS, serializeVehicle, buildVehicleFilter, listVehicles, titleFor, discountFor };
