'use strict';

/**
 * Minimal forward-only migration runner.
 * Applies every .sql file in ./migrations (alphabetical order) that is not yet
 * recorded in schema_migrations. Each file runs in its own transaction.
 */
const fs = require('fs');
const path = require('path');
const { assertConfig } = require('../config');
const { getPool, closePool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate({ log = console.log } = {}) {
  const client = await getPool().connect();
  try {
    // Serialise concurrent runners (e.g. two deploys starting at once).
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
      log(`Applied ${file}`);
      count += 1;
    }
    log(count ? `Done: ${count} migration(s) applied.` : 'Database is up to date.');
    return count;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  (async () => {
    try {
      assertConfig();
      await migrate();
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
  })();
}

module.exports = { migrate };
