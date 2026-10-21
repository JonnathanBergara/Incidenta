/**
 * PostgreSQL data access for application users.
 */

const db = require('../db/connection');

const COLUMNAS_PUBLICAS = 'id, username, email, role, activo, created_at';

async function getById(id) {
  const { rows } = await db.query(
    'SELECT id, username, role, activo FROM usuarios WHERE id = $1',
    [Number(id)]
  );
  return rows[0] || null;
}

async function getParaLogin(username) {
  const { rows } = await db.query(
    'SELECT id, username, role, activo, password_hash FROM usuarios WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0] || null;
}

async function create({ username, email, passwordHash, role }) {
  const { rows } = await db.query(`
    INSERT INTO usuarios (username, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING ${COLUMNAS_PUBLICAS}
  `, [username, email || null, passwordHash, role]);
  return rows[0];
}

async function count() {
  const { rows } = await db.query('SELECT COUNT(*) AS total FROM usuarios');
  return Number(rows[0].total);
}

module.exports = { getById, getParaLogin, create, count };
