'use strict';

/**
 * Vercel serverless entry point. vercel.json rewrites /api/*, /vehicles/*,
 * /sitemap.xml and /robots.txt here; the Express app handles the routing.
 */
const { assertConfig } = require('../server/config');
const { createApp } = require('../server/app');

assertConfig();

module.exports = createApp();
