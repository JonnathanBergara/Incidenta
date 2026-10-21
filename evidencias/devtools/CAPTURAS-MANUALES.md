# Evidencia de Chrome DevTools

Las capturas Elements, Network y Performance de esta carpeta se tomaron con
Chrome visible y DevTools abierto. `antes-d*.png` y `despues-d*.png` son
capturas de la interfaz, no sustitutos de los paneles DevTools. Sensors aún no
se capturó; no se afirma que D2 se reprodujera gráficamente desde ese panel.

## Preparar navegador

1. Desde la raíz, ejecuta `npm start` con `.env` local configurado; abre
   `http://localhost:3000` en Chrome.
2. Para una demo reproducible sin guardar datos, se puede iniciar
   `node scripts/servidor-evidencia.js` en otra terminal. Usa usuarios de
   demostración: `lector/Lector-Demo-2026`, `analista/Analista-Demo-2026` y
   `admin/Admin-Demo-2026`.
3. Abre DevTools con **F12** o **Ctrl+Shift+I**. Guarda cada captura con el
   panel y la aplicación visibles; no recortes ni reconstruyas las capturas.

## Capturas por panel

- **Elements (D1):** captura real disponible:
  `captura-elements-real.png`. Muestra `span#fecha-hoy` inspeccionado en el
  árbol DOM y la fecha generada por la aplicación. Para comparar la condición
  anterior hace falta abrir la copia original, que no está disponible.
- **Sensors (D2):** en DevTools abre **⋮ > More tools > Sensors**. En *Location*
  elige *Other* y configura la zona horaria `America/Guayaquil`. Captura el
  formulario con `#incident-date` y la fecha local visible. Para reproducir el
  cruce exacto de las 20:30 se requiere un reloj virtual de navegador o esperar
  ese instante; no cambies el reloj del sistema solo para la captura.
  **Pendiente:** `captura-sensors-real.png` debe obtenerse en el panel real con
  el override visible; no hay captura válida en esta entrega.
- **Network (D3):** selecciona *Fetch/XHR*, activa *Preserve log*, inicia sesión
  como analista, completa los campos y haz doble clic en **Registrar**.
  Selecciona la solicitud `POST /api/incidentes`; captura *Headers* y confirma
  que hay una solicitud 201, no dos. `captura-network-real.png` muestra la
  pestaña Network real y el GET paginado con estado 200. La prueba de doble
  POST y el replay automatizado confirman un solo POST; no se capturó ese POST
  de alta en esta imagen.
- **Performance (D4):** inicia sesión como lector o analista, pulsa Record,
  escribe `servidor` en la búsqueda, espera y detén la grabación. Captura la
  actividad de Main, scripting/layout y la interacción de búsqueda. El replay
  Chromium de esta sesión produjo 1 repintado para 8 teclas. Captura real de
  DevTools: `captura-performance-real.png`.

Las capturas archivadas corresponden al navegador real de esta sesión; no se
fabricaron ni se recortaron para simular DevTools. Sensores queda marcado para
que quien tenga acceso al entorno gráfico complete esa evidencia pendiente.
