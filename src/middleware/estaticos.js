/**
 * estaticos.js — Política de caché de los archivos de public/
 *
 *  - HTML, CSS y JS: "no-cache" = se guardan pero se REVALIDAN siempre con ETag
 *    (respuesta 304 sin cuerpo si no cambiaron). Así un despliegue nuevo se ve
 *    de inmediato y los módulos del cliente nunca quedan mezclados.
 *  - Imágenes y fuentes: un día, sin revalidar.
 */

const path = require('path');

const IMAGENES = new Set(['.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.woff2']);

function cabecerasEstaticas(res, rutaArchivo) {
  const ext = path.extname(rutaArchivo).toLowerCase();
  res.setHeader('Cache-Control', IMAGENES.has(ext) ? 'public, max-age=86400' : 'no-cache');
}

module.exports = { cabecerasEstaticas };
