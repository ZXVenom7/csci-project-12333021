'use strict';

/** Standalone server entry: `npm run server` (dev) or `npm run start:prod`. */
const { config, assertConfig } = require('./config');
const { createApp } = require('./app');
const { closePool } = require('./db/pool');

try {
  assertConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`Luxury Motor Sport API listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => closePool().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
