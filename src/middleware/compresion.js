/**
 * compresion.js — Compresión gzip de respuestas de texto (sin dependencias)
 *
 * Comprime JSON, HTML, CSS, JS y SVG cuando el cliente envía
 * Accept-Encoding: gzip y la respuesta pesa al menos UMBRAL bytes.
 * Funciona sobre res.write/res.end, así que sirve igual con express.json(),
 * express.static() o res.json().
 */

const zlib = require('zlib');

const UMBRAL = 1024;
const COMPRIMIBLE = /^(text\/|application\/(json|javascript)|image\/svg\+xml)/i;

function agregarVary(res, valor) {
  const actual = String(res.getHeader('Vary') || '');
  if (!actual.toLowerCase().split(/\s*,\s*/).includes(valor.toLowerCase())) {
    res.setHeader('Vary', actual ? `${actual}, ${valor}` : valor);
  }
}

function comprimir(req, res, next) {
  if (req.method === 'HEAD' || !/\bgzip\b/i.test(req.headers['accept-encoding'] || '')) return next();

  const escribir = res.write;
  const terminar = res.end;
  let decidido = false;
  let gz = null;

  function decidir(primerFragmento, esUnico) {
    decidido = true;
    const tipo = String(res.getHeader('Content-Type') || '');
    if (!COMPRIMIBLE.test(tipo)) return;
    agregarVary(res, 'Accept-Encoding');
    if (res.getHeader('Content-Encoding') || [204, 304].includes(res.statusCode)) return;
    const declarado = Number(res.getHeader('Content-Length'));
    const tamano = Number.isFinite(declarado) && declarado > 0 ? declarado : (esUnico && primerFragmento ? Buffer.byteLength(primerFragmento) : Infinity);
    if (tamano < UMBRAL) return;

    res.setHeader('Content-Encoding', 'gzip');
    res.removeHeader('Content-Length');
    const etag = res.getHeader('ETag');
    if (etag && !String(etag).startsWith('W/')) res.setHeader('ETag', `W/${etag}`);   // el cuerpo cambia de bytes
    gz = zlib.createGzip();
    gz.on('data', (trozo) => escribir.call(res, trozo));
    gz.on('end', () => terminar.call(res));
  }

  res.write = function write(chunk, codificacion, cb) {
    if (!decidido) decidir(chunk, false);
    return gz ? gz.write(chunk, codificacion, cb) : escribir.call(res, chunk, codificacion, cb);
  };

  res.end = function end(chunk, codificacion, cb) {
    if (typeof chunk === 'function') { cb = chunk; chunk = null; }
    if (!decidido) decidir(chunk, true);
    if (!gz) return terminar.call(res, chunk, codificacion, cb);
    if (chunk) gz.write(chunk, codificacion);
    if (typeof cb === 'function') res.once('finish', cb);
    gz.end();
    return res;
  };
  next();
}

module.exports = { comprimir, UMBRAL };
