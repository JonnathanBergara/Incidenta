/**
 * errorHandler.js — Manejo de errores centralizado
 *
 * Regla de seguridad: el cliente NUNCA recibe mensajes internos (SQL, rutas,
 * trazas) en errores 5xx; eso se registra en el servidor. Los errores 4xx
 * llevan solo mensajes pensados para el usuario.
 */

function notFound(req, res, next) {
  next({ status: 404, message: 'Recurso no encontrado.' });
}

function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let mensaje = err.message;

  // Errores del parser JSON de Express (cuerpo mal formado o demasiado grande)
  if (err.type === 'entity.parse.failed') { status = 400; mensaje = 'El cuerpo de la petición no es JSON válido.'; }
  if (err.type === 'entity.too.large') { status = 413; mensaje = 'El cuerpo de la petición es demasiado grande.'; }

  if (status >= 500) {
    console.error(`[ERROR ${status}]`, err.stack || err.message || err);
    mensaje = 'Error interno del servidor.';
  }
  if (err.headers) for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);

  const cuerpo = { error: mensaje || 'Error' };
  if (err.detalles) cuerpo.detalles = err.detalles;
  res.status(status).json(cuerpo);
}

module.exports = { notFound, errorHandler };
