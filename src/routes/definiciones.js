/**
 * definiciones.js — Tabla de rutas con su cadena de middleware
 *
 * Es la ÚNICA fuente de verdad sobre quién puede hacer qué. La usan tanto
 * los routers de Express como el arnés de pruebas (tests/harness.js), de
 * modo que lo que se prueba es exactamente lo que se ejecuta en producción.
 *
 * Matriz de permisos:
 *   lector   : consultar (GET)
 *   analista : consultar + crear + actualizar (POST, PUT, PATCH)
 *   admin    : todo lo anterior + eliminar (DELETE) + crear usuarios
 */

const incidentes = require('../controllers/incidentes.controller');
const auth = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');
const val = require('../middleware/validate');
const { crearLimitador } = require('../middleware/rateLimit');
const { config } = require('../config');

const limitadorLogin = crearLimitador({ ventanaMs: config.loginVentanaMs, maximo: config.loginMaxIntentos });

const LEER = [authenticate, authorize('lector', 'analista', 'admin')];
const ESCRIBIR = [authenticate, authorize('analista', 'admin')];
const BORRAR = [authenticate, authorize('admin')];

const rutasIncidentes = [
  { metodo: 'get',    ruta: '/',    handlers: [...LEER, val.validarFiltros, incidentes.listar] },
  { metodo: 'get',    ruta: '/:id', handlers: [...LEER, val.validarId, incidentes.obtener] },
  { metodo: 'post',   ruta: '/',    handlers: [...ESCRIBIR, val.validarCrearIncidente, incidentes.crear] },
  { metodo: 'put',    ruta: '/:id', handlers: [...ESCRIBIR, val.validarId, val.validarReemplazarIncidente, incidentes.actualizar] },
  { metodo: 'patch',  ruta: '/:id', handlers: [...ESCRIBIR, val.validarId, val.validarActualizarIncidente, incidentes.actualizar] },
  { metodo: 'delete', ruta: '/:id', handlers: [...BORRAR, val.validarId, incidentes.eliminar] }
];

const rutasAuth = [
  { metodo: 'post', ruta: '/login',    handlers: [limitadorLogin, val.validarLogin, auth.login] },
  { metodo: 'get',  ruta: '/me',       handlers: [authenticate, auth.perfil] },
  { metodo: 'post', ruta: '/usuarios', handlers: [...BORRAR, val.validarNuevoUsuario, auth.crearUsuario] }
];

module.exports = {
  montajes: [
    { prefijo: '/api/incidentes', rutas: rutasIncidentes },
    { prefijo: '/api/auth', rutas: rutasAuth }
  ],
  limitadorLogin
};
