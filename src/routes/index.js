/**
 * routes/index.js — Registra en Express las rutas de definiciones.js
 */

const { Router } = require('express');
const { montajes } = require('./definiciones');

function montarRutas(app) {
  for (const { prefijo, rutas } of montajes) {
    const router = Router();
    for (const { metodo, ruta, handlers } of rutas) router[metodo](ruta, ...handlers);
    app.use(prefijo, router);
  }
}

module.exports = { montarRutas };
