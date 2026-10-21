/**
 * rateLimit.js — Limitador de intentos en memoria (ventana fija por clave)
 * Frena la fuerza bruta contra /api/auth/login. Para varias instancias del
 * servidor habría que moverlo a un almacén compartido (p. ej. Redis).
 */

function crearLimitador({ ventanaMs, maximo, clave = (req) => req.ip || 'desconocido' }) {
  const contadores = new Map();

  function limitador(req, res, next) {
    const ahora = Date.now();
    const k = clave(req);
    let c = contadores.get(k);
    if (!c || c.reinicio <= ahora) { c = { cuenta: 0, reinicio: ahora + ventanaMs }; contadores.set(k, c); }
    c.cuenta++;
    if (c.cuenta > maximo) {
      const espera = Math.ceil((c.reinicio - ahora) / 1000);
      return next({ status: 429, message: 'Demasiados intentos. Intente de nuevo más tarde.', headers: { 'Retry-After': String(espera) } });
    }
    next();
  }
  limitador.reiniciar = () => contadores.clear();
  return limitador;
}

module.exports = { crearLimitador };
