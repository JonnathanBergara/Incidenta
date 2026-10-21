/**
 * prelint.js — Análisis estático de respaldo (NO sustituye a ESLint).
 *
 * Se usa cuando ESLint no se puede instalar (equipos sin red). Revisa con el
 * compilador de TypeScript las reglas de ESLint que más pesan:
 *   no-unused-vars (variables, importaciones, parámetros tras el último usado y
 *   `catch (e)` sin usar; se ignoran los nombres que empiezan con _),
 *   eqeqeq, no-var, no-empty y no-console (solo en el cliente).
 *
 *   node scripts/prelint.js [carpeta]          (requiere el paquete "typescript")
 */
const fs = require('fs');
const path = require('path');
let ts;
try { ts = require('typescript'); } catch { console.error('Falta typescript: npm i -D typescript (o use ESLint con npm run lint)'); process.exit(2); }

const raiz = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const IGNORAR = new Set(['node_modules', 'data', 'evidencias', 'docs', '.git']);
function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORAR.has(e.name)) return [];
    const ruta = path.join(dir, e.name);
    return e.isDirectory() ? archivos(ruta) : /\.(js|mjs)$/.test(e.name) ? [ruta] : [];
  });
}

const lista = archivos(raiz);
const hallazgos = [];
const reportar = (sf, nodo, regla, mensaje, severidad = 'error') => {
  const { line, character } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
  hallazgos.push({ archivo: path.relative(raiz, sf.fileName), linea: line + 1, columna: character + 1, regla, mensaje, severidad });
};

// 1) no-unused-vars (TypeScript: noUnusedLocals / noUnusedParameters)
const programa = ts.createProgram(lista, { allowJs: true, checkJs: true, noEmit: true, noUnusedLocals: true, noUnusedParameters: false, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true, types: [] });
for (const d of ts.getPreEmitDiagnostics(programa)) {
  if (![6133, 6192, 6196, 6198, 6199, 6205].includes(d.code) || !d.file) continue;
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  hallazgos.push({ archivo: path.relative(raiz, d.file.fileName), linea: line + 1, columna: character + 1, regla: 'no-unused-vars', mensaje: ts.flattenDiagnosticMessageText(d.messageText, ' '), severidad: 'error' });
}

// 2) Reglas sintácticas
for (const sf of programa.getSourceFiles().filter((f) => lista.includes(f.fileName))) {
  const esCliente = sf.fileName.includes(`${path.sep}public${path.sep}`);
  const visitar = (n) => {
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)) reportar(sf, n.operatorToken, 'eqeqeq', 'Use === / !== en lugar de == / !=.');
    if (ts.isVariableDeclarationList(n) && !(n.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) reportar(sf, n, 'no-var', 'Use let o const en lugar de var.');
    if (ts.isBlock(n) && n.statements.length === 0 && !ts.isFunctionLike(n.parent) && !sf.text.slice(n.pos, n.end).includes('//')) reportar(sf, n, 'no-empty', 'Bloque vacío.');
    // no-unused-vars con args: 'after-used': solo los parámetros posteriores al último usado
    if (ts.isFunctionLike(n) && n.body && n.parameters.length) {
      const usa = (nombre) => { let u = false; const b = (x) => { if (ts.isIdentifier(x) && x.text === nombre) u = true; ts.forEachChild(x, b); }; b(n.body); return u; };
      const nombres = n.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
      let ultimoUsado = -1;
      nombres.forEach((nombre, i) => { if (nombre === null || usa(nombre)) ultimoUsado = i; });
      n.parameters.forEach((p, i) => {
        if (i > ultimoUsado && nombres[i] && !nombres[i].startsWith('_')) reportar(sf, p, 'no-unused-vars', `'${nombres[i]}' is defined but never used (after-used).`);
      });
    }
    if (ts.isCatchClause(n) && n.variableDeclaration && ts.isIdentifier(n.variableDeclaration.name) && !n.variableDeclaration.name.text.startsWith('_')) {
      const nombre = n.variableDeclaration.name.text;
      let usado = false;
      const buscar = (x) => { if (ts.isIdentifier(x) && x.text === nombre) usado = true; ts.forEachChild(x, buscar); };
      buscar(n.block);
      if (!usado) reportar(sf, n.variableDeclaration, 'no-unused-vars', `'${nombre}' se captura pero no se usa (caughtErrors).`);
    }
    if (esCliente && ts.isCallExpression(n) && n.expression.getText(sf).startsWith('console.')) reportar(sf, n, 'no-console', 'Evite console.* en el cliente.', 'warning');
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
}

hallazgos.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
const errores = hallazgos.filter((h) => h.severidad === 'error').length;
const avisos = hallazgos.length - errores;
let texto = '';
for (const h of hallazgos) texto += `${h.archivo}:${h.linea}:${h.columna}  ${h.severidad.padEnd(7)} ${h.regla.padEnd(15)} ${h.mensaje}\n`;
texto += `\n✖ ${hallazgos.length} problemas (${errores} errores, ${avisos} advertencias) en ${lista.length} archivos\n`;
console.log(texto);
if (process.env.PRELINT_SALIDA) fs.writeFileSync(process.env.PRELINT_SALIDA, JSON.stringify({ archivos: lista.length, errores, avisos, hallazgos }, null, 2));
process.exit(errores ? 1 : 0);
