/**
 * PostgreSQL migration runner; applied migration names are stored in the DB.
 */

const fs = require('fs');
const path = require('path');
const db = require('./connection');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations({ silent = false } = {}) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await db.query('SELECT id FROM schema_migrations');
  const aplicadas = new Set(rows.map((row) => row.id));
  const archivos = fs.readdirSync(MIGRATIONS_DIR)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();
  let totalAplicadas = 0;

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    if (!silent) console.log(`[migrate] Aplicando ${archivo} ...`);
    await db.exec(sql);
    await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [archivo]);
    totalAplicadas += 1;
  }

  if (!silent) {
    console.log(totalAplicadas
      ? `[migrate] ${totalAplicadas} migración(es) aplicada(s).`
      : '[migrate] Base de datos ya actualizada, nada que aplicar.');
  }
  return totalAplicadas;
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('[migrate] Error al aplicar migraciones:', error);
    process.exitCode = 1;
  });
}
