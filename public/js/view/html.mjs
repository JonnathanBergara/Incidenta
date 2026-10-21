/** html.mjs — Escapado de texto del servidor antes de insertarlo como HTML. */
const REEMPLAZOS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' };
export const escapeHtml = (valor) => String(valor).replace(/[&<>'"]/g, (c) => REEMPLAZOS[c]);
