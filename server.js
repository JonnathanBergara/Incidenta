/**
 * server.js — Punto de entrada de la API REST de Incidenta (versión endurecida)
 *
 * Orden de middleware (importa):
 *   logger -> cabeceras de seguridad -> HTTPS -> gzip -> CORS -> límite y parseo de JSON
 *   -> archivos estáticos (con caché) -> rutas (JWT + roles + validación) -> 404 -> errores
 */

const fs = require('fs');
const path = require('path');

// Carga .env si existe (no falla si no hay archivo: las variables pueden venir del entorno).
if (typeof process.loadEnvFile === 'function' && fs.existsSync(path.join(__dirname, '.env'))) {
  process.loadEnvFile(path.join(__dirname, '.env'));
}

const { config, validarConfig } = require('./src/config');

function crearApp() {
  const express = require('express');
  const logger = require('./src/middleware/logger');
  const { cabecerasSeguridad, cors, exigirHttps } = require('./src/middleware/security');
  const { comprimir } = require('./src/middleware/compresion');
  const { cabecerasEstaticas } = require('./src/middleware/estaticos');
  const { notFound, errorHandler } = require('./src/middleware/errorHandler');
  const { montarRutas } = require('./src/routes');
  const db = require('./src/db/connection');

  const app = express();
  app.disable('x-powered-by');                         // no anunciar la tecnología
  app.set('trust proxy', config.proxiesConfiables);    // req.secure / req.ip correctos tras un proxy TLS

  app.use(logger);
  app.use(cabecerasSeguridad);
  app.use(exigirHttps);
  app.use(comprimir);                                  // gzip para JSON, HTML, CSS y JS
  app.use('/api', cors);
  app.use(express.json({ limit: config.limiteCuerpo, strict: true }));
  app.get('/healthz', async (_req, res, next) => {
    try {
      await db.query('SELECT 1');
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  });
  app.use(express.static(path.join(__dirname, 'public'), { setHeaders: cabecerasEstaticas }));

  montarRutas(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function iniciar() {
  validarConfig();                                     // aborta si falta JWT_SECRET
  const { runMigrations } = require('./src/db/migrate');
  const { seedIfEmpty, seedUsuarios } = require('./src/db/seed');
  await runMigrations();
  await seedIfEmpty();
  await seedUsuarios();

  const app = crearApp();
  const alEscuchar = (protocolo) => () => {
    console.log('======================================================');
    console.log(' API REST de Incidenta (Express + PostgreSQL) — protegida con JWT');
    console.log(` URL:  ${protocolo}://localhost:${config.puerto}`);
    console.log(` CORS: ${config.corsOrigenes.length ? config.corsOrigenes.join(', ') : 'solo mismo origen'}`);
    console.log('======================================================');
  };

  if (config.tls.key && config.tls.cert) {
    const https = require('https');
    https.createServer({ key: fs.readFileSync(config.tls.key), cert: fs.readFileSync(config.tls.cert) }, app)
      .listen(config.puerto, alEscuchar('https'));
  } else {
    app.listen(config.puerto, alEscuchar('http'));
    if (config.entorno === 'production') console.warn('[aviso] Sin TLS_KEY_PATH/TLS_CERT_PATH: use un proxy inverso con HTTPS (ver docs/HTTPS.md).');
  }
}

if (require.main === module) {
  iniciar().catch((error) => {
    console.error('[startup] No se pudo iniciar Incidenta:', error);
    process.exitCode = 1;
  });
}

module.exports = { crearApp };
