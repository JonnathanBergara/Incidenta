/**
 * http.test.js — Pruebas de extremo a extremo con servidor Express real
 *
 * Requiere `npm install` (Express). Si Express no está instalado, las pruebas
 * se omiten (skip) en lugar de fallar. Cubre lo que el arnés no puede:
 * parseo real de JSON, límite de tamaño del cuerpo, cabeceras HTTP reales.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas-http-'.padEnd(48, 'x');
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_MAX_ATTEMPTS = '1000';
process.env.SEED_ADMIN_PASSWORD = 'Admin-Prueba-2026';
process.env.SEED_ANALISTA_PASSWORD = 'Analista-Prueba-2026';
process.env.SEED_LECTOR_PASSWORD = 'Lector-Prueba-2026';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let hayExpress = true;
try { require.resolve('express'); } catch { hayExpress = false; }
const opciones = hayExpress ? {} : { skip: 'Express no está instalado (ejecute npm install)' };

let servidor, base;
const token = {};

async function api(metodo, ruta, { tk, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (tk) h.Authorization = `Bearer ${tk}`;
  if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + ruta, { method: metodo, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
  const texto = await r.text();
  let json; try { json = JSON.parse(texto); } catch { json = undefined; }
  return { status: r.status, headers: r.headers, json };
}

before(async () => {
  if (!hayExpress) return;
  await require('../src/db/migrate').runMigrations({ silent: true });
  await require('../src/db/seed').seedIfEmpty({ silent: true });
  await require('../src/db/seed').seedUsuarios({ silent: true });
  const { crearApp } = require('../server');
  servidor = crearApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
  token.admin = (await api('post', '/api/auth/login', { body: { username: 'admin', password: process.env.SEED_ADMIN_PASSWORD } })).json.token;
  token.lector = (await api('post', '/api/auth/login', { body: { username: 'lector', password: process.env.SEED_LECTOR_PASSWORD } })).json.token;
});
after(async () => {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  await require('../src/db/connection').close();
});

test('[HTTP-01] Sin token → 401; con token de lector → 200', opciones, async () => {
  assert.equal((await api('get', '/api/incidentes')).status, 401);
  assert.equal((await api('get', '/api/incidentes', { tk: token.lector })).status, 200);
});

test('[HTTP-06] Health check confirma conexión con PostgreSQL', opciones, async () => {
  const r = await api('get', '/healthz');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { status: 'ok' });
});

test('[HTTP-05] Listado paginado, filtros y parámetros inválidos', opciones, async () => {
  for (let i = 1; i <= 3; i += 1) {
    const creado = await api('post', '/api/incidentes', {
      tk: token.admin,
      body: { title: `HTTP paginación ${i}`, category: 'Otro', priority: 'Baja' }
    });
    assert.equal(creado.status, 201);
  }
  const primera = await api('get', '/api/incidentes?search=HTTP%20paginaci%C3%B3n&page=1&limit=2', { tk: token.lector });
  assert.equal(primera.status, 200);
  assert.equal(primera.json.data.length, 2);
  assert.deepEqual(primera.json.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
  assert.equal(primera.json.estadisticas.total >= 3, true);
  const segunda = await api('get', '/api/incidentes?search=HTTP%20paginaci%C3%B3n&page=2&limit=2', { tk: token.lector });
  assert.equal(segunda.json.data.length, 1);
  assert.notEqual(primera.json.data[0].id, segunda.json.data[0].id);
  assert.equal((await api('get', '/api/incidentes?limit=101', { tk: token.lector })).status, 400);
});

test('[HTTP-02] Lector no puede crear (403); admin sí (201) y elimina (204)', opciones, async () => {
  const datos = { title: 'Prueba HTTP real', category: 'Otro', priority: 'Baja' };
  assert.equal((await api('post', '/api/incidentes', { tk: token.lector, body: datos })).status, 403);
  const c = await api('post', '/api/incidentes', { tk: token.admin, body: datos });
  assert.equal(c.status, 201);
  assert.equal((await api('delete', `/api/incidentes/${c.json.id}`, { tk: token.admin })).status, 204);
});

test('[HTTP-03] JSON mal formado → 400 y cuerpo mayor de 10 KB → 413', opciones, async () => {
  assert.equal((await api('post', '/api/incidentes', { tk: token.admin, raw: '{"title":' })).status, 400);
  assert.equal((await api('post', '/api/incidentes', { tk: token.admin, body: { title: 'x'.repeat(20000) } })).status, 413);
});

test('[HTTP-04] Cabeceras reales: sin X-Powered-By, con CSP y CORS preflight restringido', opciones, async () => {
  const r = await api('get', '/api/incidentes', { tk: token.admin });
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  const bueno = await api('options', '/api/incidentes', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(bueno.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const malo = await api('options', '/api/incidentes', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(malo.status, 403);
});
