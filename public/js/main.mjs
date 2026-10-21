/**
 * main.mjs — Punto de arranque del cliente (composición MVC).
 *
 *   Modelo:      model/reglas, api, sesion.model, incidentes.model
 *   Vista:       view/incidentes.view, view/html
 *   Controlador: controller/app.controller
 */

import { SesionModel } from './model/sesion.model.mjs';
import { crearClienteApi } from './model/api.mjs';
import { IncidentesModel } from './model/incidentes.model.mjs';
import { IncidentesView } from './view/incidentes.view.mjs';
import { AppController } from './controller/app.controller.mjs';

const sesion = new SesionModel(window.sessionStorage);
let controlador = null;
const cliente = crearClienteApi({
  fetchFn: (...args) => window.fetch(...args),
  obtenerToken: () => sesion.token,
  alSesionInvalida: () => controlador.cerrarSesion('Su sesión expiró o no es válida. Inicie sesión de nuevo.')
});

controlador = new AppController({
  sesion,
  modelo: new IncidentesModel(cliente.api),
  vista: new IncidentesView(document),
  api: cliente
});
controlador.arrancar();
