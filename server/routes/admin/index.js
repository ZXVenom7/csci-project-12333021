'use strict';

const express = require('express');
const db = require('../../db/pool');
const auth = require('../../lib/auth');
const { notFound } = require('../../lib/errors');
const { getSettings, saveSettings } = require('../../lib/settings');
const { parse, settingsSchema } = require('../../lib/validate');
const { VEHICLE_SELECT, serializeVehicle } = require('../../lib/vehicles');
const { taxonomyRouter } = require('./taxonomy');

const router = express.Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Everything below requires a signed-in administrator.
router.use(auth.requireSameOrigin, auth.requireAuth);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Reject malformed ids before they reach the database.
router.param('id', (req, res, next, value) => {
  if (!UUID.test(value) && !/^\d{1,9}$/.test(value)) throw notFound();
  next();
});
router.param('imageId', (req, res, next, value) => {
  if (!UUID.test(value)) throw notFound();
  next();
});

router.get('/overview', async (req, res) => {
  const [stats, recent, inquiries] = await Promise.all([
    db.query(`SELECT count(*)::int AS total,
                     count(*) FILTER (WHERE status = 'available')::int AS available,
                     count(*) FILTER (WHERE status = 'reserved')::int AS reserved,
                     count(*) FILTER (WHERE status = 'sold')::int AS sold,
                     count(*) FILTER (WHERE NOT is_published)::int AS unpublished,
                     count(*) FILTER (WHERE is_featured)::int AS featured,
                     COALESCE(sum(price) FILTER (WHERE status <> 'sold'), 0) AS inventory_value,
                     COALESCE(sum(price) FILTER (WHERE status = 'sold'), 0) AS sold_value
              FROM vehicles`),
    db.query(`${VEHICLE_SELECT} ORDER BY v.created_at DESC LIMIT 6`),
    db.query("SELECT count(*)::int AS count FROM inquiries WHERE status = 'new'"),
  ]);
  const row = stats.rows[0];
  res.json({
    totalVehicles: row.total,
    available: row.available,
    reserved: row.reserved,
    sold: row.sold,
    unpublished: row.unpublished,
    featured: row.featured,
    // Asking prices of unsold stock (available + reserved).
    inventoryValue: row.inventory_value,
    soldValue: row.sold_value,
    newInquiries: inquiries.rows[0].count,
    recentVehicles: recent.rows.map((vehicle) => serializeVehicle(vehicle, { admin: true })),
  });
});

router.use('/vehicles', require('./vehicles'));
router.use('/', require('./images'));
router.use('/brands', taxonomyRouter('brands', 'brand_id', 'brand', true));
router.use('/categories', taxonomyRouter('categories', 'category_id', 'category', false));
router.use('/inquiries', require('./inquiries'));

router.get('/settings', async (req, res) => {
  res.json(await getSettings());
});

// Owner-only areas: site settings and administrator accounts.
router.put('/settings', auth.requireRole('owner'), async (req, res) => {
  res.json(await saveSettings(parse(settingsSchema, req.body)));
});
router.use('/users', auth.requireRole('owner'), require('./users'));

module.exports = router;
