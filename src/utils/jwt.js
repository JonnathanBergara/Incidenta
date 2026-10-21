/**
 * jwt.js — JSON Web Tokens firmados con HMAC-SHA256 (módulo nativo crypto)
 *
 * verify() es estricto: exige exactamente 3 segmentos, alg === 'HS256'
 * (rechaza "none" y cualquier algoritmo distinto), firma válida comparada en
 * tiempo constante, y las claims exp, iss y aud correctas.
 */

const crypto = require('crypto');
const { config } = require('../config');

class TokenError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const b64u = (valor) => Buffer.from(valor).toString('base64url');

function firmar(dato, secret) {
  return crypto.createHmac('sha256', secret).update(dato).digest('base64url');
}

function sign(payload) {
  const { secret, expiraEnSegundos, issuer, audience } = config.jwt;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = { ...payload, iat: ahora, exp: ahora + expiraEnSegundos, iss: issuer, aud: audience };
  const dato = `${b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64u(JSON.stringify(cuerpo))}`;
  return `${dato}.${firmar(dato, secret)}`;
}

function verify(token) {
  const { secret, issuer, audience } = config.jwt;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const partes = String(token).split('.');
  if (partes.length !== 3) throw new TokenError('invalid', 'Formato de token inválido');

  let cabecera, payload;
  try {
    cabecera = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  } catch {
    throw new TokenError('invalid', 'Token ilegible');
  }
  if (!cabecera || cabecera.alg !== 'HS256') throw new TokenError('invalid', 'Algoritmo no permitido');

  const esperada = Buffer.from(firmar(`${partes[0]}.${partes[1]}`, secret));
  const recibida = Buffer.from(partes[2]);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
    throw new TokenError('invalid', 'Firma inválida');
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new TokenError('expired', 'Token expirado');
  }
  if (payload.iss !== issuer || payload.aud !== audience) throw new TokenError('invalid', 'Emisor o audiencia inválidos');
  return payload;
}

module.exports = { sign, verify, TokenError };
