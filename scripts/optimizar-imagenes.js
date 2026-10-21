/**
 * optimizar-imagenes.js — Reduce el peso de las capturas que usan el README y los informes.
 *
 * Las capturas originales (1280×900 px, PNG) se muestran a ~800 px de ancho:
 * se redimensionan a 1000 px y se convierten a WebP (README) y a PNG de paleta (informes).
 *
 *   npm i -D sharp   &&   node scripts/optimizar-imagenes.js
 */
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch { console.error('Falta sharp: npm i -D sharp'); process.exit(2); }

const raiz = path.join(__dirname, '..');
const origen = path.join(raiz, 'evidencias', 'integracion');
const destino = path.join(raiz, 'docs', 'img');
fs.mkdirSync(destino, { recursive: true });

const LISTA = [
  ['06-analista-crear-ok-201.png', 'crear-incidente'],
  ['10-mensaje-403-sin-permisos.png', 'mensaje-403'],
  ['11-mensaje-401-sesion-invalida.png', 'mensaje-401']
];

(async () => {
  for (const [archivo, nombre] of LISTA) {
    const entrada = path.join(origen, archivo);
    if (!fs.existsSync(entrada)) continue;
    const base = sharp(entrada).resize({ width: 1000, withoutEnlargement: true });
    await base.clone().webp({ quality: 80, effort: 6 }).toFile(path.join(destino, `${nombre}.webp`));
    await base.clone().png({ palette: true, quality: 80, effort: 10 }).toFile(path.join(destino, `${nombre}.png`));
    const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1);
    console.log(`${archivo}: ${kb(entrada)} KB → webp ${kb(path.join(destino, nombre + '.webp'))} KB, png ${kb(path.join(destino, nombre + '.png'))} KB`);
  }
})();
