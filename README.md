# Plataforma Incidenta

Aplicación web de gestión de incidentes con API REST, autenticación JWT y
permisos por rol. Cliente HTML/CSS/JavaScript MVC; servidor Node.js + Express;
PostgreSQL para persistencia.

> **Aplicación en producción de demostración:** [Incidenta](https://plataforma-incidenta.onrender.com).
> El estado Live y `GET /healthz` (HTTP 200, `{"status":"ok"}`) se verificaron
> el 21/10/2026. El código está en
> [GitHub](https://github.com/JonnathanBergara/Incidenta). Render Free puede
> dormir por inactividad y Neon Free tiene cuotas; no es un SLA de producción.

## Funcionalidad

- CRUD persistente de incidentes, validación del lado servidor y filtros.
- Autenticación JWT; roles `lector`, `analista` y `admin`.
- Listado paginado: `page` (1 por defecto), `limit` (50 por defecto; máximo
  100), `status`, `priority` y `search`.
- Endpoint de salud `GET /healthz`, que verifica conexión con la base.
- Registros de solicitudes sin guardar contraseñas ni cuerpos sensibles.
- HTTPS en hosting mediante TLS del proveedor y verificación de proxy.

## Arquitectura

- `src/routes/`: definiciones únicas de endpoints y permisos.
- `src/controllers/`: manejo HTTP y errores.
- `src/models/`: consultas parametrizadas a PostgreSQL.
- `src/db/`: pool, migraciones SQL y datos iniciales.
- `src/migrations/`: esquema, trigger `updated_at` e índices.
- `src/middleware/`: JWT, roles, validación, limitador, seguridad, gzip,
  registros y errores.
- `public/js/model/`, `view/`, `controller/`: capas del cliente MVC; el modelo
  no manipula el DOM.
- `tests/`: Jest con PGlite (PostgreSQL embebido para pruebas) e integración
  HTTP/roles con Express real.

`GET /api/incidentes` responde `{ data, pagination, estadisticas }`.
`pagination.total` refleja los filtros; las estadísticas son globales.

## Ejecución local

Requisitos: Node.js 22 o superior, npm y una base PostgreSQL accesible.

```powershell
npm ci
Copy-Item .env.example .env
# Edita .env: DATABASE_URL y JWT_SECRET (mínimo 32 caracteres).
npm run migrate
npm run seed
npm start
```

El servidor también migra el esquema y crea datos iniciales al arrancar.
Configura PostgreSQL local o usa una base de desarrollo; las pruebas no
requieren un servidor externo.

## Pruebas y calidad

```powershell
npm test
npm run lint
npm run lint:reporte
npm run evidencia
npm run evidencia:devtools
npm run medir -- despues-postgres
```

Jest usa PGlite; las pruebas de integración emplean `node:test` y un servidor
Express real. El reporte de lint se escribe en `evidencias/lint/`.

Última ejecución local disponible: 74 pruebas Jest y 29 integraciones
aprobadas; ESLint informó cero errores y advertencias en 47 archivos. El
recorrido web generó 13 capturas de roles. Las verificaciones se ejecutaron
localmente con Node v24.22.0; Actions está configurado para Node 22.

La medición reproducible con 20 000 filas en PGlite dio una mediana de
284.2 ms para descargar todo el listado, 95.9 ms para el filtro de estado y
30.1 ms para la búsqueda. PGlite no equivale a Neon ni a una base PostgreSQL
en red: no comparar directamente estas cifras con las mediciones anteriores
de SQLite. La medición detallada está en
`evidencias/mediciones/despues-postgres.json`.

## Despliegue sin costo (con límites)

Guía completa: [arquitectura y despliegue](docs/ARQUITECTURA-DESPLIEGUE.md).
El Blueprint `render.yaml` define el servicio Node; la base gratuita se crea
por separado en Neon y se enlaza mediante `DATABASE_URL`. No se almacena
PostgreSQL en el sistema de archivos efímero del host.

Render Free duerme servicios inactivos, lo que puede demorar el primer acceso.
Neon Free limita almacenamiento/cómputo y escala a cero; no es un SLA ni una
oferta de producción. Confirma límites actuales en las páginas oficiales antes
de compartir con usuarios finales. El uso intensivo o una cuota agotada puede
dejar la app temporalmente inaccesible.

## Documentación y evidencias

- [Memoria técnica](docs/MEMORIA-TECNICA.md)
- [Guía de usuario](docs/GUIA-USUARIO.md)
- [Memoria técnica en Word](docs/MEMORIA-TECNICA.docx)
- [Guía de usuario en Word](docs/GUIA-USUARIO.docx)
- [Presentación PowerPoint](docs/Incidenta-presentacion.pptx)
- [Informe de calidad y mediciones](docs/INFORME-CALIDAD.md)
- [Capturas y guía DevTools](evidencias/devtools/CAPTURAS-MANUALES.md)
- [Pruebas de recorrido por roles](evidencias/integracion/)

## Seguridad y privacidad

No agregues `.env`, URLs con contraseña, tokens, datos personales ni
credenciales de acceso a Git. En producción define secretos en el panel del
host. Las contraseñas iniciales se configuran antes del primer arranque y se
guardan con hash scrypt. Las contraseñas configuradas no se rotan cambiando
variables tras crear usuarios; usa el procedimiento de administración
documentado. No uses datos reales en el demo público.

## Licencia y soporte

Proyecto de demostración académica. Revisa dependencias y límites de servicios
externos antes de usarlo con información operacional o sensible.
