/**
 * incidentes.view.mjs — Vista: lee y escribe el DOM; no decide nada.
 */

import { escapeHtml } from './html.mjs';
import { claseEstado, clasePrioridad, formatearFecha, textoResultados, encabezadoFecha, fechaLocalISO } from '../model/reglas.mjs';

export class IncidentesView {
  constructor(doc = document) {
    const q = (s) => doc.querySelector(s);
    this.doc = doc;
    this.form = q('#incident-form');
    this.lista = q('#incident-list');
    this.vacio = q('#empty-state');
    this.busqueda = q('#search-input');
    this.filtroEstado = q('#status-filter');
    this.filtroPrioridad = q('#priority-filter');
    this.feedback = q('#form-feedback');
    this.fecha = q('#incident-date');
    this.detalle = q('#detail-dialog');
    this.login = q('#login-dialog');
    this.loginForm = q('#login-form');
    this.loginError = q('#login-error');
    this.aviso = q('#api-banner');
    this.barraSesion = q('#session-bar');
    this.paginaAnterior = q('#page-previous');
    this.paginaSiguiente = q('#page-next');
    this.infoPagina = q('#page-info');
    this.botonEnviar = this.form.querySelector('button[type="submit"]');
  }

  // ----- Encabezado y fecha por defecto (fecha LOCAL, no UTC) -----
  pintarFechas(ahora = new Date()) {
    this.doc.querySelector('#fecha-hoy').textContent = encabezadoFecha(ahora);
    this.fecha.value = fechaLocalISO(ahora);
  }

  // ----- Lista y estadísticas -----
  filtros() {
    return { busqueda: this.busqueda.value, estado: this.filtroEstado.value, prioridad: this.filtroPrioridad.value };
  }

  pintarLista(visibles, { pagina = 1, totalPaginas = 0, total = visibles.length } = {}) {
    this.lista.innerHTML = visibles.map((i) => `
      <tr>
        <td><span class="incident-name" title="${escapeHtml(i.title)}">${escapeHtml(i.title)}</span><span class="incident-category">${escapeHtml(i.category)}</span></td>
        <td><span class="priority priority-${clasePrioridad(i.priority)}" aria-label="Prioridad ${escapeHtml(i.priority)}">${escapeHtml(i.priority)}</span></td>
        <td><span class="status status-${claseEstado(i.status)}" aria-label="Estado ${escapeHtml(i.status)}">${escapeHtml(i.status)}</span></td>
        <td class="date-cell">${escapeHtml(formatearFecha(i.date))}</td>
        <td><button class="view-button" type="button" data-id="${Number(i.id)}">Ver detalle</button></td>
      </tr>
    `).join('');
    this.vacio.hidden = visibles.length > 0;
    this.doc.querySelector('#result-count').textContent = textoResultados(total);
    this.paginaAnterior.disabled = pagina <= 1;
    this.paginaSiguiente.disabled = totalPaginas === 0 || pagina >= totalPaginas;
    this.infoPagina.textContent = totalPaginas
      ? `Página ${pagina} de ${totalPaginas}`
      : 'Sin páginas';
  }

  pintarEstadisticas({ total, abiertos, criticos, resueltos }) {
    this.doc.querySelector('#total-incidents').textContent = total;
    this.doc.querySelector('#open-incidents').textContent = abiertos;
    this.doc.querySelector('#critical-incidents').textContent = criticos;
    this.doc.querySelector('#resolved-incidents').textContent = resueltos;
  }

  // ----- Sesión y permisos -----
  pintarSesion(sesion, puedeCrear) {
    this.barraSesion.hidden = !sesion;
    if (sesion) this.doc.querySelector('#session-user').textContent = `${sesion.usuario.username} · ${sesion.usuario.role}`;
    this.form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = !puedeCrear; });
    this.feedback.textContent = sesion && !puedeCrear ? 'Su rol (lector) solo permite consultar incidentes.' : '';
  }

  abrirLogin(mensaje) {
    this.loginError.textContent = mensaje || '';
    this.loginForm.reset();
    if (!this.login.open) this.login.showModal();
    this.doc.querySelector('#login-username').focus();
  }

  cerrarLogin() { this.loginForm.reset(); this.login.close(); }
  errorLogin(texto) { this.loginError.textContent = texto; }
  credenciales() { return { username: this.loginForm.elements.username.value.trim(), password: this.loginForm.elements.password.value }; }

  // ----- Formulario -----
  mostrarAviso(texto) { this.aviso.textContent = texto || ''; this.aviso.hidden = !texto; }
  mensajeFormulario(texto) { this.feedback.textContent = texto; }

  /** Desactiva solo el botón mientras hay un envío en curso (evita el doble clic). */
  marcarEnviando(enviando, puedeCrear) {
    this.botonEnviar.disabled = enviando || !puedeCrear;
    this.botonEnviar.setAttribute('aria-busy', String(enviando));
  }

  #limpiarErrores() {
    this.form.querySelectorAll('[aria-invalid="true"]').forEach((c) => c.removeAttribute('aria-invalid'));
    this.form.querySelectorAll('.field-error').forEach((m) => { m.textContent = ''; });
  }

  /** Devuelve los datos del formulario o null si hay campos inválidos. */
  leerFormulario() {
    this.#limpiarErrores();
    let primero = null;
    this.form.querySelectorAll('[required]').forEach((campo) => {
      if (campo.value.trim()) return;
      campo.setAttribute('aria-invalid', 'true');
      const error = this.doc.querySelector(`#${campo.id}-error`);
      if (error) error.textContent = 'Este campo es obligatorio.';
      if (!primero) primero = campo;
    });
    const email = this.form.elements.email;
    if (!email.validity.valid && email.value) {
      email.setAttribute('aria-invalid', 'true');
      if (!primero) primero = email;
      this.doc.querySelector('#reporter-email-error').textContent = 'Escribe un email válido.';
    }
    if (primero) { primero.focus(); return null; }
    const d = new FormData(this.form);
    return {
      title: d.get('title').trim(), category: d.get('category'), priority: d.get('priority'),
      date: d.get('date'), email: d.get('email').trim(), description: d.get('description').trim()
    };
  }

  limpiarFormulario() {
    this.form.reset();
    this.pintarFechas();
    this.doc.querySelector('#incidentes').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ----- Detalle -----
  abrirDetalle(i, { puedeActualizar, puedeEliminar, resuelto }) {
    const q = (s) => this.doc.querySelector(s);
    q('#detail-category').textContent = `${i.category} / Registrado por ${i.email || 'sin email'}`;
    q('#detail-title').textContent = i.title;
    q('#detail-meta').innerHTML = `<span>Prioridad: <strong>${escapeHtml(i.priority)}</strong></span><span>Estado: <strong>${escapeHtml(i.status)}</strong></span><span>${escapeHtml(formatearFecha(i.date))}</span>`;
    q('#detail-description').textContent = i.description || 'Sin descripción.';
    q('#resolve-detail').hidden = resuelto || !puedeActualizar;
    q('#delete-detail').hidden = !puedeEliminar;
    this.detalle.showModal();
  }

  cerrarDetalle() { if (this.detalle.open) this.detalle.close(); }
}
