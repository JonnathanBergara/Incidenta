/**
 * sesion.model.mjs — Sesión del usuario (sessionStorage: se borra al cerrar la pestaña)
 */

import { puede, sesionVigente } from './reglas.mjs';

const CLAVE = 'incidenta-sesion';

export class SesionModel {
  constructor(almacen, ahora = () => Date.now()) {
    this.almacen = almacen;
    this.ahora = ahora;
    this.actual = this.#leer();
  }

  #leer() {
    try {
      const s = JSON.parse(this.almacen.getItem(CLAVE));
      return sesionVigente(s, this.ahora()) ? s : null;
    } catch {
      return null;
    }
  }

  get token() { return this.actual ? this.actual.token : null; }
  get activa() { return this.actual !== null; }

  guardar(datos) {
    this.actual = { token: datos.token, usuario: datos.usuario, expiraEn: this.ahora() + datos.expiraEn * 1000 };
    this.almacen.setItem(CLAVE, JSON.stringify(this.actual));
  }

  cerrar() {
    this.actual = null;
    this.almacen.removeItem(CLAVE);
  }

  puede(accion) {
    return this.actual !== null && puede(this.actual.usuario.role, accion);
  }
}
