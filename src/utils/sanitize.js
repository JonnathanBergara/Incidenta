/**
 * sanitize.js — Limpieza de texto de entrada
 *
 * El texto se guarda como TEXTO PLANO (sin HTML) y se escapa al mostrarlo en
 * el cliente. Aquí se elimina lo que nunca debería llegar a la base de datos:
 * etiquetas HTML, caracteres de control y espacios sobrantes.
 */

const ETIQUETAS = /<\/?[a-zA-Z!][^>]*>?/g;          // <script>, </b>, <img src=x onerror=...
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function limpiarTexto(valor, { multilinea = false } = {}) {
  let texto = String(valor).normalize('NFC').replace(CONTROL, '').replace(ETIQUETAS, '');
  texto = multilinea
    ? texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : texto.replace(/\s+/g, ' ');
  return texto.trim();
}

// Escapa los comodines de LIKE para que la búsqueda sea literal.
function escaparLike(valor) {
  return valor.replace(/[\\%_]/g, '\\$&');
}

module.exports = { limpiarTexto, escaparLike };
