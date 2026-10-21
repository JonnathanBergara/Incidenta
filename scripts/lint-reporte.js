/**
 * lint-reporte.js — Ejecuta ESLint y guarda el reporte (JSON + texto) en evidencias/lint/.
 * Requiere:  npm install   (instala eslint y @eslint/js)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const salida = path.join(__dirname, '..', 'evidencias', 'lint');
fs.mkdirSync(salida, { recursive: true });
const eslint = path.join(__dirname, '..', 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!fs.existsSync(eslint)) { console.error('ESLint no está instalado. Ejecute primero: npm install'); process.exit(2); }
const opciones = { cwd: path.join(__dirname, '..'), encoding: 'utf8' };
function ejecutar(formato) {
  const resultado = spawnSync(process.execPath, [eslint, '.', '-f', formato], opciones);
  if (resultado.error) throw resultado.error;
  return resultado;
}

const json = ejecutar('json');
if (!json.stdout) {
  console.error(json.stderr || 'ESLint no produjo un reporte JSON.');
  process.exit(json.status || 2);
}
fs.writeFileSync(path.join(salida, 'eslint-reporte.json'), json.stdout);
const texto = ejecutar('stylish');
fs.writeFileSync(path.join(salida, 'eslint-reporte.txt'), texto.stdout || 'Sin problemas\n');
const r = JSON.parse(json.stdout);
const errores = r.reduce((n, f) => n + f.errorCount, 0), avisos = r.reduce((n, f) => n + f.warningCount, 0);
console.log(`ESLint: ${errores} errores, ${avisos} advertencias en ${r.length} archivos`);
process.exit(errores ? 1 : 0);
