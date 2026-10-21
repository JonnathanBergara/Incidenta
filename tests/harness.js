/**
 * harness.js — Arnés de pruebas sin servidor HTTP
 *
 * Ejecuta peticiones simuladas a través de la MISMA cadena que usa la
 * aplicación: cabeceras de seguridad -> CORS -> (JWT -> rol -> validación ->
 * controlador -> modelo -> PostgreSQL) -> 404 -> errorHandler. Las rutas salen de
 * src/routes/definiciones.js, la misma tabla que registra Express.
 *
 * Lo único que no ejercita es el parseo de bytes de express.json() ni el
 * socket; eso lo cubre tests/http.test.js cuando Express está instalado.
 */

const { montajes } = require('../src/routes/definiciones');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');
const { cabecerasSeguridad, cors, exigirHttps } = require('../src/middleware/security');

function patron(ruta) {
  if (ruta === '/') return /^\/?$/;
  return new RegExp('^' + ruta.replace(/:[a-zA-Z]+/g, '([^/]+)') + '/?$');
}

function buscarRuta(metodo, rutaUrl) {
  for (const { prefijo, rutas } of montajes) {
    if (rutaUrl !== prefijo && !rutaUrl.startsWith(prefijo + '/')) continue;
    const resto = rutaUrl.slice(prefijo.length) || '/';
    for (const r of rutas) {
      if (r.metodo !== metodo) continue;
      const m = patron(r.ruta).exec(resto);
      if (m) {
        const nombres = [...r.ruta.matchAll(/:([a-zA-Z]+)/g)].map((x) => x[1]);
        const params = {};
        nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        return { handlers: r.handlers, params };
      }
    }
  }
  return null;
}

function crearRes(resolver) {
  const res = {
    statusCode: 200, headers: {}, cuerpo: undefined, terminado: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.setHeader('content-type', 'application/json'); this.cuerpo = JSON.parse(JSON.stringify(obj)); return this.end(); },
    redirect(c, url) { this.statusCode = c; this.setHeader('location', url); return this.end(); },
    end() { this.terminado = true; resolver({ status: this.statusCode, headers: this.headers, body: this.cuerpo }); return this; },
    on() {}
  };
  return res;
}

function peticion(metodo, url, { token, headers = {}, body, ip = '127.0.0.1', secure = false } = {}) {
  return new Promise((resolver) => {
    const [rutaUrl, qs = ''] = url.split('?');
    const hdrs = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    if (token) hdrs.authorization = `Bearer ${token}`;

    const req = {
      method: metodo.toUpperCase(), originalUrl: url, url, headers: hdrs, ip, secure,
      query: Object.fromEntries(new URLSearchParams(qs)), params: {}, body: undefined
    };
    const res = crearRes(resolver);

    // Equivalente de express.json(): un texto no JSON produce el error 'entity.parse.failed'
    let errorCuerpo = null;
    if (typeof body === 'string') {
      try { req.body = JSON.parse(body); } catch { errorCuerpo = { type: 'entity.parse.failed', status: 400, message: 'Unexpected token' }; }
    } else req.body = body;

    const ruta = buscarRuta(req.method.toLowerCase(), rutaUrl);
    if (ruta) req.params = ruta.params;

    const cadena = [cabecerasSeguridad, exigirHttps];
    if (rutaUrl.startsWith('/api')) cadena.push(cors);
    cadena.push((rq, rs, nx) => nx(errorCuerpo || undefined));
    cadena.push(...(ruta ? ruta.handlers : [notFound]));

    let i = 0;
    const siguiente = (err) => {
      if (res.terminado) return;
      if (err) return errorHandler(err, req, res, () => {});
      const h = cadena[i++];
      if (!h) return notFound(req, res, siguiente);
      try {
        const r = h(req, res, siguiente);
        if (r && typeof r.catch === 'function') r.catch(siguiente);
      } catch (e) { siguiente(e); }
    };
    siguiente();
  });
}

module.exports = { peticion };
