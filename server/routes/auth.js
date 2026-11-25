'use strict';

const express = require('express');
const db = require('../db/pool');
const { unauthorized, badRequest } = require('../lib/errors');
const { rateLimit } = require('../lib/rateLimit');
const auth = require('../lib/auth');
const { parse, loginSchema, changePasswordSchema } = require('../lib/validate');

const router = express.Router();

router.use(auth.requireSameOrigin);

router.post(
  '/login',
  rateLimit({ name: 'login-ip', limit: 20, windowSec: 15 * 60 }),
  rateLimit({
    name: 'login-account',
    limit: 8,
    windowSec: 15 * 60,
    key: (req) => String((req.body && req.body.email) || '').trim().toLowerCase(),
  }),
  async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const { rows } = await db.query('SELECT * FROM users WHERE lower(email) = $1', [email]);
    const user = rows[0];
    const passwordOk = await auth.verifyPassword(password, user && user.password_hash);
    // One message for every failure mode, so accounts cannot be enumerated.
    if (!user || !passwordOk || !user.is_active) throw unauthorized('Incorrect email or password.');

    await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    auth.startSession(res, user);
    res.json({ user: auth.publicUser(user) });
  },
);

router.post('/logout', (req, res) => {
  auth.endSession(res);
  res.json({ ok: true });
});

router.get('/me', auth.requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: auth.publicUser(req.user) });
});

router.post(
  '/change-password',
  auth.requireAuth,
  rateLimit({ name: 'change-password', limit: 10, windowSec: 15 * 60 }),
  async (req, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    if (!(await auth.verifyPassword(currentPassword, req.user.password_hash))) {
      throw badRequest('Please check the highlighted fields.', {
        fields: { currentPassword: 'Current password is incorrect' },
      });
    }
    if (currentPassword === newPassword) {
      throw badRequest('Please check the highlighted fields.', {
        fields: { newPassword: 'Choose a password different from the current one' },
      });
    }
    // Bumping token_version signs out every other session for this account.
    const { rows } = await db.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [await auth.hashPassword(newPassword), req.user.id],
    );
    auth.startSession(res, rows[0]);
    res.json({ ok: true });
  },
);

module.exports = router;
