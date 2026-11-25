'use strict';

const express = require('express');
const db = require('../../db/pool');
const { notFound, badRequest, conflict } = require('../../lib/errors');
const auth = require('../../lib/auth');
const { parse, userCreateSchema, userPatchSchema } = require('../../lib/validate');

const router = express.Router();

/** The dashboard must always keep at least one active owner. */
async function assertAnotherOwner(client, userId) {
  const { rows } = await client.query(
    "SELECT count(*)::int AS count FROM users WHERE role = 'owner' AND is_active AND id <> $1", [userId]);
  if (!rows[0].count) throw conflict('There must be at least one active owner account.');
}

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users ORDER BY created_at');
  res.json(rows.map(auth.publicUser));
});

router.post('/', async (req, res) => {
  const input = parse(userCreateSchema, req.body);
  const existing = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
  if (existing.rows.length) throw conflict('An account with this email already exists.');
  const { rows } = await db.query(
    'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
    [input.email, input.name, input.role, await auth.hashPassword(input.password)],
  );
  res.status(201).json(auth.publicUser(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const input = parse(userPatchSchema, req.body);
  const isSelf = req.params.id === req.user.id;
  if (isSelf && (input.isActive === false || (input.role && input.role !== 'owner'))) {
    throw badRequest('You cannot deactivate or demote your own account.');
  }
  if (isSelf && input.password) throw badRequest('Use "Change password" to update your own password.');
  const passwordHash = input.password ? await auth.hashPassword(input.password) : null;

  const user = await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('Account not found.');
    const losesOwner = rows[0].role === 'owner' && rows[0].is_active
      && (input.isActive === false || (input.role && input.role !== 'owner'));
    if (losesOwner) await assertAnotherOwner(client, req.params.id);
    // Any change to access or credentials signs the account out everywhere.
    const revoke = Boolean(passwordHash) || input.isActive === false || (input.role && input.role !== rows[0].role);
    const updated = await client.query(
      `UPDATE users SET name = COALESCE($2, name), role = COALESCE($3, role),
              is_active = COALESCE($4, is_active), password_hash = COALESCE($5, password_hash),
              token_version = token_version + $6, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, input.name ?? null, input.role ?? null, input.isActive ?? null, passwordHash, revoke ? 1 : 0],
    );
    return updated.rows[0];
  });
  res.json(auth.publicUser(user));
});

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) throw badRequest('You cannot delete your own account.');
  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('Account not found.');
    if (rows[0].role === 'owner' && rows[0].is_active) await assertAnotherOwner(client, req.params.id);
    await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  });
  res.json({ ok: true });
});

module.exports = router;
