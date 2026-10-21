/**
 * auth.js — Autenticación (JWT) y autorización (roles)
 *
 *   authenticate : exige "Authorization: Bearer <token>" válido. Tras verificar
 *                  la firma, consulta la base de datos: el usuario debe seguir
 *                  existiendo y activo, y el ROL se toma de la base (no del
 *                  token), de modo que desactivar o degradar a alguien surte
 *                  efecto de inmediato aunque su token no haya expirado.
 *   authorize    : permite el paso solo a los roles indicados (403 si no).
 */

const { verify } = require('../utils/jwt');
const usuarios = require('../models/usuario.model');

function noAutenticado(mensaje) {
  return { status: 401, message: mensaje, headers: { 'WWW-Authenticate': 'Bearer' } };
}

async function authenticate(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [esquema, token, ...resto] = cabecera.split(' ');
  if (esquema !== 'Bearer' || !token || resto.length) {
    return next(noAutenticado('Se requiere autenticación: envíe la cabecera Authorization: Bearer <token>.'));
  }
  let payload;
  try {
    payload = verify(token);
  } catch (err) {
    if (err.code === 'expired') return next(noAutenticado('El token ha expirado. Inicie sesión de nuevo.'));
    if (err.code === 'invalid') return next(noAutenticado('Token inválido.'));
    return next(err);
  }
  try {
    const usuario = await usuarios.getById(payload.sub);
    if (!usuario || !usuario.activo) return next(noAutenticado('Token inválido.'));
    req.user = { id: usuario.id, username: usuario.username, role: usuario.role };
    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return next(noAutenticado('Se requiere autenticación.'));
    if (!rolesPermitidos.includes(req.user.role)) {
      return next({ status: 403, message: 'Su rol no tiene permiso para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
