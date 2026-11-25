'use strict';

const express = require('express');
const db = require('../../db/pool');
const { notFound, badRequest } = require('../../lib/errors');
const { parse, inquiryPatchSchema, INQUIRY_STATUSES, INQUIRY_TYPES } = require('../../lib/validate');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    vehicleId: row.vehicle_id,
    vehicleTitle: row.vehicle_title,
    vehicleSlug: row.vehicle_slug || null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    preferredDate: row.preferred_date,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  if (INQUIRY_STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`i.status = $${params.length}`);
  }
  if (INQUIRY_TYPES.includes(req.query.type)) {
    params.push(req.query.type);
    where.push(`i.type = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = 25;
  const total = (await db.query(`SELECT count(*)::int AS total FROM inquiries i ${whereSql}`, params)).rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), totalPages);
  const { rows } = await db.query(
    `SELECT i.*, v.slug AS vehicle_slug FROM inquiries i LEFT JOIN vehicles v ON v.id = i.vehicle_id
     ${whereSql} ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  res.json({ items: rows.map(serialize), total, page, pageSize, totalPages });
});

router.patch('/:id', async (req, res) => {
  const input = parse(inquiryPatchSchema, req.body);
  if (input.status === undefined && input.adminNotes === undefined) throw badRequest('Nothing to update.');
  const { rows } = await db.query(
    `UPDATE inquiries SET status = COALESCE($2, status), admin_notes = COALESCE($3, admin_notes),
            updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, input.status ?? null, input.adminNotes ?? null],
  );
  if (!rows[0]) throw notFound('Inquiry not found.');
  res.json(serialize(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const result = await db.query('DELETE FROM inquiries WHERE id = $1', [req.params.id]);
  if (!result.rowCount) throw notFound('Inquiry not found.');
  res.json({ ok: true });
});

module.exports = router;
