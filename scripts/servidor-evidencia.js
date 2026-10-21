/**
 * servidor-evidencia.js — Levanta Incidenta para capturas con navegador real.
 *
 *  - Si Express está instalado (npm install) usa server.js tal cual.
 *  - Si no, monta LA MISMA tabla de rutas y los MISMOS middleware sobre node:http
 *    (adaptador mínimo: query, params, JSON con límite de 10 KB, res.status/json).
 *    Sirve para generar evidencias en equipos sin red; no sustituye a Express.
 *
 * Las contraseñas y el secreto son solo de demostración, con base en memoria.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = path.join(__dirname, '..');

function prepararEntorno() {
  const e = process.env;
  e.NODE_ENV = 'test';
  e.JWT_SECRET = e.JWT_SECRET || require('crypto').randomBytes(48).toString('hex');
  e.SEED_ADMIN_PASSWORD = e.SEED_ADMIN_PASSWORD || 'Admin-Demo-2026';
  e.SEED_ANALISTA_PASSWORD = e.SEED_ANALISTA_PASSWORD || 'Analista-Demo-2026';
  e.SEED_LECTOR_PASSWORD = e.SEED_LECTOR_PASSWORD || 'Lector-Demo-2026';
  e.LOGIN_MAX_ATTEMPTS = e.LOGIN_MAX_ATTEMPTS || '1000';
}

const TIPOS = { '.mjs': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function crearAppSinExpress() {
  const logger = require('../src/middleware/logger');
  const { cabecerasSeguridad, cors, exigirHttps } = require('../src/middleware/security');
  const { notFound, errorHandler } = require('../src/middleware/errorHandler');
  const { montajes } = require('../src/routes/definiciones');
  const opcional = (ruta) => { try { return require(ruta); } catch { return null; } };
  const comprimir = (opcional('../src/middleware/compresion') || {}).comprimir;
  const cabecerasEstaticas = (opcional('../src/middleware/estaticos') || {}).cabecerasEstaticas;

  const compilar = (ruta) => new RegExp('^' + ruta.replace(/:[a-zA-Z]+/g, '([^/]+)') + '/?$');
  const tabla = [];
  for (const { prefijo, rutas } of montajes) {
    for (const r of rutas) {
      const sub = r.ruta === '/' ? '' : r.ruta;
      tabla.push({ metodo: r.metodo.toUpperCase(), re: compilar(prefijo + sub), nombres: [...(prefijo + sub).matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]), handlers: r.handlers });
    }
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    req.originalUrl = req.url;
    req.query = Object.fromEntries(url.searchParams);
    req.params = {};
    req.secure = false;
    req.ip = req.socket.remoteAddress;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
    res.redirect = (c, u) => { res.statusCode = c; res.setHeader('Location', u); res.end(); return res; };

    const trozos = [];
    let tam = 0; let excedido = false;
    req.on('data', (c) => { tam += c.length; if (tam > 10 * 1024) excedido = true; else trozos.push(c); });
    req.on('end', () => {
      let errCuerpo;
      if (excedido) errCuerpo = { type: 'entity.too.large', status: 413, message: 'too large' };
      else if (trozos.length) {
        try { req.body = JSON.parse(Buffer.concat(trozos).toString('utf8')); }
        catch { errCuerpo = { type: 'entity.parse.failed', status: 400, message: 'parse' }; }
      }

      const ruta = tabla.find((t) => t.metodo === req.method && t.re.test(url.pathname));
      if (ruta) {
        const m = ruta.re.exec(url.pathname);
        ruta.nombres.forEach((n, i) => { req.params[n] = decodeURIComponent(m[i + 1]); });
      }

      const cadena = [logger, cabecerasSeguridad, exigirHttps];
      if (comprimir) cadena.push(comprimir);
      if (url.pathname.startsWith('/api')) cadena.push(cors);
      cadena.push((rq, rs, nx) => nx(errCuerpo));
      if (ruta) cadena.push(...ruta.handlers);
      else if (!url.pathname.startsWith('/api')) cadena.push(estaticos);
      else cadena.push(notFound);

      let i = 0;
      const siguiente = (err) => {
        if (err) return errorHandler(err, req, res, () => {});
        const h = cadena[i++];
        if (!h) return notFound(req, res, siguiente);
        try { const r = h(req, res, siguiente); if (r && r.catch) r.catch(siguiente); } catch (e) { siguiente(e); }
      };
      siguiente();
    });
  });

  function estaticos(req, res, next) {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = path.normalize(path.join(RAIZ, 'public', p));
    if (!f.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return next();
    // Comportamiento equivalente al de express.static: ETag débil, Last-Modified y 304.
    const st = fs.statSync(f);
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    res.setHeader('Content-Type', TIPOS[path.extname(f)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', st.mtime.toUTCString());
    if (cabecerasEstaticas) cabecerasEstaticas(res, f);
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
    const cuerpo = fs.readFileSync(f);
    res.setHeader('Content-Length', cuerpo.length);
    res.end(cuerpo);
  }
}

async function iniciar({ puerto = 0 } = {}) {
  prepararEntorno();
  require('../src/config').validarConfig();
  await require('../src/db/migrate').runMigrations({ silent: true });
  await require('../src/db/seed').seedIfEmpty({ silent: true });
  await require('../src/db/seed').seedUsuarios({ silent: true });

  let servidor; let motor;
  try {
    require.resolve('express');
    servidor = require('../server').crearApp().listen(puerto);
    motor = 'Express';
  } catch {
    servidor = crearAppSinExpress().listen(puerto, '127.0.0.1');
    motor = 'adaptador node:http (Express no instalado)';
  }
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { servidor, base, motor };
}

module.exports = { iniciar };

if (require.main === module) {
  iniciar({ puerto: Number(process.env.PORT) || 3000 }).then(({ base, motor }) => console.log(`Incidenta en ${base} — motor: ${motor}`));
}
