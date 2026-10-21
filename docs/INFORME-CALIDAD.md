# Informe de revisión y mejora de Incidenta

> **Nota de vigencia:** estas mediciones corresponden a la revisión anterior,
> que usaba SQLite. Después, la capa de persistencia se migró a PostgreSQL;
> los valores SQL de este informe no son una medición del motor actual.

- **Fecha de ejecución:** 20 de octubre de 2026 (hora local; 21 de octubre UTC)
- **Versión medida:** Node v24.22.0, Chromium 156.0.8078.4, Express
**Alcance:** código disponible en la carpeta de trabajo; no se encontró el ZIP
original ni la plantilla Word. A petición del usuario se excluye el informe
Word; este informe se entrega en Markdown.

## Resumen

La suite unitaria ahora usa Jest; integración HTTP/seguridad conserva
`node:test`. ESLint 9 quedó en cero problemas sobre 47 archivos. Ejecuté
mediciones y recorrido de los tres roles. Las capturas reales de Elements,
Network y Performance están incluidas; Sensors sigue pendiente. Las capturas
históricas “antes” muestran solo la aplicación.

El listado ahora pagina con `page` (1 por defecto) y `limit` (50 por defecto,
100 máximo), filtros, conteo y navegación. La respuesta cambia de arreglo a
`{data,pagination,estadisticas}`; consumidores externos deben leer `data`.

## Defectos y regresiones

| ID | Síntoma reproducido/observado | Corrección presente y prueba de regresión |
|---|---|---|
| D1 | Fecha fija en `#fecha-hoy`. | Se deriva la fecha actual; pruebas con fechas distintas y captura Elements. |
| D2 | A las 20:30 en Guayaquil, UTC avanzaba al día siguiente. | Usa componentes locales; Jest fija `TZ=America/Guayaquil` y prueba el 16 de octubre local. |
| D3 | Doble clic podía emitir dos POST. | Modelo bloquea concurrencia y controlador desactiva el botón; regresión simultánea y auditoría registran 1 POST/1 fila. |
| D4 | Cada tecla repintaba la tabla. | Debounce de 200 ms; temporizadores falsos y Chromium verifican 1 repintado por 8 teclas. |

La auditoría Chromium observó fecha esperada, una fila, un POST, cero errores
de consola e Issues CDP; valida el estado final, no reproduce gráficamente los
defectos.

## Mediciones antes/después

`antes.json` ya existía y se conserva como referencia: Node 22.22.2, Chromium
141 y adaptador `node:http`. Ahora medí con Node 24.22.0, Chromium 156 y Express.
Como no encontré ZIP/copia sin cambios, la comparación no está controlada.

| Medición | Referencia “antes” archivada | “Después” ejecutado ahora | Lectura |
|---|---:|---:|---|
| Listado 20 000 filas, mediana | 70.8 ms; `SCAN` + B-tree temporal | 37.7 ms; escaneo ordenado por `idx_incidentes_created` | Plan sin B-tree; diferencia de 46.8%, no controlada entre entornos. |
| Estado = Abierto | 16.5 ms; índice de estado + orden temporal | 11.3 ms; `idx_incidentes_status_created` | Plan evita el orden temporal. |
| Estado + prioridad | 17.3 ms | 11.7 ms; índice compuesto por prioridad | Plan usa índice compuesto, aunque el filtro combinado no tiene índice con ambas columnas. |
| Búsqueda `%servidor 12%` | 3.4 ms | 5.8 ms | Empeora 2.4 ms (+70.6%); el comodín inicial impide un acceso B-tree selectivo. |
| Imagen mostrada a 800 px | PNG, 112 448 bytes, 1280 px, decodificación 17.2 ms | WebP, 27 968 bytes, 1000 px, decodificación 6.4 ms | El archivo es 75.1% menor; cambia también el navegador de medición. |
| Carga estática fría | 3 solicitudes, 38 475 bytes | 10 solicitudes, 22 204 bytes; `loadEventEnd` 183.8 ms | Baja transferencia 42.3%, pero suma 7 solicitudes por módulos y mayor tiempo de carga que la métrica posterior anterior. |
| API con paginación | 860 920 bytes por respuesta; sin gzip, 2 000 incidentes | 2 714 bytes transferidos / 43 010 decodificados por 100 incidentes; gzip | 93.7% de reducción por compresión, 99.7% menos que el cuerpo histórico completo. La comparación mezcla paginación y gzip; mediana 4.4 ms, p95 8.4 ms. |
| Recarga de recursos | 3 solicitudes / 1 910 bytes, 2 x 304 | 10 solicitudes / 6 074 bytes, 9 x 304 | Más cabeceras por modularidad: el coste de ida y vuelta aumenta aunque no se descarguen 9 cuerpos. |

`loadEventEnd`: 183.8 ms en frío y 35.1 ms al recargar. Recursos textuales usan
gzip; HTML/CSS/JS se revalidan con `no-cache`, imágenes duran un día y la API
usa `no-store` y `Vary: Accept-Encoding`.

![Interfaz antes: imagen archivada disponible](../evidencias/devtools/antes-d1-hero.png)

*Figura 1. Captura de interfaz conservada en la carpeta de entrada; no muestra el panel Elements.*

![Interfaz después: Chromium automatizado](../evidencias/devtools/despues-d1-hero.png)

*Figura 2. Captura de la interfaz posterior tomada por Playwright; no se presenta como captura de DevTools.*

![Chrome DevTools Elements](../evidencias/devtools/captura-elements-real.png)

*Figura 3. Elements real: inspección del nodo con la fecha actual.*

![Chrome DevTools Network](../evidencias/devtools/captura-network-real.png)

*Figura 4. Network real: respuesta 200 del listado paginado.*

![Chrome DevTools Performance](../evidencias/devtools/captura-performance-real.png)

*Figura 5. Performance real: registro de la interacción con búsqueda.*

## Validación funcional y costos

`npm test`: 74 pruebas Jest y 28 de integración aprobadas. El recorrido de los
roles generó 13 capturas y verificó respuestas 400, 401, 403, 201 y 204.
ESLint 9: cero problemas en 47 archivos. El entorno tenía Node 24, no 22.

Jest agregó 262 paquetes; npm reportó 19 vulnerabilidades moderadas. Revisar
`npm audit` antes del despliegue.

La búsqueda `%término%` no usa B-tree: subió de 3.4 a 5.8 ms; no añadí FTS,
que cambiaría semántica y costo de escritura. MVC eleva solicitudes iniciales
de 3 a 10 (304: 2 a 9); baja bytes, pero aumenta cabeceras y viajes de red.

## Evidencia DevTools y reproducción manual pendiente

Capturas reales: Elements muestra la fecha, Network el GET paginado y
Performance una búsqueda. No se capturó el POST de alta; regresión y replay
verifican su unicidad. Sensors sigue pendiente; instrucciones en
`evidencias/devtools/CAPTURAS-MANUALES.md`.

La API limita a 100 por página; el total refleja filtros y las estadísticas
son globales. La llamada medida con 100 filas comprimió 43 010 bytes JSON a
2 714. Incluye paginación y gzip, así que no atribuyo el ahorro a una sola.
No encontré la copia original: las mediciones históricas no son una
comparación controlada. Repetir `node scripts/medir.js` en ambas versiones y
con iguales Node/Chromium para comparar.
