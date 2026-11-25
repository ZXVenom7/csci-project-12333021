'use strict';

const express = require('express');
const db = require('../../db/pool');
const { notFound, conflict } = require('../../lib/errors');
const { parse, nameSchema } = require('../../lib/validate');
const { uniqueSlug } = require('../../lib/slug');

/**
 * CRUD router shared by brands and categories.
 * @param {'brands'|'categories'} table  Hardcoded table name.
 * @param {string} foreignKey            Column on vehicles referencing the table.
 * @param {boolean} blockDeleteWhenUsed  Brands are required by vehicles; categories are optional.
 */
function taxonomyRouter(table, foreignKey, label, blockDeleteWhenUsed) {
  const router = express.Router();

  async function assertNameFree(name, excludeId) {
    const { rows } = await db.query(
      `SELECT 1 FROM ${table} WHERE lower(name) = lower($1) AND ($2::int IS NULL OR id <> $2)`,
      [name, excludeId || null],
    );
    if (rows.length) throw conflict(`A ${label} named "${name}" already exists.`);
  }

  router.get('/', async (req, res) => {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.slug,
              (SELECT count(*)::int FROM vehicles v WHERE v.${foreignKey} = t.id) AS "vehicleCount"
       FROM ${table} t ORDER BY t.name`,
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { name } = parse(nameSchema, req.body);
    await assertNameFree(name);
    const slug = await uniqueSlug(db, table, name);
    const { rows } = await db.query(
      `INSERT INTO ${table} (name, slug) VALUES ($1, $2) RETURNING id, name, slug`, [name, slug]);
    res.status(201).json({ ...rows[0], vehicleCount: 0 });
  });

  router.put('/:id', async (req, res) => {
    const { name } = parse(nameSchema, req.body);
    await assertNameFree(name, req.params.id);
    const slug = await uniqueSlug(db, table, name, req.params.id);
    const { rows } = await db.query(
      `UPDATE ${table} SET name = $2, slug = $3 WHERE id = $1 RETURNING id, name, slug`,
      [req.params.id, name, slug],
    );
    if (!rows[0]) throw notFound(`That ${label} no longer exists.`);
    res.json(rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    if (blockDeleteWhenUsed) {
      const { rows } = await db.query(
        `SELECT count(*)::int AS count FROM vehicles WHERE ${foreignKey} = $1`, [req.params.id]);
      if (rows[0].count) {
        throw conflict(`${rows[0].count} vehicle(s) use this ${label}. Reassign or delete them first.`);
      }
    }
    const result = await db.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) throw notFound(`That ${label} no longer exists.`);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { taxonomyRouter };
