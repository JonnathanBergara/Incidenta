/**
 * medir.js — Mide una consulta SQL, una imagen y una solicitud de red.
 *
 *   node scripts/medir.js antes      → evidencias/mediciones/antes.json
 *   node scripts/medir.js despues    → evidencias/mediciones/despues.json
 *
 * Variables opcionales: FILAS_BD (20000), FILAS_API (2000), IMAGEN (ruta relativa a medir).
 * Con Express instalado, la medición de red usa server.js; si no, el adaptador de scripts/.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'medicion-'.padEnd(48, 'm');
process.env.LOGIN_MAX_ATTEMPTS = '100000';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const etiqueta = process.argv[2] || 'actual';
const raiz = path.join(__dirname, '..');
const FILAS_BD = Number(process.env.FILAS_BD) || 20000;
const FILAS_API = Number(process.env.FILAS_API) || 2000;
const mediana = (v) => { const o = [...v].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
const p95 = (v) => { const o = [...v].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.ceil(o.length * 0.95) - 1)]; };
const r1 = (n) => Math.round(n * 10) / 10;

async function sembrar(db, n) {
  const cats = ['Infraestructura', 'Aplicación', 'Seguridad', 'Acceso', 'Otro'];
  const pr = ['Alta', 'Media', 'Baja'];
  const es = ['Abierto', 'En progreso', 'Resuelto'];
  await db.exec('TRUNCATE incidentes RESTART IDENTITY CASCADE');
  const lote = 500;
  for (let inicio = 0; inicio < n; inicio += lote) {
    const filas = [];
    const valores = [];
    for (let i = inicio; i < Math.min(inicio + lote, n); i += 1) {
      const base = valores.length;
      filas.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
      valores.push(
        `Incidente ${i} en servidor ${i % 37}`,
        cats[i % 5],
        pr[(i * 7) % 3],
        es[(i * 11) % 3],
        '2026-09-10',
        'soporte@incidenta.ec',
        'Descripción de ejemplo con texto para simular una carga real del sistema de incidentes. '.repeat(2)
      );
    }
    await db.query(`
      INSERT INTO incidentes (title, category, priority, status, date, email, description)
      VALUES ${filas.join(',')}
    `, valores);
  }
}

// ---------- 1. Consulta ----------
async function medirConsulta() {
  const { runMigrations } = require('../src/db/migrate');
  await runMigrations({ silent: true });
  const db = require('../src/db/connection');
  await sembrar(db, FILAS_BD);
  await db.query('ANALYZE incidentes');
  const modelo = require('../src/models/incidente.model');
  const casos = [
    ['Listado completo (sin filtros)', {}],
    ['Filtro estado = Abierto', { status: 'Abierto' }],
    ['Filtro estado + prioridad', { status: 'Abierto', priority: 'Alta' }],
    ['Búsqueda de texto "servidor 12"', { search: 'servidor 12' }]
  ];
  const resultado = [];
  for (const [nombre, filtros] of casos) {
    const condiciones = [];
    const valores = [];
    for (const campo of ['status', 'priority']) {
      if (!filtros[campo]) continue;
      valores.push(filtros[campo]);
      condiciones.push(`${campo} = $${valores.length}`);
    }
    if (filtros.search) {
      valores.push(`%${filtros.search}%`);
      condiciones.push(`(title ILIKE $${valores.length} OR category ILIKE $${valores.length})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const sql = `SELECT * FROM incidentes ${where} ORDER BY created_at DESC, id DESC`;
    const planResult = await db.query(`EXPLAIN ${sql}`, valores);
    const plan = planResult.rows.map((row) => row['QUERY PLAN']);
    for (let i = 0; i < 3; i += 1) await modelo.getAll(filtros);
    const tiempos = [];
    let filas = 0;
    for (let i = 0; i < 15; i += 1) {
      const t = process.hrtime.bigint();
      filas = (await modelo.getAll(filtros)).length;
      tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    resultado.push({ caso: nombre, filas, mediana_ms: r1(mediana(tiempos)), p95_ms: r1(p95(tiempos)), plan });
  }
  return { motor: 'PostgreSQL (PGlite)', filasBD: FILAS_BD, sqlOrden: 'created_at DESC, id DESC', casos: resultado };
}

// ---------- 2. Imagen ----------
async function medirImagen(navegador) {
  const rel = process.env.IMAGEN || (etiqueta === 'antes' ? 'evidencias/integracion/06-analista-crear-ok-201.png' : 'docs/img/crear-incidente.webp');
  const ruta = path.join(raiz, rel);
  if (!fs.existsSync(ruta)) return { archivo: rel, error: 'no existe' };
  const mime = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }[path.extname(ruta)];
  const cuerpo = fs.readFileSync(ruta);
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/img')) { r.writeHead(200, { 'Content-Type': mime, 'Content-Length': cuerpo.length }); return r.end(cuerpo); }
    r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<img id="i" src="/img" style="width:800px">');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const decodificaciones = []; let datos;
  for (let i = 0; i < 7; i += 1) {
    const ctx = await navegador.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(base);
    datos = await page.evaluate(async () => {
      const img = document.getElementById('i');
      await img.decode();
      const t = performance.getEntriesByType('resource').find((e) => e.name.endsWith('/img'));
      return { ancho: img.naturalWidth, alto: img.naturalHeight, mostrada: img.clientWidth, transferido: t.transferSize, descarga_ms: t.responseEnd - t.requestStart };
    });
    const dec = await page.evaluate(async () => { const imagen = new Image(); imagen.src = `/img?x=${Math.random()}`; const inicio = performance.now(); await imagen.decode(); return performance.now() - inicio; });
    decodificaciones.push(dec);
    await ctx.close();
  }
  srv.close();
  return { archivo: rel, formato: path.extname(ruta).slice(1), bytes: cuerpo.length, ...datos, factorSobredimension: r1(datos.ancho / datos.mostrada), descarga_ms: r1(datos.descarga_ms), decodificacion_ms_mediana: r1(mediana(decodificaciones)) };
}

// ---------- 3. Solicitud de red ----------
async function medirRed(navegador) {
  const { iniciar } = require('./servidor-evidencia');
  const { servidor, base, motor } = await iniciar();
  const db = require('../src/db/connection');
  await sembrar(db, FILAS_API);
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const peticiones = new Map();
  const cabecera = (cabeceras, nombre) => {
    const entrada = Object.entries(cabeceras || {}).find(([clave]) => clave.toLowerCase() === nombre);
    return entrada ? entrada[1] : '';
  };
  cdp.on('Network.requestWillBeSent', (e) => peticiones.set(e.requestId, { url: e.request.url, t0: e.timestamp, decodificado: 0 }));
  cdp.on('Network.responseReceived', (e) => Object.assign(peticiones.get(e.requestId) || {}, {
    estado: e.response.status,
    codificacion: cabecera(e.response.headers, 'content-encoding') || 'ninguna',
    cache: cabecera(e.response.headers, 'cache-control'),
    tipo: cabecera(e.response.headers, 'content-type'),
    vary: cabecera(e.response.headers, 'vary')
  }));
  cdp.on('Network.dataReceived', (e) => { const p = peticiones.get(e.requestId); if (p) p.decodificado += e.dataLength; });
  cdp.on('Network.loadingFinished', (e) => { const p = peticiones.get(e.requestId); if (p) { p.transferido = e.encodedDataLength; p.ms = (e.timestamp - p.t0) * 1000; } });

  // Carga de la página (fría y recarga) — solo recursos estáticos
  const cargar = async (recargar) => {
    peticiones.clear();
    if (recargar) await page.reload(); else await page.goto(base);
    await page.waitForSelector('#login-dialog[open]');
    await page.waitForTimeout(400);
    const navegacion = await page.evaluate(() => {
      const entrada = performance.getEntriesByType('navigation')[0];
      return {
        respuesta_ms: entrada.responseEnd,
        dom_content_loaded_ms: entrada.domContentLoadedEventEnd,
        carga_ms: entrada.loadEventEnd
      };
    });
    const lista = [...peticiones.values()].filter((p) => p.url.startsWith(base) && !p.url.includes('/api/'));
    return {
      peticiones: lista.length,
      bytes: lista.reduce((n, p) => n + (p.transferido || 0), 0),
      sin_cuerpo_304: lista.filter((p) => p.estado === 304).length,
      navegacion,
      detalle: lista.map((p) => ({
        url: p.url.replace(base, ''), estado: p.estado, transferido: p.transferido,
        codificacion: p.codificacion, cache: p.cache, tipo: p.tipo
      }))
    };
  };
  const carga = await cargar(false);
  const recarga = await cargar(true);

  // Solicitud de la API
  const sesion = await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: process.env.SEED_ADMIN_PASSWORD }) })).json();
  peticiones.clear();
  const total = [];
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate((t) => fetch('/api/incidentes?limit=100', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.arrayBuffer()), sesion.token);
  }
  await page.waitForTimeout(300);
  const api = [...peticiones.values()].filter((p) => new URL(p.url).pathname === '/api/incidentes');
  for (const p of api) total.push(p.ms);
  const ultimo = api[api.length - 1];
  await ctx.close();
  await new Promise((resolve) => servidor.close(resolve));
  await db.close();
  return {
    motor, filasAPI: FILAS_API, carga, recarga,
    api: {
      solicitudes: api.length,
      estado: ultimo.estado,
      codificacion: ultimo.codificacion,
      cabeceras: {
        'content-type': ultimo.tipo,
        'content-encoding': ultimo.codificacion === 'ninguna' ? '' : ultimo.codificacion,
        'cache-control': ultimo.cache,
        vary: ultimo.vary
      },
      transferido_bytes: ultimo.transferido,
      decodificado_bytes: ultimo.decodificado,
      mediana_ms: r1(mediana(total)),
      p95_ms: r1(p95(total))
    }
  };
}

(async () => {
  const navegador = await chromium.launch();
  const salida = { etiqueta, fecha: new Date().toISOString(), navegador: `Chromium ${navegador.version()}`, node: process.version };
  salida.consulta = await medirConsulta();
  salida.imagen = await medirImagen(navegador);
  process.env.SEED_ADMIN_PASSWORD = 'Admin-Demo-2026';
  salida.red = await medirRed(navegador);
  await navegador.close();
  const dir = path.join(raiz, 'evidencias', 'mediciones');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${etiqueta}.json`), JSON.stringify(salida, null, 2));
  console.log(JSON.stringify(salida, null, 2));
})().catch((e) => { console.error(e); process.exitCode = 1; });
