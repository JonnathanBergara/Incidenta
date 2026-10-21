/**
 * api.mjs — Cliente HTTP de la API (agrega el token y traduce los errores)
 *
 * No toca el DOM: recibe fetch, el token y qué hacer ante un 401 por
 * parámetro, de modo que se puede probar con un fetch falso.
 */

export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles || [];
  }
}

export function mensajeDeError(error) {
  if (!(error instanceof ErrorApi)) return 'Ocurrió un error inesperado.';
  if (error.estado === 403) return 'No tiene permisos para realizar esta acción.';
  if (error.detalles.length) return `${error.message} ${error.detalles.map((d) => `${d.campo}: ${d.mensaje}`).join(' ')}`;
  return error.message;
}

export function crearClienteApi({ fetchFn, obtenerToken = () => null, alSesionInvalida = () => {}, baseApi = '/api/incidentes', baseAuth = '/api/auth' }) {
  async function api(metodo, ruta = '', cuerpo) {
    const headers = {};
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    const token = obtenerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let respuesta;
    try {
      respuesta = await fetchFn(baseApi + ruta, { method: metodo, headers, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    } catch {
      throw new ErrorApi(0, 'No se pudo contactar al servidor.');
    }
    const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      if (respuesta.status === 401) alSesionInvalida();
      throw new ErrorApi(respuesta.status, (datos && datos.error) || `Error HTTP ${respuesta.status}`, datos && datos.detalles);
    }
    return datos;
  }

  async function login(username, password) {
    let respuesta;
    try {
      respuesta = await fetchFn(`${baseAuth}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch {
      throw new ErrorApi(0, 'No se pudo contactar al servidor.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const mensaje = respuesta.status === 429
        ? 'Demasiados intentos. Espere unos minutos e intente de nuevo.'
        : (datos.error || 'No se pudo iniciar sesión.');
      throw new ErrorApi(respuesta.status, mensaje);
    }
    return datos;
  }

  return { api, login };
}
