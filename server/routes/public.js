'use strict';

const express = require('express');
const db = require('../db/pool');
const { notFound, badRequest } = require('../lib/errors');
const { rateLimit } = require('../lib/rateLimit');
const { getSettings } = require('../lib/settings');
const { parse, inquirySchema } = require('../lib/validate');
const { VEHICLE_SELECT, serializeVehicle, listVehicles, titleFor } = require('../lib/vehicles');

const router = express.Router();

router.get('/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
});

/** Dealership info, contact details, currency and editable copy. */
router.get('/site', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(await getSettings());
});

router.get('/vehicles', async (req, res) => {
  res.json(await listVehicles(db, req.query));
});

/** Filter options (with counts) derived from the published inventory. */
router.get('/vehicles/facets', async (req, res) => {
  const [brands, categories, values, ranges] = await Promise.all([
    db.query(`SELECT b.name, b.slug, count(*)::int AS count FROM vehicles v
              JOIN brands b ON b.id = v.brand_id WHERE v.is_published
              GROUP BY b.id ORDER BY b.name`),
    db.query(`SELECT c.name, c.slug, count(*)::int AS count FROM vehicles v
              JOIN categories c ON c.id = v.category_id WHERE v.is_published
              GROUP BY c.id ORDER BY c.name`),
    db.query(`SELECT
                array_remove(array_agg(DISTINCT fuel_type), NULL) AS fuel_types,
                array_remove(array_agg(DISTINCT transmission_type), NULL) AS transmissions,
                array_remove(array_agg(DISTINCT body_type), NULL) AS body_types
              FROM vehicles WHERE is_published`),
    db.query(`SELECT min(year) AS min_year, max(year) AS max_year,
                     min(price) AS min_price, max(price) AS max_price, max(mileage) AS max_mileage
              FROM vehicles WHERE is_published`),
  ]);
  const range = ranges.rows[0];
  res.json({
    brands: brands.rows,
    categories: categories.rows,
    fuelTypes: values.rows[0].fuel_types || [],
    transmissions: values.rows[0].transmissions || [],
    bodyTypes: (values.rows[0].body_types || []).sort(),
    year: { min: range.min_year, max: range.max_year },
    price: { min: range.min_price, max: range.max_price },
    maxMileage: range.max_mileage,
  });
});

router.get('/vehicles/:slug', async (req, res) => {
  const { rows } = await db.query(`${VEHICLE_SELECT} WHERE v.slug = $1 AND v.is_published`, [req.params.slug]);
  if (!rows[0]) throw notFound('This vehicle is no longer listed.');
  res.json(serializeVehicle(rows[0]));
});

router.get('/brands', async (req, res) => {
  const { rows } = await db.query('SELECT id, name, slug FROM brands ORDER BY name');
  res.json(rows);
});

router.get('/categories', async (req, res) => {
  const { rows } = await db.query('SELECT id, name, slug FROM categories ORDER BY name');
  res.json(rows);
});

/** Contact form, appointment / test-drive requests and availability inquiries. */
router.post(
  '/inquiries',
  rateLimit({ name: 'inquiry', limit: 5, windowSec: 10 * 60 }),
  rateLimit({ name: 'inquiry-day', limit: 30, windowSec: 24 * 60 * 60 }),
  async (req, res) => {
    const input = parse(inquirySchema, req.body);

    // Bots that fill the hidden field get a normal-looking response; nothing is stored.
    if (input.website) return res.status(201).json({ ok: true });

    if (['appointment', 'test_drive'].includes(input.type) && !input.preferredDate) {
      throw badRequest('Please check the highlighted fields.', { fields: { preferredDate: 'Choose a preferred date' } });
    }
    if (input.preferredDate && input.preferredDate < new Date(Date.now() - 864e5).toISOString().slice(0, 10)) {
      throw badRequest('Please check the highlighted fields.', { fields: { preferredDate: 'Choose a date in the future' } });
    }

    let vehicleTitle = null;
    if (input.vehicleId) {
      const { rows } = await db.query(
        `SELECT v.year, v.model, v.status, b.name AS brand_name FROM vehicles v
         JOIN brands b ON b.id = v.brand_id WHERE v.id = $1 AND v.is_published`,
        [input.vehicleId],
      );
      if (!rows[0]) throw badRequest('This vehicle is no longer listed.');
      if (rows[0].status === 'sold' && input.type !== 'general') {
        throw badRequest('This vehicle has been sold and can no longer be booked.');
      }
      vehicleTitle = titleFor(rows[0]);
    }

    await db.query(
      `INSERT INTO inquiries (type, vehicle_id, vehicle_title, name, email, phone, message, preferred_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [input.type, input.vehicleId, vehicleTitle, input.name, input.email, input.phone, input.message,
        input.preferredDate],
    );
    res.status(201).json({ ok: true });
  },
);

module.exports = router;
