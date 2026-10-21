/**
 * Pruebas unitarias — compresión gzip y política de caché (servidor http real, sin Express).
 */
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const http = require('http');
const zlib = require('zlib');
const { comprimir, UMBRAL } = require('../../src/middleware/compresion');
const { cabecerasEstaticas } = require('../../src/middleware/estaticos');

const GRANDE = JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: i, title: `Incidente ${i}`, estado: 'Abierto' })));
const PEQUENO = JSON.stringify({ ok: true });

function servidor(respuesta) {
  return http.createServer((req, res) => comprimir(req, res, () => respuesta(req, res)));
}
async function pedir(srv, { aceptar = 'gzip, deflate', metodo = 'GET' } = {}) {
  await new Promise((r) => srv.listen(0, r));
  const puerto = srv.address().port;
  try {
    return await new Promise((resolve, reject) => {
      const headers = aceptar === null ? {} : { 'Accept-Encoding': aceptar };
      http.request({ port: puerto, method: metodo, headers }, (res) => {
        const trozos = []; res.on('data', (c) => trozos.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, cuerpo: Buffer.concat(trozos) }));
      }).on('error', reject).end();
    });
  } finally { srv.close(); }
}
// Igual que Express (res.send / send): cabeceras con setHeader y luego res.end(cuerpo).
const json = (cuerpo, extra = {}) => (req, res) => {
  const cab = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo), ...extra };
  for (const [k, v] of Object.entries(cab)) res.setHeader(k, v);
  res.end(cuerpo);
};

test('comprime con gzip una respuesta JSON grande y el contenido es idéntico', async () => {
  const r = await pedir(servidor(json(GRANDE)));
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.match(r.headers.vary, /Accept-Encoding/i);
  assert.equal(r.headers['content-length'], undefined);
  assert.equal(zlib.gunzipSync(r.cuerpo).toString(), GRANDE);
  assert.ok(r.cuerpo.length < GRANDE.length / 3, 'reduce al menos a un tercio');
});

test(`no comprime respuestas menores de ${UMBRAL} bytes`, async () => {
  const r = await pedir(servidor(json(PEQUENO)));
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.cuerpo.toString(), PEQUENO);
});

test('no comprime si el cliente no acepta gzip', async () => {
  const r = await pedir(servidor(json(GRANDE)), { aceptar: null });
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.cuerpo.toString(), GRANDE);
});

test('no comprime tipos ya comprimidos (imágenes PNG)', async () => {
  const binario = Buffer.alloc(5000, 1);
  const r = await pedir(servidor((req, res) => { res.setHeader('Content-Type', 'image/png'); res.setHeader('Content-Length', binario.length); res.end(binario); }));
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.cuerpo.length, 5000);
});

test('comprime SVG, CSS y JavaScript', async () => {
  for (const tipo of ['image/svg+xml', 'text/css; charset=utf-8', 'text/javascript; charset=utf-8']) {
    const r = await pedir(servidor(json(GRANDE, { 'Content-Type': tipo })));
    assert.equal(r.headers['content-encoding'], 'gzip', tipo);
  }
});

test('un ETag fuerte pasa a débil porque los bytes cambian', async () => {
  const r = await pedir(servidor(json(GRANDE, { ETag: '"abc"' })));
  assert.equal(r.headers.etag, 'W/"abc"');
});

test('304 y HEAD no se comprimen ni rompen la conexión', async () => {
  const r304 = await pedir(servidor((req, res) => { res.writeHead(304, { 'Content-Type': 'application/json' }); res.end(); }));
  assert.equal(r304.status, 304);
  assert.equal(r304.headers['content-encoding'], undefined);
  const rHead = await pedir(servidor(json(GRANDE)), { metodo: 'HEAD' });
  assert.equal(rHead.headers['content-encoding'], undefined);
});

test('respuestas por fragmentos (write + end), como los archivos estáticos', async () => {
  const mitad = Math.floor(GRANDE.length / 2);
  const r = await pedir(servidor((req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.write(GRANDE.slice(0, mitad)); res.write(GRANDE.slice(mitad, mitad + 10)); res.end(GRANDE.slice(mitad + 10));
  }));
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.equal(zlib.gunzipSync(r.cuerpo).toString(), GRANDE);
});

test('política de caché: HTML/CSS/JS se revalidan; imágenes se guardan un día', () => {
  const cab = {}; const res = { setHeader: (k, v) => { cab[k] = v; } };
  for (const f of ['index.html', 'css/styles.css', 'js/main.mjs', 'js/x.js']) { cabecerasEstaticas(res, f); assert.equal(cab['Cache-Control'], 'no-cache', f); }
  for (const f of ['img/favicon.svg', 'a.png', 'b.webp']) { cabecerasEstaticas(res, f); assert.equal(cab['Cache-Control'], 'public, max-age=86400', f); }
});
