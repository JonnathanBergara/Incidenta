/**
 * validate.js — Middlewares de validación y limpieza de entradas
 * Dejan el dato ya limpio en req.datos / req.filtros / req.idNumerico.
 */

const v = require('../utils/validators');

function responder(next, errores) {
  return next({ status: 400, message: 'Datos de entrada inválidos.', detalles: errores });
}

const validarId = (req, res, next) => {
  const id = req.params.id;
  if (!/^[1-9]\d{0,9}$/.test(String(id))) {
    return responder(next, [{ campo: 'id', mensaje: 'El identificador debe ser un entero positivo.' }]);
  }
  req.idNumerico = Number(id);
  next();
};

const desde = (fn, ...args) => (req, res, next) => {
  const { valor, errores } = fn(req.body, ...args);
  if (errores.length) return responder(next, errores);
  req.datos = valor;
  next();
};

const validarFiltros = (req, res, next) => {
  const { valor, errores } = v.validarFiltros(req.query);
  if (errores.length) return responder(next, errores);
  req.filtros = valor;
  next();
};

module.exports = {
  validarId,
  validarFiltros,
  validarCrearIncidente: desde(v.validarIncidente, 'crear'),
  validarReemplazarIncidente: desde(v.validarIncidente, 'reemplazar'),
  validarActualizarIncidente: desde(v.validarIncidente, 'parcial'),
  validarLogin: desde(v.validarLogin),
  validarNuevoUsuario: desde(v.validarNuevoUsuario)
};
