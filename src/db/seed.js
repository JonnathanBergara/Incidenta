/**
 * Idempotent demo data seed. Passwords are always supplied by environment.
 */

const crypto = require('crypto');
const db = require('./connection');
const usuarios = require('../models/usuario.model');
const { hashPasswordSync } = require('../utils/password');

const EJEMPLOS = [
  {
    title: 'Servidor de reportes lento',
    category: 'Infraestructura',
    priority: 'Alta',
    status: 'Abierto',
    date: '2026-09-08',
    email: 'ana.paredes@incidenta.ec',
    description: 'El módulo de reportes mensuales tarda más de un minuto en responder desde ayer por la tarde.'
  },
  {
    title: 'Fallo intermitente de inicio de sesión',
    category: 'Acceso',
    priority: 'Alta',
    status: 'En progreso',
    date: '2026-09-09',
    email: 'jhon@incidenta.ec',
    description: 'Algunos usuarios reciben error 500 al iniciar sesión con credenciales correctas.'
  },
  {
    title: 'Actualización de certificado SSL',
    category: 'Seguridad',
    priority: 'Media',
    status: 'Resuelto',
    date: '2026-09-05',
    email: 'soporte@incidenta.ec',
    description: 'El certificado del portal externo vence en 10 días y debe renovarse.'
  },
  {
    title: 'Error de validación en formulario de contacto',
    category: 'Aplicación',
    priority: 'Baja',
    status: 'Abierto',
    date: '2026-09-10',
    email: 'jhon@incidenta.ec',
    description: 'El formulario acepta correos sin arroba en el sitio público.'
  }
];

async function seedIfEmpty({ silent = false } = {}) {
  const { rows } = await db.query('SELECT COUNT(*) AS total FROM incidentes');
  const total = Number(rows[0].total);
  if (total > 0) {
    if (!silent) console.log(`[seed] La tabla ya tiene ${total} registro(s); no se insertan datos de ejemplo.`);
    return 0;
  }

  for (const incidente of EJEMPLOS) {
    await db.query(`
      INSERT INTO incidentes (title, category, priority, status, date, email, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      incidente.title,
      incidente.category,
      incidente.priority,
      incidente.status,
      incidente.date,
      incidente.email,
      incidente.description
    ]);
  }
  if (!silent) console.log(`[seed] ${EJEMPLOS.length} incidentes de ejemplo insertados.`);
  return EJEMPLOS.length;
}

async function seedUsuarios({ silent = false } = {}) {
  const definiciones = [
    { username: 'admin', role: 'admin', variable: 'SEED_ADMIN_PASSWORD' },
    { username: 'analista', role: 'analista', variable: 'SEED_ANALISTA_PASSWORD' },
    { username: 'lector', role: 'lector', variable: 'SEED_LECTOR_PASSWORD' }
  ];
  let creados = 0;
  for (const definicion of definiciones) {
    if (await usuarios.getParaLogin(definicion.username)) continue;
    const generada = !process.env[definicion.variable];
    const password = process.env[definicion.variable]
      || `${crypto.randomBytes(9).toString('base64url')}7a`;
    await usuarios.create({
      username: definicion.username,
      email: `${definicion.username}@incidenta.ec`,
      passwordHash: hashPasswordSync(password),
      role: definicion.role
    });
    creados += 1;
    if (!silent) {
      console.log(`[seed] Usuario "${definicion.username}" (${definicion.role}) creado`
        + (generada ? ` — contraseña generada: ${password} (anótela ahora)` : ' con contraseña configurada por entorno.'));
    }
  }
  return creados;
}

module.exports = { seedIfEmpty, seedUsuarios };

if (require.main === module) {
  Promise.all([seedIfEmpty(), seedUsuarios()]).catch((error) => {
    console.error('[seed] Error al cargar datos iniciales:', error);
    process.exitCode = 1;
  });
}
