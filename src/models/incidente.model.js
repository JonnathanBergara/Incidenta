/**
 * Incident persistence model backed by PostgreSQL.
 */

const db = require('../db/connection');
const { escaparLike } = require('../utils/sanitize');

function construirFiltro(filtros = {}) {
  const condiciones = [];
  const valores = [];

  if (filtros.status && filtros.status !== 'all') {
    valores.push(filtros.status);
    condiciones.push(`status = $${valores.length}`);
  }
  if (filtros.priority && filtros.priority !== 'all') {
    valores.push(filtros.priority);
    condiciones.push(`priority = $${valores.length}`);
  }
  if (filtros.search) {
    valores.push(`%${escaparLike(filtros.search)}%`);
    const parametro = `$${valores.length}`;
    condiciones.push(`(title ILIKE ${parametro} ESCAPE E'\\\\' OR category ILIKE ${parametro} ESCAPE E'\\\\')`);
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores
  };
}

async function getAll(filtros = {}) {
  const { where, valores } = construirFiltro(filtros);
  const { rows } = await db.query(
    `SELECT * FROM incidentes ${where} ORDER BY created_at DESC, id DESC`,
    valores
  );
  return rows;
}

async function getPagina(filtros = {}) {
  const { page = 1, limit = 50 } = filtros;
  const { where, valores } = construirFiltro(filtros);
  const totalResult = await db.query(`SELECT COUNT(*) AS total FROM incidentes ${where}`, valores);
  const total = Number(totalResult.rows[0].total);
  const totalPaginas = Math.ceil(total / limit);
  const pagina = Math.min(page, Math.max(totalPaginas, 1));
  const paginaValores = [...valores, limit, (pagina - 1) * limit];
  const { rows: items } = await db.query(`
    SELECT * FROM incidentes ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}
  `, paginaValores);
  const statsResult = await db.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status != 'Resuelto') AS abiertos,
      COUNT(*) FILTER (WHERE priority = 'Alta' AND status != 'Resuelto') AS criticos,
      COUNT(*) FILTER (WHERE status = 'Resuelto') AS resueltos
    FROM incidentes
  `);
  const estadisticas = Object.fromEntries(
    Object.entries(statsResult.rows[0]).map(([key, value]) => [key, Number(value)])
  );

  return {
    data: items,
    pagination: { page: pagina, limit, total, totalPages: totalPaginas },
    estadisticas
  };
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM incidentes WHERE id = $1', [Number(id)]);
  return rows[0] || null;
}

async function create(datos) {
  const { rows } = await db.query(`
    INSERT INTO incidentes (title, category, priority, status, date, email, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    datos.title,
    datos.category,
    datos.priority,
    datos.status || 'Abierto',
    datos.date || new Date().toISOString().slice(0, 10),
    datos.email || null,
    datos.description || null
  ]);
  return rows[0];
}

async function update(id, cambios) {
  const actual = await getById(id);
  if (!actual) return null;

  const fusionado = { ...actual, ...cambios };
  const { rows } = await db.query(`
    UPDATE incidentes
       SET title = $1, category = $2, priority = $3, status = $4,
           date = $5, email = $6, description = $7
     WHERE id = $8
     RETURNING *
  `, [
    fusionado.title,
    fusionado.category,
    fusionado.priority,
    fusionado.status,
    fusionado.date,
    fusionado.email,
    fusionado.description,
    Number(id)
  ]);
  return rows[0] || null;
}

async function remove(id) {
  const result = await db.query('DELETE FROM incidentes WHERE id = $1', [Number(id)]);
  return result.rowCount > 0;
}

module.exports = { getAll, getPagina, getById, create, update, remove };
