/**
 * validators.js — Validación de esquemas (lista blanca, sin dependencias)
 *
 * Reglas generales:
 *  - Solo se aceptan los campos declarados; cualquier otro se rechaza
 *    (evita "mass assignment": enviar role, id, created_at, etc.).
 *  - Todos los valores deben ser cadenas; objetos o arreglos se rechazan.
 *  - El texto se limpia (sanitize.js) ANTES de medir longitudes.
 *  - Cada función devuelve { valor, errores } con errores [{ campo, mensaje }].
 */

const { limpiarTexto } = require('./sanitize');
const { ROLES } = require('../config');

const CATEGORIAS = ['Infraestructura', 'Aplicación', 'Seguridad', 'Acceso', 'Otro'];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];
const ESTADOS = ['Abierto', 'En progreso', 'Resuelto'];

const RE_EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const RE_USUARIO = /^[a-z0-9._-]{3,32}$/;

function esFechaReal(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && a >= 2000 && a <= 2100;
}

function esObjetoPlano(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

// Revisa tipo y campos desconocidos. Devuelve el objeto o null si hubo errores.
function revisarForma(body, permitidos, errores) {
  if (!esObjetoPlano(body)) {
    errores.push({ campo: 'body', mensaje: 'El cuerpo debe ser un objeto JSON.' });
    return null;
  }
  for (const clave of Object.keys(body)) {
    if (!permitidos.includes(clave)) {
      errores.push({ campo: limpiarTexto(clave).slice(0, 40), mensaje: 'Campo no permitido.' });
    } else if (typeof body[clave] !== 'string') {
      errores.push({ campo: clave, mensaje: 'Debe ser texto.' });
    }
  }
  return errores.length ? null : body;
}

/**
 * Incidentes.
 * modo 'crear'      : title, category y priority obligatorios.
 * modo 'reemplazar' : (PUT)   igual que crear.
 * modo 'parcial'    : (PATCH) al menos un campo; los presentes se validan.
 */
function validarIncidente(body, modo) {
  const errores = [];
  const campos = ['title', 'category', 'priority', 'status', 'date', 'email', 'description'];
  const entrada = revisarForma(body, campos, errores);
  if (!entrada) return { errores };

  const valor = {};
  const tiene = (c) => Object.prototype.hasOwnProperty.call(entrada, c);
  const obligatorio = modo !== 'parcial';

  if (tiene('title') || obligatorio) {
    const t = limpiarTexto(entrada.title ?? '');
    if (t.length < 3 || t.length > 80) errores.push({ campo: 'title', mensaje: 'El título debe tener entre 3 y 80 caracteres.' });
    else valor.title = t;
  }
  if (tiene('category') || obligatorio) {
    const c = limpiarTexto(entrada.category ?? '');
    if (!CATEGORIAS.includes(c)) errores.push({ campo: 'category', mensaje: `La categoría debe ser una de: ${CATEGORIAS.join(', ')}.` });
    else valor.category = c;
  }
  if (tiene('priority') || obligatorio) {
    const p = limpiarTexto(entrada.priority ?? '');
    if (!PRIORIDADES.includes(p)) errores.push({ campo: 'priority', mensaje: `La prioridad debe ser una de: ${PRIORIDADES.join(', ')}.` });
    else valor.priority = p;
  }
  if (tiene('status')) {
    const s = limpiarTexto(entrada.status);
    if (!ESTADOS.includes(s)) errores.push({ campo: 'status', mensaje: `El estado debe ser uno de: ${ESTADOS.join(', ')}.` });
    else valor.status = s;
  }
  if (tiene('date')) {
    const d = limpiarTexto(entrada.date);
    if (!esFechaReal(d)) errores.push({ campo: 'date', mensaje: 'La fecha debe ser real y tener formato AAAA-MM-DD.' });
    else valor.date = d;
  }
  if (tiene('email')) {
    const e = limpiarTexto(entrada.email).toLowerCase();
    if (e === '') valor.email = null;
    else if (e.length > 120 || !RE_EMAIL.test(e)) errores.push({ campo: 'email', mensaje: 'El email no es válido.' });
    else valor.email = e;
  }
  if (tiene('description')) {
    const d = limpiarTexto(entrada.description, { multilinea: true });
    if (d.length > 500) errores.push({ campo: 'description', mensaje: 'La descripción no puede superar 500 caracteres.' });
    else valor.description = d === '' ? null : d;
  }
  if (modo === 'parcial' && errores.length === 0 && Object.keys(valor).length === 0) {
    errores.push({ campo: 'body', mensaje: 'Debe enviar al menos un campo para actualizar.' });
  }
  return errores.length ? { errores } : { valor, errores };
}

function validarLogin(body) {
  const errores = [];
  const entrada = revisarForma(body, ['username', 'password'], errores);
  if (!entrada) return { errores };
  const username = limpiarTexto(entrada.username ?? '').toLowerCase();
  const password = entrada.password ?? '';
  if (!RE_USUARIO.test(username)) errores.push({ campo: 'username', mensaje: 'Usuario con formato inválido.' });
  if (password.length < 1 || password.length > 128) errores.push({ campo: 'password', mensaje: 'Contraseña obligatoria (máximo 128 caracteres).' });
  return errores.length ? { errores } : { valor: { username, password }, errores };
}

function validarNuevoUsuario(body) {
  const errores = [];
  const entrada = revisarForma(body, ['username', 'email', 'password', 'role'], errores);
  if (!entrada) return { errores };
  const username = limpiarTexto(entrada.username ?? '').toLowerCase();
  const password = entrada.password ?? '';
  const role = limpiarTexto(entrada.role ?? '');
  const email = limpiarTexto(entrada.email ?? '').toLowerCase();
  if (!RE_USUARIO.test(username)) errores.push({ campo: 'username', mensaje: 'Use 3-32 caracteres: letras minúsculas, números, punto, guion o guion bajo.' });
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errores.push({ campo: 'password', mensaje: 'La contraseña debe tener entre 10 y 128 caracteres, con letras y números.' });
  }
  if (!ROLES.includes(role)) errores.push({ campo: 'role', mensaje: `El rol debe ser uno de: ${ROLES.join(', ')}.` });
  if (email !== '' && (email.length > 120 || !RE_EMAIL.test(email))) errores.push({ campo: 'email', mensaje: 'El email no es válido.' });
  return errores.length ? { errores } : { valor: { username, password, role, email: email || null }, errores };
}

