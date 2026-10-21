/**
 * incidentes.controller.js — Lógica de cada operación del CRUD
 *
 * Los datos llegan ya validados y limpios desde src/middleware/validate.js
 * (req.datos, req.filtros, req.idNumerico). Los errores se delegan con
 * next(error); los de la base de datos se registran en el servidor y al
 * cliente se le devuelve un mensaje genérico (sin SQL ni nombres de tablas).
 */

const modelo = require('../models/incidente.model');

function esErrorDeRestriccion(err) {
  return ['23502', '23514', '23503'].includes(err.code);
}

function manejarErrorDb(err, next) {
  if (esErrorDeRestriccion(err)) {
    console.warn('[db] Restricción violada:', err.message);
    return next({ status: 400, message: 'Los datos no cumplen las reglas de integridad.' });
  }
  return next(err);
}

const noExiste = (next) => next({ status: 404, message: 'No existe un incidente con ese identificador.' });

async function listar(req, res, next) {
  try {
    res.json(await modelo.getPagina(req.filtros || {}));
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const incidente = await modelo.getById(req.idNumerico);
    if (!incidente) return noExiste(next);
    res.json(incidente);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await modelo.create(req.datos));
  } catch (err) {
    manejarErrorDb(err, next);
  }
}

async function actualizar(req, res, next) {
  try {
    const actualizado = await modelo.update(req.idNumerico, req.datos);
    if (!actualizado) return noExiste(next);
    res.json(actualizado);
  } catch (err) {
    manejarErrorDb(err, next);
  }
}

async function eliminar(req, res, next) {
  try {
    if (!await modelo.remove(req.idNumerico)) return noExiste(next);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
