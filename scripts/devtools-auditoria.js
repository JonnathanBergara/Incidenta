/**
 * devtools-auditoria.js — Audita la interfaz con el protocolo de Chrome DevTools (CDP)
 * y guarda hallazgos + capturas en evidencias/devtools/.
 *
 *   node scripts/devtools-auditoria.js antes
 *   node scripts/devtools-auditoria.js despues
 *
 * Cada defecto se reproduce con el panel de DevTools que lo muestra:
 *   D1 Elements    → fecha del encabezado fija ("09 septiembre 2026")
 *   D2 Sensors     → zona horaria America/Guayaquil, 20:30 → fecha por defecto = mañana (UTC)
 *   D3 Network     → doble clic en "Registrar" envía dos POST
 *   D4 Performance → cada tecla de la búsqueda vuelve a pintar las filas visibles
 * Además registra Consola e Issues (Audits) para comprobar que no hay errores.
 */
const fs = require('fs');
const path = require('path');
const { iniciar } = require('./servidor-evidencia');
const { chromium } = require('playwright');

const etiqueta = process.argv[2] || 'actual';
const SALIDA = path.join(__dirname, '..', 'evidencias', 'devtools');
const FILAS = 50;

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { servidor, base, motor } = await iniciar();
  const db = require('../src/db/connection');
  const cats = ['Infraestructura', 'Aplicación', 'Seguridad', 'Acceso', 'Otro'], pr = ['Alta', 'Media', 'Baja'], es = ['Abierto', 'En progreso', 'Resuelto'];
  for (let i = 0; i < FILAS; i += 1) {
    await db.query(
      'INSERT INTO incidentes (title, category, priority, status, date, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [`Incidente de prueba ${i} en servidor ${i % 37}`, cats[i % 5], pr[i % 3], es[i % 3], '2026-09-10', 'Descripción de prueba para simular carga.']
    );
  }

  const navegador = await chromium.launch();
  const res = { etiqueta, motor, navegador: `Chromium ${navegador.version()}`, filas: FILAS };

  // Panel Sensors: 16/10/2026 20:30 en Guayaquil (UTC-5) = 17/10/2026 01:30 UTC
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Guayaquil', locale: 'es-EC' });
  await ctx.clock.setFixedTime(new Date('2026-10-17T01:30:00Z'));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const consola = []; const issues = []; const posts = [];
  page.on('console', (m) => consola.push({ tipo: m.type(), texto: m.text() }));
  page.on('pageerror', (e) => consola.push({ tipo: 'pageerror', texto: String(e.message) }));
  await cdp.send('Network.enable'); await cdp.send('Audits.enable'); await cdp.send('Performance.enable');
  cdp.on('Audits.issueAdded', ({ issue }) => issues.push(issue.code));
  cdp.on('Network.requestWillBeSent', (e) => { if (e.request.method === 'POST' && e.request.url.endsWith('/api/incidentes')) posts.push(e.timestamp); });
  const metricas = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

  await page.goto(base);
  await page.waitForSelector('#login-dialog[open]');
  await page.fill('#login-username', 'analista');
  await page.fill('#login-password', 'Analista-Demo-2026');
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction((n) => document.querySelectorAll('#incident-list tr').length >= n, FILAS);

  // D1 + D2
  res.d1_elements = { eyebrow: (await page.textContent('.eyebrow')).trim(), esperado: 'Centro de operaciones / 16 octubre 2026' };
  res.d2_sensors = { fechaPorDefecto: await page.inputValue('#incident-date'), esperada: '2026-10-16' };
  await page.locator('.hero').screenshot({ path: path.join(SALIDA, `${etiqueta}-d1-hero.png`) });
  await page.locator('#incident-form').scrollIntoViewIfNeeded();
  await page.locator('#incident-date').locator('xpath=ancestor::div[contains(@class,"field-group")][1]').screenshot({ path: path.join(SALIDA, `${etiqueta}-d2-fecha.png`) });

  // D4: escribir "servidor" a ritmo humano (30 ms por tecla) y contar los repintados de la lista
  await page.evaluate(() => { window.__repintados = 0; new MutationObserver(() => { window.__repintados += 1; }).observe(document.querySelector('#incident-list'), { childList: true }); });
  const m0 = await metricas();
  await page.click('#search-input');
  await page.keyboard.type('servidor', { delay: 30 });
  await page.waitForTimeout(700);
  const m1 = await metricas();
  res.d4_performance = {
    teclas: 8,
    repintadosDeLaLista: await page.evaluate(() => window.__repintados),
    scriptMs: Number(((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0)),
    layoutMs: Number(((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(0)),
    tareaMs: Number(((m1.TaskDuration - m0.TaskDuration) * 1000).toFixed(0))
  };
  await page.fill('#search-input', '');
  await page.waitForTimeout(500);

  // D3: doble clic en Registrar
  await page.fill('#title', 'Prueba de doble envío');
  await page.selectOption('#category', 'Otro'); await page.selectOption('#priority', 'Baja');
  await page.fill('#reporter-email', 'ana@incidenta.ec'); await page.fill('#description', 'Doble clic.');
  posts.length = 0;
  await page.dblclick('#incident-form button[type="submit"]');
  await page.waitForTimeout(900);
  const duplicado = await db.query("SELECT COUNT(*) AS total FROM incidentes WHERE title = $1", ['Prueba de doble envío']);
  res.d3_network = { postEnviados: posts.length, filasEnBD: Number(duplicado.rows[0].total) };

  res.consola = consola; res.issues = issues;
  await navegador.close(); servidor.close();
  fs.writeFileSync(path.join(SALIDA, `${etiqueta}.json`), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
