/**
 * reglas.mjs — Reglas de negocio del cliente (funciones puras, sin DOM ni red)
 *
 * Todo lo que "decide" algo vive aquí para poder probarlo con pruebas
 * unitarias en Node: permisos por rol, filtrado, estadísticas, fechas y
 * vigencia de la sesión. La vista solo pinta; el controlador solo conecta.
 */

// Permisos SOLO para adaptar la interfaz; el servidor es quien los hace cumplir.
export const PERMISOS = Object.freeze({
  lector: Object.freeze({ crear: false, actualizar: false, eliminar: false }),
  analista: Object.freeze({ crear: true, actualizar: true, eliminar: false }),
  admin: Object.freeze({ crear: true, actualizar: true, eliminar: true })
});

const CLASE_ESTADO = Object.freeze({ Abierto: 'abierto', 'En progreso': 'progress', Resuelto: 'resuelto' });
const CLASE_PRIORIDAD = Object.freeze({ Alta: 'alta', Media: 'media', Baja: 'baja' });

export const ESTADO_FINAL = 'Resuelto';

export function puede(rol, accion) {
  return Object.hasOwn(PERMISOS, rol) && PERMISOS[rol][accion] === true;
}

export function claseEstado(estado) {
  return Object.hasOwn(CLASE_ESTADO, estado) ? CLASE_ESTADO[estado] : 'abierto';
}

export function clasePrioridad(prioridad) {
  return Object.hasOwn(CLASE_PRIORIDAD, prioridad) ? CLASE_PRIORIDAD[prioridad] : 'baja';
}

/** Un incidente "requiere atención" mientras no esté resuelto. */
export const requiereAtencion = (incidente) => incidente.status !== ESTADO_FINAL;

export function calcularEstadisticas(incidentes) {
  return {
    total: incidentes.length,
    abiertos: incidentes.filter(requiereAtencion).length,
    criticos: incidentes.filter((i) => i.priority === 'Alta' && requiereAtencion(i)).length,
    resueltos: incidentes.filter((i) => i.status === ESTADO_FINAL).length
  };
}

export function filtrarIncidentes(incidentes, { busqueda = '', estado = 'all', prioridad = 'all' } = {}) {
  const texto = busqueda.trim().toLowerCase();
  return incidentes.filter((i) => {
    const coincideTexto = !texto || `${i.title} ${i.category}`.toLowerCase().includes(texto);
    const coincideEstado = estado === 'all' || i.status === estado;
    const coincidePrioridad = prioridad === 'all' || i.priority === prioridad;
    return coincideTexto && coincideEstado && coincidePrioridad;
  });
}

export const textoResultados = (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`;

const dos = (n) => String(n).padStart(2, '0');

/**
 * Fecha AAAA-MM-DD en la zona horaria LOCAL del usuario.
 * (toISOString() usa UTC: en Ecuador, a partir de las 19:00 ya devolvía "mañana".)
 */
export function fechaLocalISO(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Texto del encabezado, p. ej. "16 octubre 2026". */
export function encabezadoFecha(fecha = new Date(), idioma = 'es') {
  const mes = new Intl.DateTimeFormat(idioma, { month: 'long' }).format(fecha);
  return `${dos(fecha.getDate())} ${mes} ${fecha.getFullYear()}`;
}

export function formatearFecha(valor, idioma = 'es-ES') {
  return new Intl.DateTimeFormat(idioma, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${valor}T12:00:00`));
}

export function sesionVigente(sesion, ahora = Date.now()) {
  return Boolean(sesion && sesion.token && sesion.usuario && sesion.expiraEn > ahora);
}
