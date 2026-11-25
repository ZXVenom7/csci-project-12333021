'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { query } = require('../db/pool');
const { unauthorized, forbidden } = require('./errors');

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash || DUMMY_HASH);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: process.env.COOKIE_SAMESITE || 'strict',
    path: '/',
    maxAge: config.sessionHours * 60 * 60 * 1000,
  };
}

function startSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionHours}h`,
  });
  res.cookie(config.cookieName, token, cookieOptions());
}

function endSession(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie(config.cookieName, options);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

/**
 * Requires a valid session. The user is re-read from the database on every
 * request so deactivation, role changes and password changes apply at once.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[config.cookieName];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    endSession(res);
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  req.user = user;
  next();
}

/** Role gate; use after requireAuth. */
function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/**
 * CSRF defence for cookie-authenticated mutations: the session cookie is
 * SameSite, and in addition state-changing requests must carry a custom
 * header (which cross-site forms cannot set) and, when the browser sends an
 * Origin, it must be this site or an explicitly allowed origin.
 */
function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') throw forbidden('Invalid request.');
  const origin = req.get('Origin');
  if (origin) {
    const allowed = new Set(config.corsOrigins);
    if (config.siteUrl) allowed.add(config.siteUrl);
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw forbidden('Invalid request.');
    }
    if (originHost !== req.get('Host') && !allowed.has(origin)) throw forbidden('Invalid request.');
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  startSession,
  endSession,
  publicUser,
  requireAuth,
  requireRole,
  requireSameOrigin,
};
