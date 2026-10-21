/**
 * capturas-navegador.js — Recorre la interfaz REAL en un navegador (Playwright)
 * con cada rol y guarda capturas + la traza de red en evidencias/integracion/.
 *
 * Uso:   npm i -D playwright && npx playwright install chromium
 *        node scripts/capturas-navegador.js
 *
 * Demuestra de extremo a extremo: login, Authorization: Bearer en cada
 * petición, CRUD, mensajes de validación (400), permisos (403) y sesión (401).
 */

const fs = require('fs');
const path = require('path');
const { iniciar } = require('./servidor-evidencia');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Falta playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const SALIDA = path.join(__dirname, '..', 'evidencias', 'integracion');
const CLAVES = { admin: 'Admin-Demo-2026', analista: 'Analista-Demo-2026', lector: 'Lector-Demo-2026' };

async function entrar(page, base, usuario) {
  await page.goto(base);
  await page.waitForSelector('#login-dialog[open]');
  await page.fill('#login-username', usuario);
  await page.fill('#login-password', CLAVES[usuario]);
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector('#login-dialog', { state: 'hidden' });
  await page.waitForSelector('#session-user');
  await page.waitForFunction(() => document.querySelectorAll('#incident-list tr').length > 0);
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { servidor, base, motor } = await iniciar();
  const db = require('../src/db/connection');
  const navegador = await chromium.launch();
  const traza = [`Motor del servidor: ${motor}`, `Navegador: Chromium ${navegador.version()}`, ''];
  let n = 0;
  const foto = async (page, nombre, opciones = {}) => {
    n += 1;
    const archivo = `${String(n).padStart(2, '0')}-${nombre}.png`;
    await page.screenshot({ path: path.join(SALIDA, archivo), ...opciones });
    console.log('  captura', archivo);
  };

  async function nuevaSesion(usuario) {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('response', async (r) => {
      const req = r.request();
      if (!r.url().includes('/api/')) return;
      const auth = req.headers().authorization;
      traza.push(`[${usuario}] ${req.method().padEnd(6)} ${new URL(r.url()).pathname.padEnd(22)} Authorization: ${auth ? 'Bearer ***' : '(sin cabecera)'}  ->  ${r.status()}`);
    });
    page.on('dialog', (d) => d.accept());       // window.confirm de "Eliminar"
    return { ctx, page };
  }

  try {
    // 1. Sin sesión y credenciales erróneas
    let s = await nuevaSesion('anónimo');
    await s.page.goto(base);
    await s.page.waitForSelector('#login-dialog[open]');
    await foto(s.page, 'login-sin-sesion');
    await s.page.fill('#login-username', 'analista');
    await s.page.fill('#login-password', 'clave-incorrecta');
    await s.page.click('#login-form button[type="submit"]');
    await s.page.waitForFunction(() => document.querySelector('#login-error').textContent.length > 0);
    await foto(s.page, 'login-credenciales-incorrectas');
    await s.ctx.close();

    // 2. Lector: solo consulta
    s = await nuevaSesion('lector');
    await entrar(s.page, base, 'lector');
    await foto(s.page, 'lector-listado-solo-lectura');
    await s.page.locator('#incident-form').scrollIntoViewIfNeeded();
    await foto(s.page, 'lector-formulario-deshabilitado');
    await s.ctx.close();

    // 3. Analista: crear, error de validación del servidor, actualizar
    s = await nuevaSesion('analista');
    await entrar(s.page, base, 'analista');
    const p = s.page;
    await p.fill('#title', 'Caída del servicio de correo');
    await p.selectOption('#category', 'Infraestructura');
    await p.selectOption('#priority', 'Alta');
    await p.fill('#reporter-email', 'ana@incidenta.ec');
    await p.fill('#description', 'No se envían correos desde las 08:00.');
    await foto(p, 'analista-formulario-lleno');
    await p.click('#incident-form button[type="submit"]');
    await p.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('registrado'));
    await p.locator('#incident-list tr', { hasText: 'Caída del servicio de correo' }).waitFor();
    await foto(p, 'analista-crear-ok-201');

    await p.locator('#incident-form').scrollIntoViewIfNeeded();
    await p.fill('#title', '<b></b>');           // pasa la validación del cliente, no la del servidor
    await p.fill('#description', 'Título formado solo por etiquetas HTML.');
    await p.fill('#reporter-email', 'ana@incidenta.ec');
    await p.selectOption('#category', 'Otro');
    await p.selectOption('#priority', 'Baja');
    await p.click('#incident-form button[type="submit"]');
    await p.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('título'));
    await p.locator('#incident-form').scrollIntoViewIfNeeded();
    await foto(p, 'analista-validacion-servidor-400');

    await p.locator('#incident-list tr', { hasText: 'Caída del servicio de correo' }).locator('button').click();
    await p.waitForSelector('#detail-dialog[open]');
    await foto(p, 'analista-detalle-sin-boton-eliminar');
    await p.click('#resolve-detail');
    await p.waitForSelector('#detail-dialog', { state: 'hidden' });
    await p.locator('#incident-list tr', { hasText: 'Caída del servicio de correo' }).locator('.status-resuelto').waitFor();
    await foto(p, 'analista-actualizar-estado-resuelto');

    // 4. 403: el rol se toma de la BD; un admin degrada al analista con la sesión abierta
    await db.query("UPDATE usuarios SET role = 'lector' WHERE username = 'analista'");
    await p.locator('#incident-form').scrollIntoViewIfNeeded();
    await p.fill('#title', 'Intento tras perder permisos');
    await p.fill('#description', 'La petición es válida, pero el rol ya no lo permite.');
    await p.fill('#reporter-email', 'ana@incidenta.ec');
    await p.selectOption('#category', 'Seguridad');
    await p.selectOption('#priority', 'Media');
    await p.click('#incident-form button[type="submit"]');
    await p.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('permisos'));
    await foto(p, 'mensaje-403-sin-permisos');
    await db.query("UPDATE usuarios SET role = 'analista' WHERE username = 'analista'");

    // 5. 401: token alterado en la sesión del navegador
    await p.evaluate(() => {
      const sesion = JSON.parse(sessionStorage.getItem('incidenta-sesion'));
      sesion.token = sesion.token.slice(0, -3) + 'AAA';
      sessionStorage.setItem('incidenta-sesion', JSON.stringify(sesion));
    });
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#login-error').textContent.includes('sesión'));
    await foto(p, 'mensaje-401-sesion-invalida');
    await s.ctx.close();

    // 6. Admin: eliminar
    s = await nuevaSesion('admin');
    await entrar(s.page, base, 'admin');
    const a = s.page;
    const fila = a.locator('#incident-list tr', { hasText: 'Caída del servicio de correo' });
    await fila.locator('button').click();
    await a.waitForSelector('#detail-dialog[open]');
    await foto(a, 'admin-detalle-con-boton-eliminar');
    await a.click('#delete-detail');
    await a.waitForSelector('#detail-dialog', { state: 'hidden' });
    await fila.waitFor({ state: 'detached' });
    await foto(a, 'admin-eliminar-ok-204');
    await s.ctx.close();
  } finally {
    await navegador.close();
    await new Promise((resolve) => servidor.close(resolve));
    await db.close();
  }
  fs.writeFileSync(path.join(SALIDA, 'trazas-red.txt'), traza.join('\n') + '\n');
  console.log(`\nListo: ${n} capturas y trazas-red.txt en ${SALIDA}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
