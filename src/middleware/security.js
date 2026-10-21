/**
 * security.js — Cabeceras de seguridad, CORS por lista blanca y HTTPS
 */

const { config } = require('../config');

function cabecerasSeguridad(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  if ((req.originalUrl || req.url || '').startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * CORS: solo los orígenes de CORS_ORIGINS reciben cabeceras Access-Control-*.
 * Nunca "*". No se permiten credenciales/cookies: el token viaja en la
 * cabecera Authorization, que el navegador no adjunta por sí solo.
 */
function cors(req, res, next) {
  const origen = req.headers.origin;
  if (!origen) return next();                       // petición sin Origin (curl, mismo origen simple)

  const permitido = config.corsOrigenes.includes(origen);
  res.setHeader('Vary', 'Origin');
  if (permitido) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
    if (!permitido) return next({ status: 403, message: 'Origen no permitido por la política CORS.' });
    return res.status(204).end();
  }
  next();
}

/**
 * HTTPS obligatorio (FORCE_HTTPS=true). Si PUBLIC_URL está definida se
 * redirige allí (nunca se usa la cabecera Host, que el cliente controla);
 * si no, se responde 426 Upgrade Required.
 */
function exigirHttps(req, res, next) {
  if (!config.forzarHttps || req.secure) return next();
  if (config.urlPublica) return res.redirect(308, config.urlPublica.replace(/\/$/, '') + req.originalUrl);
  return next({ status: 426, message: 'Esta API solo acepta conexiones HTTPS.' });
}

module.exports = { cabecerasSeguridad, cors, exigirHttps };
