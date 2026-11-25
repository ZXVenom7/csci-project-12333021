'use strict';

const express = require('express');
const db = require('../../db/pool');
const { notFound, badRequest } = require('../../lib/errors');
const { parse, vehicleSchema, vehiclePatchSchema } = require('../../lib/validate');
const { uniqueSlug } = require('../../lib/slug');
const { removeStoredImages } = require('../../lib/images');
const { VEHICLE_SELECT, serializeVehicle, listVehicles } = require('../../lib/vehicles');

const router = express.Router();

// API field -> database column.
const COLUMNS = {
  brandId: 'brand_id',
  categoryId: 'category_id',
  model: 'model',
  year: 'year',
  price: 'price',
  previousPrice: 'previous_price',
  mileage: 'mileage',
  transmissionType: 'transmission_type',
  transmission: 'transmission',
  fuelType: 'fuel_type',
  engine: 'engine',
  horsepower: 'horsepower',
  fuelEconomy: 'fuel_economy',
  exteriorColor: 'exterior_color',
  interiorColor: 'interior_color',
  bodyType: 'body_type',
  drivetrain: 'drivetrain',
  vin: 'vin',
  condition: 'condition',
  status: 'status',
  isPublished: 'is_published',
  isFeatured: 'is_featured',
  description: 'description',
};

async function loadVehicle(id, client = db) {
  const { rows } = await client.query(`${VEHICLE_SELECT} WHERE v.id = $1`, [id]);
  if (!rows[0]) throw notFound('Vehicle not found.');
  return rows[0];
}

/** Cross-field rules that the per-field schema cannot express. */
function checkPricing(price, previousPrice) {
  if (previousPrice != null && price == null) {
    throw badRequest('Please check the highlighted fields.', {
      fields: { previousPrice: 'Set a current price before adding a previous price' },
    });
  }
  if (previousPrice != null && previousPrice <= price) {
    throw badRequest('Please check the highlighted fields.', {
      fields: { previousPrice: 'Previous price must be higher than the current price' },
    });
  }
}

async function brandName(client, brandId) {
  const { rows } = await client.query('SELECT name FROM brands WHERE id = $1', [brandId]);
  if (!rows[0]) throw badRequest('Please check the highlighted fields.', { fields: { brandId: 'Choose a brand' } });
  return rows[0].name;
}

async function checkCategory(client, categoryId) {
  if (categoryId == null) return;
  const { rows } = await client.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
  if (!rows[0]) throw badRequest('Please check the highlighted fields.', { fields: { categoryId: 'Choose a category' } });
}

router.get('/', async (req, res) => {
  res.json(await listVehicles(db, req.query, { admin: true, defaultPageSize: 20, maxPageSize: 100 }));
});

router.get('/:id', async (req, res) => {
  res.json(serializeVehicle(await loadVehicle(req.params.id), { admin: true }));
});

router.post('/', async (req, res) => {
  const input = parse(vehicleSchema, req.body);
  checkPricing(input.price, input.previousPrice);

  const id = await db.transaction(async (client) => {
    const brand = await brandName(client, input.brandId);
    await checkCategory(client, input.categoryId);
    const slug = await uniqueSlug(client, 'vehicles', `${input.year} ${brand} ${input.model}`);
    const fields = Object.keys(COLUMNS);
    const { rows } = await client.query(
      `INSERT INTO vehicles (slug, ${fields.map((field) => COLUMNS[field]).join(', ')})
       VALUES ($1, ${fields.map((_, index) => `$${index + 2}`).join(', ')}) RETURNING id`,
      [slug, ...fields.map((field) => input[field])],
    );
    return rows[0].id;
  });
  res.status(201).json(serializeVehicle(await loadVehicle(id), { admin: true }));
});

/** PUT replaces every field; PATCH changes only the fields sent (price, status, featured, ...). */
async function updateVehicle(req, res) {
  const isPatch = req.method === 'PATCH';
  const input = parse(isPatch ? vehiclePatchSchema : vehicleSchema, req.body);
  const fields = Object.keys(COLUMNS).filter((field) => input[field] !== undefined);
  if (!fields.length) throw badRequest('Nothing to update.');

  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM vehicles WHERE id = $1 FOR UPDATE', [req.params.id]);
    const existing = rows[0];
    if (!existing) throw notFound('Vehicle not found.');

    const price = input.price !== undefined ? input.price : existing.price;
    let previousPrice = input.previousPrice !== undefined ? input.previousPrice : existing.previous_price;
    // A quick price change that makes the stored previous price meaningless clears it.
    if (isPatch && input.previousPrice === undefined && previousPrice != null && (price == null || previousPrice <= price)) {
      previousPrice = null;
      input.previousPrice = null;
      if (!fields.includes('previousPrice')) fields.push('previousPrice');
    }
    checkPricing(price, previousPrice);
    if (input.brandId !== undefined) await brandName(client, input.brandId);
    if (input.categoryId !== undefined) await checkCategory(client, input.categoryId);

    await client.query(
      `UPDATE vehicles SET ${fields.map((field, index) => `${COLUMNS[field]} = $${index + 2}`).join(', ')},
              updated_at = now() WHERE id = $1`,
      [req.params.id, ...fields.map((field) => input[field])],
    );
  });
  res.json(serializeVehicle(await loadVehicle(req.params.id), { admin: true }));
}

router.put('/:id', updateVehicle);
router.patch('/:id', updateVehicle);

router.delete('/:id', async (req, res) => {
  const images = await db.transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT storage_key, thumb_key FROM vehicle_images WHERE vehicle_id = $1', [req.params.id]);
    const deleted = await client.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    if (!deleted.rowCount) throw notFound('Vehicle not found.');
    return rows;
  });
  await removeStoredImages(images);
  res.json({ ok: true });
});

module.exports = router;
module.exports.loadVehicle = loadVehicle;
