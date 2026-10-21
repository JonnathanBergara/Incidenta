/**
 * config/index.js — Configuración centralizada (solo variables de entorno)
 *
 * Ningún secreto vive en el código. JWT_SECRET es obligatorio (mínimo 32
 * caracteres): si falta, el servidor se niega a arrancar en vez de usar un
 * valor por defecto que cualquiera podría adivinar.
 */

const env = process.env;

function entero(nombre, defecto) {
  const n = Number.parseInt(env[nombre], 10);
  return Number.isFinite(n) && n > 0 ? n : defecto;
}

const ROLES = Object.freeze(['admin', 'analista', 'lector']);

const config = {
  entorno: env.NODE_ENV || 'development',
  puerto: entero('PORT', 3000),
  databaseUrl: env.DATABASE_URL,
  jwt: {
    secret: env.JWT_SECRET,
    expiraEnSegundos: entero('JWT_EXPIRES_IN', 3600),
    issuer: 'incidenta-api',
    audience: 'incidenta-client'
  },
  // Lista blanca de orígenes para CORS, separados por comas. Vacía = solo mismo origen.
  corsOrigenes: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  tls: { key: env.TLS_KEY_PATH, cert: env.TLS_CERT_PATH },
  forzarHttps: env.FORCE_HTTPS === 'true',
  urlPublica: env.PUBLIC_URL || '',            // p. ej. https://incidenta.ejemplo.com
  proxiesConfiables: entero('TRUST_PROXY', 0), // nº de proxies inversos delante (0 = ninguno)
  limiteCuerpo: '10kb',
  loginMaxIntentos: entero('LOGIN_MAX_ATTEMPTS', 10),
  loginVentanaMs: entero('LOGIN_WINDOW_MS', 15 * 60 * 1000)
};

function validarConfig() {
  if (config.entorno === 'production' && !config.databaseUrl) {
    throw new Error('DATABASE_URL es obligatorio en producción.');
  }
  if (config.entorno === 'production') {
    for (const variable of ['SEED_ADMIN_PASSWORD', 'SEED_ANALISTA_PASSWORD', 'SEED_LECTOR_PASSWORD']) {
      const password = env[variable] || '';
      if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        throw new Error(`${variable} debe tener al menos 12 caracteres, letras y números.`);
      }
    }
  }
  if (!config.jwt.secret || config.jwt.secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está definido o es demasiado corto (mínimo 32 caracteres). ' +
      'Genere uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  if (config.entorno === 'production' && !config.forzarHttps) {
    console.warn('[config] Aviso: NODE_ENV=production sin FORCE_HTTPS=true.');
  }
}

module.exports = { config, ROLES, validarConfig };
