/**
 * app.controller.mjs — Controlador: conecta eventos de la vista con el modelo.
 */

import { calcularEstadisticas, ESTADO_FINAL } from '../model/reglas.mjs';
import { ErrorApi, mensajeDeError } from '../model/api.mjs';

/** Agrupa pulsaciones seguidas: ejecuta `fn` una sola vez tras `espera` ms de calma. */
export function debounce(fn, espera) {
  let temporizador = null;
  return (...args) => {
    globalThis.clearTimeout(temporizador);
    temporizador = globalThis.setTimeout(() => fn(...args), espera);
  };
}

export const ESPERA_BUSQUEDA_MS = 200;

export class AppController {
  constructor({ sesion, modelo, vista, api, ventana = globalThis }) {
    Object.assign(this, { sesion, modelo, vista, api, ventana });
    this.seleccionado = null;
    this.modelo.suscribir(() => this.pintar());
  }

  pintar() {
    const items = this.modelo.items;
    this.vista.pintarLista(items, {
      pagina: this.modelo.pagina,
      totalPaginas: this.modelo.totalPaginas,
      total: this.modelo.total
    });
    this.vista.pintarEstadisticas(this.modelo.estadisticas || calcularEstadisticas(items));
  }

  async cargarPagina(pagina, filtros = this.modelo.filtros) {
    try {
      await this.modelo.cargar({ pagina, filtros });
      this.vista.mostrarAviso('');
    } catch (error) {
      this.#informar(error, (t) => this.vista.mostrarAviso(t));
    }
  }

  aplicarPermisos() { this.vista.pintarSesion(this.sesion.actual, this.sesion.puede('crear')); }

  cerrarSesion(mensaje) {
    this.sesion.cerrar();
    this.vista.cerrarDetalle();
    this.modelo.vaciar();
    this.aplicarPermisos();
    this.vista.abrirLogin(mensaje);
  }

  /** Muestra el error en `mostrar`, salvo un 401 (ya se redirigió al acceso). */
  #informar(error, mostrar) {
    if (!(error instanceof ErrorApi) || error.estado !== 401) mostrar(mensajeDeError(error));
  }

  async cargar() {
    try {
      await this.modelo.cargar();
      this.vista.mostrarAviso('');
    } catch (error) {
      this.#informar(error, (t) => this.vista.mostrarAviso(t));
    }
  }

  async iniciarSesion() {
    this.vista.errorLogin('');
    const { username, password } = this.vista.credenciales();
    if (!username || !password) { this.vista.errorLogin('Escriba usuario y contraseña.'); return; }
    try {
      this.sesion.guardar(await this.api.login(username, password));
    } catch (error) {
      this.vista.errorLogin(error.message);
      return;
    }
    this.vista.cerrarLogin();
    this.aplicarPermisos();
    this.cargar();
  }

  async registrar() {
    this.vista.mensajeFormulario('');
    if (!this.sesion.puede('crear') || this.modelo.enviando) return;
    const datos = this.vista.leerFormulario();
    if (!datos) return;
    this.vista.marcarEnviando(true, true);
    try {
      const creado = await this.modelo.crear(datos);    // el servidor valida, limpia y asigna id
      if (creado) {
        this.vista.mostrarAviso('');
        this.vista.mensajeFormulario('Incidente registrado correctamente.');
        this.vista.limpiarFormulario();
      }
    } catch (error) {
      this.#informar(error, (t) => this.vista.mensajeFormulario(t));   // sin éxito falso: el dato NO se guarda
    } finally {
      this.vista.marcarEnviando(false, this.sesion.puede('crear'));
    }
  }

  abrirDetalle(id) {
    const incidente = this.modelo.porId(id);
    if (!incidente) return;
    this.seleccionado = Number(id);
    this.vista.abrirDetalle(incidente, {
      puedeActualizar: this.sesion.puede('actualizar'),
      puedeEliminar: this.sesion.puede('eliminar'),
      resuelto: incidente.status === ESTADO_FINAL
    });
  }

  cerrarDetalle() { this.vista.cerrarDetalle(); this.seleccionado = null; }

  async #operarSeleccionado(operacion) {
    const id = this.seleccionado;
    if (!id) return;
    try {
      await operacion(id);
      this.vista.mostrarAviso('');
      this.cerrarDetalle();
    } catch (error) {
      this.#informar(error, (t) => { this.cerrarDetalle(); this.vista.mostrarAviso(t); });
    }
  }

  resolver() { return this.#operarSeleccionado((id) => this.modelo.resolver(id)); }

  eliminar() {
    if (!this.seleccionado || !this.ventana.confirm('¿Eliminar este incidente de forma permanente?')) return undefined;
    return this.#operarSeleccionado((id) => this.modelo.eliminar(id));
  }

  enlazar(doc = document) {
    const v = this.vista;
    const q = (s) => doc.querySelector(s);
    const aplicarFiltros = debounce(() => this.cargarPagina(1, v.filtros()), ESPERA_BUSQUEDA_MS);
    v.busqueda.addEventListener('input', aplicarFiltros);
    v.filtroEstado.addEventListener('change', () => this.cargarPagina(1, v.filtros()));
    v.filtroPrioridad.addEventListener('change', () => this.cargarPagina(1, v.filtros()));
    v.paginaAnterior.addEventListener('click', () => this.cargarPagina(this.modelo.pagina - 1));
    v.paginaSiguiente.addEventListener('click', () => this.cargarPagina(this.modelo.pagina + 1));
    v.lista.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-id]');
      if (boton) this.abrirDetalle(Number(boton.dataset.id));
    });
    v.form.addEventListener('submit', (e) => { e.preventDefault(); this.registrar(); });
    v.loginForm.addEventListener('submit', (e) => { e.preventDefault(); this.iniciarSesion(); });
    v.login.addEventListener('cancel', (e) => { if (!this.sesion.activa) e.preventDefault(); });
    q('#logout-button').addEventListener('click', () => this.cerrarSesion('Sesión cerrada.'));
    q('.dialog-close').addEventListener('click', () => this.cerrarDetalle());
    q('#close-detail').addEventListener('click', () => this.cerrarDetalle());
    q('#resolve-detail').addEventListener('click', () => this.resolver());
    q('#delete-detail').addEventListener('click', () => this.eliminar());
    v.detalle.addEventListener('click', (e) => { if (e.target === v.detalle) this.cerrarDetalle(); });
  }

  arrancar() {
    this.vista.pintarFechas();
    this.enlazar();
    this.aplicarPermisos();
    if (this.sesion.activa) this.cargar();
    else this.vista.abrirLogin();
  }
}
