/**
 * transcripcion.js — Ejecuta la suite y los escenarios de la API y guarda la
 * salida REAL (sin editar) en evidencias/transcripciones/*.txt.
 * scripts/capturas.py convierte esos textos en imágenes.
 *
 * Uso: node scripts/transcripcion.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-transcripcion-'.padEnd(48, 'x');
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_MAX_ATTEMPTS = '1000';
process.env.SEED_ADMIN_PASSWORD = 'Admin-Prueba-2026';
process.env.SEED_ANALISTA_PASSWORD = 'Analista-Prueba-2026';
process.env.SEED_LECTOR_PASSWORD = 'Lector-Prueba-2026';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'evidencias', 'transcripciones');
fs.mkdirSync(SALIDA, { recursive: true });

// ---------- 1. Suite de pruebas (salida real del ejecutor de Node) ----------
function suite() {
  const opciones = { cwd: RAIZ, encoding: 'utf8' };
  const jest = spawnSync(process.execPath, [
    '--experimental-vm-modules',
    path.join(RAIZ, 'node_modules', 'jest', 'bin', 'jest.js'),
    '--runInBand',
    'tests/unit'
  ], opciones);
  const integracion = spawnSync(process.execPath, [
    '--test',
    '--test-reporter=spec',
    'tests/http.test.js',
    'tests/seguridad.test.js'
  ], opciones);
  for (const resultado of [jest, integracion]) {
    if (resultado.error) throw resultado.error;
    if (resultado.status !== 0) {
      process.stderr.write(resultado.stdout || '');
      process.stderr.write(resultado.stderr || '');
      process.exit(resultado.status || 1);
    }
  }
  const limpio = (jest.stdout + jest.stderr + integracion.stdout + integracion.stderr)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/ \(\d+(\.\d+)?ms\)/g, '')
    .replace(/^ExperimentalWarning.*$/gm, '')
    .split('\n').filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)).join('\n');
  const cuerpo = limpio.split('\n').filter((l) => !/^ℹ (duration_ms|suites|cancelled|todo)/.test(l)).join('\n').trim();
  fs.writeFileSync(path.join(SALIDA, '01-suite-pruebas.txt'), `$ npm test\n${cuerpo}\n`);
  console.log('  01-suite-pruebas.txt');
}

// ---------- 2. Escenarios HTTP a través de la misma cadena de middleware ----------
async function escenarios() {
  const { runMigrations } = require('../src/db/migrate');
  const { seedIfEmpty, seedUsuarios } = require('../src/db/seed');
  await runMigrations({ silent: true });
  await seedIfEmpty({ silent: true });
  await seedUsuarios({ silent: true });
  const { peticion } = require('../tests/harness');

  const login = async (u, p) => (await peticion('post', '/api/auth/login', { body: { username: u, password: p } })).body.token;
  const tk = {
    admin: await login('admin', process.env.SEED_ADMIN_PASSWORD),
    lector: await login('lector', process.env.SEED_LECTOR_PASSWORD),
    analista: await login('analista', process.env.SEED_ANALISTA_PASSWORD)
  };
  const corto = (t) => `${t.slice(0, 18)}…`;
  const JSON_ = (o) => (o === undefined ? '(sin cuerpo)' : JSON.stringify(o));

  async function paso(titulo, metodo, url, { token, headers, body } = {}) {
    const r = await peticion(metodo, url, { token, headers, body });
    const h = [];
    if (token) h.push(`-H "Authorization: Bearer ${corto(token)}"`);
    for (const [k, v] of Object.entries(headers || {})) h.push(`-H "${k}: ${v}"`);
    if (body !== undefined) h.push(`-H "Content-Type: application/json" -d '${JSON.stringify(body)}'`);
    const claves = ['www-authenticate', 'access-control-allow-origin', 'access-control-allow-methods', 'location', 'retry-after'];
    const cab = claves.filter((k) => r.headers[k]).map((k) => `${k}: ${r.headers[k]}`);
    let salida = `# ${titulo}\n$ curl -i -X ${metodo.toUpperCase()} http://localhost:3000${url}${h.map((x) => ` \\\n    ${x}`).join('')}\nHTTP ${r.status}\n`;
    if (cab.length) salida += cab.join('\n') + '\n';
    salida += `${JSON_(r.body)}\n`;
    return { salida, r };
  }
  const guardar = (archivo, partes) => { fs.writeFileSync(path.join(SALIDA, archivo), partes.join('\n')); console.log('  ' + archivo); };

  guardar('02-sin-token-401.txt', [
    (await paso('Sin cabecera Authorization', 'get', '/api/incidentes')).salida,
    (await paso('Token manipulado (firma alterada)', 'get', '/api/incidentes', { token: tk.admin.slice(0, -3) + 'AAA' })).salida,
    (await paso('Token con alg "none"', 'get', '/api/incidentes', {
      token: `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"1","role":"admin"}').toString('base64url')}.`
    })).salida
  ]);

  guardar('03-permisos-403.txt', [
    (await paso('Lector intenta CREAR', 'post', '/api/incidentes', { token: tk.lector, body: { title: 'Prueba', category: 'Otro', priority: 'Baja' } })).salida,
    (await paso('Analista intenta ELIMINAR', 'delete', '/api/incidentes/1', { token: tk.analista })).salida,
    (await paso('Analista intenta crear USUARIOS', 'post', '/api/auth/usuarios', { token: tk.analista, body: { username: 'nuevo', password: 'Clave-Segura-2026', role: 'lector' } })).salida
  ]);

  guardar('04-validacion-400.txt', [
    (await paso('Campos obligatorios ausentes', 'post', '/api/incidentes', { token: tk.admin, body: { title: '' } })).salida,
    (await paso('Mass assignment: campo role no permitido', 'post', '/api/incidentes', { token: tk.admin, body: { title: 'Intento', category: 'Otro', priority: 'Baja', role: 'admin' } })).salida,
    (await paso('XSS: se eliminan las etiquetas antes de guardar', 'post', '/api/incidentes', { token: tk.admin, body: { title: 'Aviso <script>alert(1)</script> de red', category: 'Seguridad', priority: 'Media' } })).salida,
    (await paso('Inyección SQL en el id', 'get', "/api/incidentes/1%20OR%201=1", { token: tk.admin })).salida
  ]);

  const c = await paso('1) CREAR (analista)', 'post', '/api/incidentes', { token: tk.analista, body: { title: 'Caída del servicio de correo', category: 'Infraestructura', priority: 'Alta', email: 'ana@incidenta.ec', description: 'No se envían correos desde las 08:00.' } });
  const id = c.r.body.id;
  guardar('05-crud.txt', [
    c.salida,
    (await paso('2) CONSULTAR (lector)', 'get', `/api/incidentes/${id}`, { token: tk.lector })).salida,
    (await paso('3) ACTUALIZAR (analista)', 'patch', `/api/incidentes/${id}`, { token: tk.analista, body: { status: 'Resuelto' } })).salida,
    (await paso('4) ELIMINAR (admin)', 'delete', `/api/incidentes/${id}`, { token: tk.admin })).salida,
    (await paso('5) CONSULTAR de nuevo → ya no existe', 'get', `/api/incidentes/${id}`, { token: tk.admin })).salida
  ]);

  guardar('06-cors.txt', [
    (await paso('Preflight desde origen autorizado', 'options', '/api/incidentes', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } })).salida,
    (await paso('Preflight desde origen NO autorizado', 'options', '/api/incidentes', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } })).salida
  ]);
}

(async () => {
  suite();
  await escenarios();
  await require('../src/db/connection').close();
  console.log('Transcripciones guardadas en evidencias/transcripciones/');
})().catch((error) => {
  console.error('[transcripcion] No se pudieron generar evidencias:', error);
  process.exitCode = 1;
});
