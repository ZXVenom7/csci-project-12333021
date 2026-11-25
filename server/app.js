'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { config } = require('./config');
const { HttpError, notFound } = require('./lib/errors');
const seo = require('./seo');

const BUILD_DIR = path.join(__dirname, '..', 'build');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel / a reverse proxy: trust one hop so req.ip and req.protocol are correct.
  app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY, 10) || 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Vehicle photos may live on object storage or (legacy listings) external hosts.
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", ...config.corsOrigins],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: config.isProduction,
  }));

  // The API is same-origin by default. Cross-origin browser access is opt-in
  // via CORS_ORIGINS, and never a wildcard because requests carry credentials.
  if (config.corsOrigins.length) {
    app.use('/api', cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      maxAge: 600,
    }));
  }

  app.use(cookieParser());
  app.use('/api', express.json({ limit: '100kb' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', require('./routes/public'));
  app.use('/api', () => {
    throw notFound('Unknown API endpoint.');
  });

  app.get('/sitemap.xml', seo.sitemap);
  app.get('/robots.txt', seo.robots);
  app.get('/vehicles/:slug', seo.vehiclePage);

  // Locally stored uploads. File names are random and never reused, so they cache forever.
  if (config.storage.driver === 'local') {
    app.use('/uploads', express.static(config.storage.localDir, {
      immutable: true,
      maxAge: '365d',
      index: false,
      dotfiles: 'deny',
      fallthrough: false,
    }));
  }

  // Standalone hosting (VPS, Render, Railway, ...): serve the built frontend too.
  // On Vercel the static build is served by the platform and this never runs.
  if (fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    app.use(express.static(BUILD_DIR, {
      index: false,
      setHeaders(res, filePath) {
        const hashed = filePath.includes(`${path.sep}static${path.sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }));
    app.get('/{*path}', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(BUILD_DIR, 'index.html'));
    });
  }

  // Errors: expected ones carry a safe message; everything else is logged
  // server-side and reported generically so internals never leak.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const wantsJson = req.originalUrl.startsWith('/api');
    let status = 500;
    let message = 'Something went wrong on our side. Please try again.';
    let details;

    if (error instanceof HttpError) {
      ({ status, message, details } = error);
    } else if (error instanceof multer.MulterError) {
      status = 400;
      message = error.code === 'LIMIT_FILE_SIZE'
        ? `Each image must be ${Math.round(config.upload.maxFileBytes / 1024 / 1024)} MB or smaller.`
        : 'Too many files in one upload.';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      message = 'Request is too large.';
    } else if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      status = 400;
      message = 'Malformed request.';
    } else if (error.code === '23505') {
      status = 409;
      message = error.constraint === 'vehicles_vin_key'
        ? 'Another vehicle already uses this VIN.'
        : 'That record already exists.';
    } else if (error.code === '23503') {
      status = 409;
      message = 'This record is still in use and cannot be changed that way.';
    } else if (error.code === '22P02') {
      status = 404;
      message = 'Not found.';
    } else if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      // Errors raised by Express middleware itself (static files, body parser).
      status = error.status;
      message = status === 404 ? 'Not found.' : 'Invalid request.';
    } else {
      console.error(`[error] ${req.method} ${req.originalUrl}:`, error);
    }

    if (wantsJson) return res.status(status).json({ error: { message, ...(details || {}) } });
    res.status(status).type('text/plain').send(message);
  });

  return app;
}

module.exports = { createApp };
