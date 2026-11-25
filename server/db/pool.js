'use strict';

const { Pool, types } = require('pg');
const { config } = require('../config');

// NUMERIC (prices) arrives as a string by default; the values used here fit
// comfortably in a double, so expose them as numbers.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
// DATE stays a plain YYYY-MM-DD string (no timezone shifting).
types.setTypeParser(1082, (value) => value);

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      // Serverless instances each hold their own pool; keep it small so a
      // burst of instances cannot exhaust the database connection limit.
      max: Number.parseInt(process.env.DATABASE_POOL_MAX, 10) || 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (error) => {
      console.error('[db] idle client error:', error.message);
    });
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

/** Runs `work(client)` inside a transaction, rolling back on any error. */
async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { query, transaction, getPool, closePool };
