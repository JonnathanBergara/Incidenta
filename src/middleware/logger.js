/**
 * logger.js — Registro de peticiones (método, ruta sin query, estado, usuario, tiempo)
 *
 * No se registra la query string ni cabeceras: podrían contener datos
 * sensibles. Los 401/403 quedan visibles para auditar intentos de acceso.
 */

function logger(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    const ruta = (req.originalUrl || req.url).split('?')[0];
    const usuario = req.user ? req.user.username : 'anónimo';
    console.log(`[${new Date().toISOString()}] ${req.method} ${ruta} -> ${res.statusCode} usuario=${usuario} (${Date.now() - inicio} ms)`);
  });
  next();
}

module.exports = logger;
