/**
 * incidentes.model.mjs — Estado de los incidentes en el cliente + operaciones CRUD
 *
 * Mantiene la lista y avisa a quien se suscriba cuando cambia. La bandera
 * `enviando` evita que un doble clic cree el mismo incidente dos veces.
 */

import { ESTADO_FINAL } from './reglas.mjs';

export class IncidentesModel {
  constructor(api) {
    this.api = api;
    this.items = [];
    this.enviando = false;
    this.oyentes = [];
    this.pagina = 1;
    this.limite = 50;
    this.total = 0;
    this.totalPaginas = 0;
    this.filtros = {};
    this.estadisticas = { total: 0, abiertos: 0, criticos: 0, resueltos: 0 };
  }

  suscribir(oyente) { this.oyentes.push(oyente); }
  #avisar() { this.oyentes.forEach((o) => o(this.items)); }

  porId(id) { return this.items.find((i) => Number(i.id) === Number(id)); }

  vaciar() {
    this.items = [];
    this.pagina = 1;
    this.total = 0;
    this.totalPaginas = 0;
    this.filtros = {};
    this.estadisticas = { total: 0, abiertos: 0, criticos: 0, resueltos: 0 };
    this.#avisar();
  }

  async cargar({ pagina = this.pagina, filtros = this.filtros } = {}) {
    try {
      const query = new URLSearchParams({ page: String(pagina), limit: String(this.limite) });
      if (filtros.busqueda?.trim()) query.set('search', filtros.busqueda.trim());
      if (filtros.estado && filtros.estado !== 'all') query.set('status', filtros.estado);
      if (filtros.prioridad && filtros.prioridad !== 'all') query.set('priority', filtros.prioridad);
      const resultado = await this.api('GET', `?${query}`);
      this.items = resultado.data;
      this.pagina = resultado.pagination.page;
      this.total = resultado.pagination.total;
      this.totalPaginas = resultado.pagination.totalPages;
      this.filtros = { ...filtros };
      this.estadisticas = resultado.estadisticas;
    } catch (error) {
      this.items = [];
      this.total = 0;
      this.totalPaginas = 0;
      this.estadisticas = { total: 0, abiertos: 0, criticos: 0, resueltos: 0 };
      this.#avisar();
      throw error;
    }
    this.#avisar();
  }

  /** Devuelve el incidente creado, o null si ya había un envío en curso. */
  async crear(datos) {
    if (this.enviando) return null;
    this.enviando = true;
    try {
      const creado = await this.api('POST', '', datos);
      await this.cargar({ pagina: 1 });
      return creado;
    } finally {
      this.enviando = false;
    }
  }

  async resolver(id) {
    const actualizado = await this.api('PATCH', `/${id}`, { status: ESTADO_FINAL });
    await this.cargar();
    return actualizado;
  }

  async eliminar(id) {
    await this.api('DELETE', `/${id}`);
    await this.cargar();
  }
}
