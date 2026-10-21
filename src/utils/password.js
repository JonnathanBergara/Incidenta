/**
 * password.js — Hash de contraseñas con scrypt (módulo nativo crypto)
 *
 * scrypt es una función de derivación "memory-hard" recomendada por OWASP
 * junto con bcrypt/argon2. Cada contraseña usa una sal aleatoria de 16 bytes
 * y el formato almacenado es autodescriptivo:
 *     scrypt$N$r$p$<sal base64>$<hash base64>
 * así los parámetros pueden subirse en el futuro sin invalidar hashes viejos.
 * La comparación usa timingSafeEqual para evitar ataques de temporización.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const N = 16384, R = 8, P = 1, LONGITUD = 64;

function empaquetar(sal, hash) {
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

async function hashPassword(password) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(password, sal, LONGITUD, { N, r: R, p: P });
  return empaquetar(sal, hash);
}

function hashPasswordSync(password) {
  const sal = crypto.randomBytes(16);
  return empaquetar(sal, crypto.scryptSync(password, sal, LONGITUD, { N, r: R, p: P }));
}

async function verificarPassword(password, almacenado) {
  const partes = String(almacenado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');
  const obtenido = await scrypt(password, Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p)
  });
  return obtenido.length === esperado.length && crypto.timingSafeEqual(obtenido, esperado);
}

// Hash de relleno: se verifica contra él cuando el usuario no existe, para
// que "usuario inexistente" y "contraseña incorrecta" tarden lo mismo.
let relleno;
function hashDeRelleno() {
  if (!relleno) relleno = hashPasswordSync('relleno-no-es-una-contraseña-real');
  return relleno;
}

module.exports = { hashPassword, hashPasswordSync, verificarPassword, hashDeRelleno };
