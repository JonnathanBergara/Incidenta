/**
 * PostgreSQL connection shared by the API and migrations.
 * Tests use PGlite, an in-process PostgreSQL-compatible engine.
 */

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '..', '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

let client;

async function getClient() {
  if (client) return client;

  if (process.env.NODE_ENV === 'test') {
    const { PGlite } = require('@electric-sql/pglite');
    client = new PGlite();
    await client.waitReady;
    return client;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio para conectar PostgreSQL.');
  }

  const { Pool } = require('pg');
  client = new Pool({ connectionString: process.env.DATABASE_URL });
  return client;
}

async function query(text, values) {
  const db = await getClient();
  return values === undefined ? db.query(text) : db.query(text, values);
}

async function exec(text) {
  const db = await getClient();
  return process.env.NODE_ENV === 'test' ? db.exec(text) : db.query(text);
}

async function close() {
  if (!client) return;
  const db = client;
  client = null;
  if (process.env.NODE_ENV === 'test') await db.close();
  else await db.end();
}

module.exports = { query, exec, close };
