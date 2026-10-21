/**
 * seguridad.test.js — Casos de prueba de seguridad y CRUD (node:test)
 * Base de datos en memoria; contraseñas y secreto fijados solo para pruebas.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas-'.padEnd(48, 'x');
process.env.JWT_EXPIRES_IN = '3600';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_MAX_ATTEMPTS = '1000';
process.env.SEED_ADMIN_PASSWORD = 'Admin-Prueba-2026';
process.env.SEED_ANALISTA_PASSWORD = 'Analista-Prueba-2026';
process.env.SEED_LECTOR_PASSWORD = 'Lector-Prueba-2026';

const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { runMigrations } = require('../src/db/migrate');
const { seedIfEmpty, seedUsuarios } = require('../src/db/seed');
const db = require('../src/db/connection');
const { peticion } = require('./harness');
const { sign, verify } = require('../src/utils/jwt');
const { hashPassword, verificarPassword } = require('../src/utils/password');
const { crearLimitador } = require('../src/middleware/rateLimit');
const { errorHandler } = require('../src/middleware/errorHandler');
const { config } = require('../src/config');

const tokens = {};
const valido = { title: 'Caída del servicio de correo', category: 'Infraestructura', priority: 'Alta', email: 'ana@incidenta.ec', description: 'No se envían correos desde las 08:00.' };

async function login(username, password) {
  return peticion('post', '/api/auth/login', { body: { username, password } });
}

before(async () => {
  await runMigrations({ silent: true });
  await seedIfEmpty({ silent: true });
  await seedUsuarios({ silent: true });
  tokens.admin = (await login('admin', process.env.SEED_ADMIN_PASSWORD)).body.token;
  tokens.analista = (await login('analista', process.env.SEED_ANALISTA_PASSWORD)).body.token;
  tokens.lector = (await login('lector', process.env.SEED_LECTOR_PASSWORD)).body.token;
});
after(async () => { await db.close(); });

describe('Autenticación', () => {
  test('[CP-01] Login correcto devuelve token JWT y rol', async () => {
    const r = await login('admin', process.env.SEED_ADMIN_PASSWORD);
    assert.equal(r.status, 200);
    assert.equal(r.body.tipo, 'Bearer');
    assert.equal(r.body.token.split('.').length, 3);
    assert.equal(r.body.usuario.role, 'admin');
    assert.equal(r.body.usuario.password_hash, undefined);
  });

  test('[CP-02] Credenciales incorrectas → 401 con el mismo mensaje para usuario inexistente y clave errónea', async () => {
    const a = await login('admin', 'clave-equivocada');
    const b = await login('no-existe', 'clave-equivocada');
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  test('[CP-03] Acceso SIN token a ruta protegida → 401', async () => {
    const r = await peticion('get', '/api/incidentes');
    assert.equal(r.status, 401);
    assert.equal(r.headers['www-authenticate'], 'Bearer');
  });

  test('[CP-04] Token manipulado (rol alterado, firma original) → 401', async () => {
    const [h, p, s] = tokens.lector.split('.');
    const carga = JSON.parse(Buffer.from(p, 'base64url').toString());
    carga.role = 'admin';
    const falso = `${h}.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.${s}`;
    const r = await peticion('delete', '/api/incidentes/1', { token: falso });
    assert.equal(r.status, 401);
  });

  test('[CP-05] Token expirado → 401', async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const cuerpo = { sub: '1', username: 'admin', role: 'admin', iat: ahora - 7200, exp: ahora - 3600, iss: config.jwt.issuer, aud: config.jwt.audience };
    const dato = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(cuerpo)).toString('base64url')}`;
    const firma = crypto.createHmac('sha256', config.jwt.secret).update(dato).digest('base64url');
    const r = await peticion('get', '/api/incidentes', { token: `${dato}.${firma}` });
    assert.equal(r.status, 401);
    assert.match(r.body.error, /expirado/);
  });

  test('[CP-06] Token con alg "none" o firmado con otro secreto → 401', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const ahora = Math.floor(Date.now() / 1000);
    const carga = { sub: '1', username: 'admin', role: 'admin', exp: ahora + 600, iss: config.jwt.issuer, aud: config.jwt.audience };
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(carga)}.`;
    const dato = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}`;
    const otroSecreto = `${dato}.${crypto.createHmac('sha256', 'otro-secreto').update(dato).digest('base64url')}`;
    assert.equal((await peticion('get', '/api/incidentes', { token: sinFirma })).status, 401);
    assert.equal((await peticion('get', '/api/incidentes', { token: otroSecreto })).status, 401);
  });

  test('[CP-07] Cabecera Authorization mal formada → 401', async () => {
    for (const valor of ['Basic abc', 'Bearer', 'Bearer a b', 'token-suelto']) {
      const r = await peticion('get', '/api/incidentes', { headers: { Authorization: valor } });
      assert.equal(r.status, 401, valor);
    }
  });

  test('[CP-08] Usuario desactivado pierde acceso aunque su token no haya expirado', async () => {
    await peticion('post', '/api/auth/usuarios', { token: tokens.admin, body: { username: 'temporal', password: 'Temporal-2026-ok', role: 'lector' } });
    const t = (await login('temporal', 'Temporal-2026-ok')).body.token;
    assert.equal((await peticion('get', '/api/incidentes', { token: t })).status, 200);
    await db.query("UPDATE usuarios SET activo = FALSE WHERE username = 'temporal'");
    assert.equal((await peticion('get', '/api/incidentes', { token: t })).status, 401);
    assert.equal((await login('temporal', 'Temporal-2026-ok')).status, 401);
  });
});

describe('Autorización por roles', () => {
  test('[CP-09] Lector intenta CREAR → 403 (permisos insuficientes)', async () => {
    const r = await peticion('post', '/api/incidentes', { token: tokens.lector, body: valido });
    assert.equal(r.status, 403);
  });

  test('[CP-10] Analista intenta ELIMINAR → 403; lector intenta ACTUALIZAR → 403', async () => {
    assert.equal((await peticion('delete', '/api/incidentes/1', { token: tokens.analista })).status, 403);
    assert.equal((await peticion('patch', '/api/incidentes/1', { token: tokens.lector, body: { status: 'Resuelto' } })).status, 403);
  });

  test('[CP-11] Analista no puede crear usuarios; el rol vigente se toma de la base, no del token', async () => {
    assert.equal((await peticion('post', '/api/auth/usuarios', { token: tokens.analista, body: { username: 'intruso', password: 'Intruso-2026-ok', role: 'admin' } })).status, 403);
    // Degradar a "analista" → "lector" en la base: el token viejo ya no puede escribir
    await db.query("UPDATE usuarios SET role = 'lector' WHERE username = 'analista'");
    assert.equal((await peticion('post', '/api/incidentes', { token: tokens.analista, body: valido })).status, 403);
    await db.query("UPDATE usuarios SET role = 'analista' WHERE username = 'analista'");
  });
});

describe('CRUD completo con roles', () => {
  test('[CP-12] Crear → consultar → actualizar (PATCH y PUT) → eliminar', async () => {
    const c = await peticion('post', '/api/incidentes', { token: tokens.analista, body: valido });
    assert.equal(c.status, 201);
    assert.equal(c.body.status, 'Abierto');
    const id = c.body.id;

    const g = await peticion('get', `/api/incidentes/${id}`, { token: tokens.lector });
    assert.equal(g.status, 200);
    assert.equal(g.body.title, valido.title);

    const p = await peticion('patch', `/api/incidentes/${id}`, { token: tokens.analista, body: { status: 'Resuelto' } });
    assert.equal(p.status, 200);
    assert.equal(p.body.status, 'Resuelto');

    const u = await peticion('put', `/api/incidentes/${id}`, { token: tokens.analista, body: { ...valido, title: 'Correo restablecido', priority: 'Baja' } });
    assert.equal(u.status, 200);
    assert.equal(u.body.priority, 'Baja');

    const l = await peticion('get', '/api/incidentes?status=Resuelto&search=restablecido', { token: tokens.lector });
    assert.equal(l.body.data.length, 1);

    assert.equal((await peticion('delete', `/api/incidentes/${id}`, { token: tokens.admin })).status, 204);
    assert.equal((await peticion('get', `/api/incidentes/${id}`, { token: tokens.admin })).status, 404);
  });
});

describe('Validación y limpieza de entradas', () => {
  test('[CP-13] Datos inválidos → 400 con detalle por campo', async () => {
    const r = await peticion('post', '/api/incidentes', {
      token: tokens.analista,
      body: { title: 'ab', category: 'Inventada', priority: 'Crítica', email: 'sin-arroba', date: '2026-02-30', description: 'x'.repeat(501) }
    });
    assert.equal(r.status, 400);
    const campos = r.body.detalles.map((d) => d.campo).sort();
    assert.deepEqual(campos, ['category', 'date', 'description', 'email', 'priority', 'title']);
  });

  test('[CP-14] Campos no permitidos (mass assignment) y tipos incorrectos → 400', async () => {
    const extra = await peticion('post', '/api/incidentes', { token: tokens.analista, body: { ...valido, id: 999, created_at: '2000-01-01', role: 'admin' } });
    assert.equal(extra.status, 400);
    const tipos = await peticion('post', '/api/incidentes', { token: tokens.analista, body: { ...valido, title: { $ne: null }, priority: ['Alta'] } });
    assert.equal(tipos.status, 400);
    const vacio = await peticion('patch', '/api/incidentes/1', { token: tokens.analista, body: {} });
    assert.equal(vacio.status, 400);
  });

  test('[CP-15] XSS: las etiquetas HTML se eliminan antes de guardar', async () => {
    const r = await peticion('post', '/api/incidentes', {
      token: tokens.analista,
      body: { ...valido, title: '<script>alert(1)</script>Servidor caído', description: '<img src=x onerror=alert(1)>Sin respuesta\u0000 del host' }
    });
    assert.equal(r.status, 201);
    assert.ok(!/[<>]/.test(r.body.title), r.body.title);
    assert.ok(!/[<>\u0000]/.test(r.body.description), r.body.description);
    assert.match(r.body.title, /Servidor caído/);
  });

  test('[CP-16] Inyección SQL en id y en búsqueda no tiene efecto', async () => {
    for (const id of ['1 OR 1=1', "1;DROP TABLE incidentes", 'abc', '-1', '0', '99999999999']) {
      const r = await peticion('get', `/api/incidentes/${encodeURIComponent(id)}`, { token: tokens.admin });
      assert.equal(r.status, 400, id);
    }
    const b = await peticion('get', `/api/incidentes?search=${encodeURIComponent("' OR 1=1 --")}`, { token: tokens.admin });
    assert.equal(b.status, 200);
    assert.deepEqual(b.body.data, []);
    const comodin = await peticion('get', `/api/incidentes?search=${encodeURIComponent('%')}`, { token: tokens.admin });
    assert.deepEqual(comodin.body.data, []);                       // "%" se trata como texto literal
    assert.ok((await peticion('get', '/api/incidentes', { token: tokens.admin })).body.pagination.total > 0);  // la tabla sigue íntegra
  });

  test('[CP-17] JSON mal formado → 400 genérico; ruta inexistente → 404', async () => {
    const r = await peticion('post', '/api/incidentes', { token: tokens.analista, body: '{"title": ' });
    assert.equal(r.status, 400);
    assert.equal((await peticion('get', '/api/no-existe', { token: tokens.admin })).status, 404);
  });
});

describe('Contraseñas, CORS, cabeceras y errores', () => {
  test('[CP-18] Las contraseñas se guardan con hash scrypt salado, nunca en claro', async () => {
    const { rows } = await db.query("SELECT password_hash FROM usuarios WHERE username = 'admin'");
    const { password_hash } = rows[0];
    assert.match(password_hash, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!password_hash.includes(process.env.SEED_ADMIN_PASSWORD));
    const h1 = await hashPassword('Misma-Clave-123'), h2 = await hashPassword('Misma-Clave-123');
    assert.notEqual(h1, h2);                                   // sal distinta
    assert.equal(await verificarPassword('Misma-Clave-123', h1), true);
    assert.equal(await verificarPassword('otra-clave-123', h1), false);
  });

  test('[CP-19] CORS: solo orígenes de la lista blanca; nunca "*"', async () => {
    const ok = await peticion('options', '/api/incidentes', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.match(ok.headers['access-control-allow-headers'], /Authorization/);
    const mal = await peticion('options', '/api/incidentes', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(mal.status, 403);
    assert.equal(mal.headers['access-control-allow-origin'], undefined);
    const get = await peticion('get', '/api/incidentes', { token: tokens.admin, headers: { Origin: 'https://evil.example' } });
    assert.equal(get.headers['access-control-allow-origin'], undefined);
  });

  test('[CP-20] Cabeceras de seguridad, HSTS solo bajo HTTPS, y errores 500 sin filtrar detalles internos', async () => {
    const http = await peticion('get', '/api/incidentes', { token: tokens.admin });
    assert.equal(http.headers['x-content-type-options'], 'nosniff');
    assert.equal(http.headers['x-frame-options'], 'DENY');
    assert.match(http.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(http.headers['cache-control'], 'no-store');
    assert.equal(http.headers['strict-transport-security'], undefined);
    const https = await peticion('get', '/api/incidentes', { token: tokens.admin, secure: true });
    assert.match(https.headers['strict-transport-security'], /max-age=/);

    mock.method(console, 'error', () => {});
    let capturado;
    const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(o) { capturado = { status: this.c, o }; } };
    errorHandler(new Error('SQLITE_ERROR: no such table usuarios en /srv/app/data/incidenta.db'), {}, res, () => {});
    mock.restoreAll();
    assert.equal(capturado.status, 500);
    assert.ok(!/SQLITE|srv|usuarios/.test(JSON.stringify(capturado.o)));
  });

  test('[CP-21] Limitador de intentos: el 4.º intento en la ventana → 429 con Retry-After', () => {
    const lim = crearLimitador({ ventanaMs: 60000, maximo: 3 });
    const resultados = [];
    for (let i = 0; i < 4; i++) lim({ ip: '10.0.0.9' }, { setHeader() {} }, (e) => resultados.push(e));
    assert.equal(resultados.slice(0, 3).every((e) => e === undefined), true);
    assert.equal(resultados[3].status, 429);
    assert.ok(resultados[3].headers['Retry-After']);
  });

  test('[CP-22] JWT: verify rechaza token alterado; sign/verify de ida y vuelta', () => {
    const t = sign({ sub: '5', role: 'lector' });
    assert.equal(verify(t).sub, '5');
    assert.throws(() => verify(t.slice(0, -2) + 'AA'), { code: 'invalid' });
  });

  test('[CP-23] FORCE_HTTPS: HTTP se redirige (308) a PUBLIC_URL o recibe 426; HTTPS pasa', async () => {
    const antes = { f: config.forzarHttps, u: config.urlPublica };
    try {
      config.forzarHttps = true;
      config.urlPublica = 'https://incidenta.ejemplo.com/';
      const redir = await peticion('get', '/api/incidentes?status=Abierto', { token: tokens.admin });
      assert.equal(redir.status, 308);
      assert.equal(redir.headers.location, 'https://incidenta.ejemplo.com/api/incidentes?status=Abierto');
      // La cabecera Host (controlada por el cliente) no interviene en la redirección.
      const falso = await peticion('get', '/api/incidentes', { token: tokens.admin, headers: { Host: 'evil.example' } });
      assert.ok(!falso.headers.location.includes('evil.example'));
      config.urlPublica = '';
      const upgrade = await peticion('get', '/api/incidentes', { token: tokens.admin });
      assert.equal(upgrade.status, 426);
      const seguro = await peticion('get', '/api/incidentes', { token: tokens.admin, secure: true });
      assert.equal(seguro.status, 200);
    } finally {
      config.forzarHttps = antes.f;
      config.urlPublica = antes.u;
    }
  });
});