// Filtros de consulta del listado: solo valores de la lista blanca.
function validarFiltros(query) {
  const errores = [];
  const valor = { page: 1, limit: 50 };
  const q = esObjetoPlano(query) ? query : {};
  const uno = (v) => (typeof v === 'string' ? v : undefined);

  const status = uno(q.status), priority = uno(q.priority), search = uno(q.search);
  const page = uno(q.page), limit = uno(q.limit);
  if (q.status !== undefined && (status === undefined || (status !== 'all' && !ESTADOS.includes(status)))) errores.push({ campo: 'status', mensaje: 'Estado de filtro inválido.' });
  else if (status && status !== 'all') valor.status = status;
  if (q.priority !== undefined && (priority === undefined || (priority !== 'all' && !PRIORIDADES.includes(priority)))) errores.push({ campo: 'priority', mensaje: 'Prioridad de filtro inválida.' });
  else if (priority && priority !== 'all') valor.priority = priority;
  if (q.search !== undefined) {
    if (search === undefined) errores.push({ campo: 'search', mensaje: 'La búsqueda debe ser texto.' });
    else {
      const s = limpiarTexto(search);
      if (s.length > 60) errores.push({ campo: 'search', mensaje: 'La búsqueda admite hasta 60 caracteres.' });
      else if (s) valor.search = s;
    }
  }
  if (q.page !== undefined) {
    if (page === undefined || !/^[1-9]\d{0,6}$/.test(page)) {
      errores.push({ campo: 'page', mensaje: 'La página debe ser un entero positivo.' });
    } else valor.page = Number(page);
  }
  if (q.limit !== undefined) {
    if (limit === undefined || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100) {
      errores.push({ campo: 'limit', mensaje: 'El límite debe ser un entero entre 1 y 100.' });
    } else valor.limit = Number(limit);
  }
  return errores.length ? { errores } : { valor, errores };
}

module.exports = { validarIncidente, validarLogin, validarNuevoUsuario, validarFiltros, CATEGORIAS, PRIORIDADES, ESTADOS };
