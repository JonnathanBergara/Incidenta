# Guion de defensa de Incidenta

**Duración máxima prevista:** 10 minutos.
**Distribución:** introducción 0:20; demostración 3:00; arquitectura y código
6:10; cierre 0:30. Las indicaciones entre corchetes no se leen en voz alta.
El inventario al final es una chuleta visual de referencia: no hace falta leer
cada fila en el video; sí permite explicar cualquier carpeta si el docente
pregunta.

> No se encontró en el repositorio el texto literal de los puntos 16–16.5 de
> la rúbrica. Este guion cubre la defensa funcional, arquitectura, seguridad,
> pruebas y despliegue solicitados. Cotejarlo con el documento de evaluación
> antes de grabar por si existen subcriterios adicionales.

## Preparación antes de grabar

- Abre la aplicación pública y VS Code con el repositorio.
- Verifica `https://plataforma-incidenta.onrender.com/healthz`; debe responder
  `{"status":"ok"}`.
- Ten preparada tu contraseña de `admin`, pero no la muestres ni la digas.
  Oculta también variables de Render, `.env`, `DATABASE_URL` y tokens.
- Para demostrar CRUD, usa un incidente ficticio de prueba y elimínalo al
  terminar. No uses información personal ni operacional real.
- Prepara VS Code con el panel Explorer visible y amplía las carpetas
  `src/`, `public/`, `tests/`, `scripts/`, `docs/`, `evidencias/` y
  `.github/workflows/`.
- Ten listas estas pestañas para mostrar código: `server.js`,
  `src/routes/definiciones.js`, `src/middleware/auth.js`,
  `src/controllers/incidentes.controller.js`, `src/models/incidente.model.js`,
  `src/db/connection.js`, `src/migrations/004_indices_listado.sql`,
  `public/js/model/reglas.mjs`, `tests/http.test.js` y
  `.github/workflows/ci.yml`.
- Ensaya una vez con cronómetro. Si te atrasas, resume filtros; no omitas
  autorización, persistencia ni la diferencia entre pruebas locales y
  producción.

## Guion hablado

### 00:00–00:20 — Presentación

**[MOSTRAR: portada o el repositorio.]**

Hola. Soy **[nombre del estudiante]** y voy a presentar Incidenta, una
plataforma web para registrar, consultar y dar seguimiento a incidentes.
Primero mostraré el funcionamiento en aproximadamente tres minutos y luego
explicaré la arquitectura, las decisiones técnicas y las pruebas.

### 00:20–03:20 — Demostración de la plataforma (3 minutos)

**[MOSTRAR: abrir la aplicación pública; esperar la carga.]**

Esta es la versión de demostración publicada mediante HTTPS. El alojamiento
gratuito puede suspender una instancia inactiva, por lo que la primera carga
puede tardar. La aplicación sirve desde el mismo origen tanto la interfaz como
la API.

**[MOSTRAR: escribir el usuario e iniciar sesión sin exponer la contraseña.]**

Inicio sesión con el perfil administrador. Incidenta maneja tres roles:
lector, analista y administrador. El lector puede consultar; el analista
puede consultar, crear y actualizar; y el administrador puede, además,
eliminar. La contraseña no se muestra en la grabación y tampoco se incluye en
el código.

**[MOSTRAR: resumen, lista, búsqueda y filtros.]**

El resumen muestra el total de registros, los que requieren atención, la
prioridad alta y los resueltos. En la lista busco por título o categoría y
combino estado y prioridad. El listado está paginado para no enviar todos los
registros de una vez.

**[MOSTRAR: el formulario; crear un incidente ficticio previamente pensado.]**

Registro un incidente de demostración con información ficticia. Completo los
campos obligatorios y envío el formulario una sola vez. La interfaz evita el
doble envío y el servidor vuelve a validar los campos antes de guardar.

**[MOSTRAR: detalle, actualizar a Resuelto y, si el tiempo alcanza, borrar
solo el registro ficticio.]**

Abro el detalle y actualizo el estado a “Resuelto”. La lista y los indicadores
se actualizan. La eliminación es exclusiva del administrador y aquí solo la
uso para limpiar el dato de prueba; para cerrar un caso real se debe preferir
el estado “Resuelto”.

### 03:20–04:10 — Arquitectura general y mapa del repositorio

**[MOSTRAR: árbol de carpetas del proyecto.]**

El sistema se divide en cliente web, API y persistencia. `public` contiene la
interfaz; `src` contiene Express y sus rutas, controladores, modelos,
middleware y migraciones; Neon conserva los datos. Render publica el servidor
por HTTPS, y GitHub Actions automatiza pruebas y lint.

En la raíz están el arranque `server.js`, los comandos y dependencias en
`package.json`, la plantilla de configuración `.env.example`, las reglas de
ESLint y el descriptor de Render. El README documenta la ejecución; el
inventario de apoyo explica cada archivo versionado.

El cliente se entrega desde `public`: `index.html` define la página,
`styles.css` su aspecto y `js` separa modelo, vista y controlador. El modelo
no accede al DOM. El navegador solo habla con la API; el servidor autoriza,
valida y delega las consultas al modelo de datos.

### 04:10–05:05 — Arranque y middleware

**[MOSTRAR: `server.js`, primero `iniciar` y luego `crearApp`.]**

`server.js` es el punto de entrada. Primero valida la configuración, aplica
migraciones y prepara los datos iniciales; después comienza a atender
solicitudes. En Express, el orden de los middleware importa: se registran las
peticiones, se agregan cabeceras de seguridad, se exige HTTPS, se comprimen
las respuestas, se limita CORS y el tamaño del JSON, se sirven los archivos
estáticos y finalmente se montan las rutas y los manejadores de errores.

El endpoint `/healthz` consulta la base con `SELECT 1`. Así un fallo de
conexión no se presenta como un servicio saludable. Los logs no guardan
contraseñas ni tokens.

### 05:05–06:00 — API, permisos y validación

**[MOSTRAR: `src/routes/definiciones.js` y `src/middleware/auth.js`.]**

`definiciones.js` centraliza la matriz de permisos. Para leer se requiere
estar autenticado; analista o admin pueden escribir y solo admin puede
eliminar o crear usuarios. Las rutas validan antes de entrar al controlador:
datos inválidos reciben 400 y permisos insuficientes, 403.

Las rutas principales son `POST /api/auth/login`, `GET /api/auth/me` y
`POST /api/auth/usuarios`. Incidentes usa `GET` para lista y detalle, `POST`
para crear, `PUT` o `PATCH` para actualizar y `DELETE` para eliminar. El
listado acepta `page`, `limit`, `status`, `priority` y `search`. No existen
las rutas de navegador `/Incidentes` ni `/Aapis`; el detalle de cada endpoint
está en la tabla de referencia.

El login emite un JWT limitado en el tiempo. El servidor valida el token y
consulta el estado y rol del usuario; además limita intentos de acceso.

### 06:00–07:00 — Controladores, modelos y base de datos

**[MOSTRAR: controlador y modelo de incidentes; después `connection.js` y las
migraciones.]**

El controlador recibe y responde a la petición HTTP; el modelo contiene las
operaciones de datos. Las consultas usan parámetros como `$1` y `$2`, en vez
de concatenar directamente entradas, y soportan filtros, búsqueda y
paginación.

`connection.js` conecta con `pg` en producción y usa PGlite solo en pruebas.
Las migraciones crean tablas, restricciones, índices y el trigger que mantiene
`updated_at`. Elegimos PostgreSQL administrado porque el disco de una instancia
gratuita puede ser efímero; la base queda separada de los reinicios del
servidor web.

### 07:00–07:55 — Cliente MVC

**[MOSTRAR `public/js/model`, `public/js/view` y `public/js/controller`.]**

El cliente se organiza en MVC. El modelo conserva reglas, sesión, estado y
comunicación con la API, sin tocar el DOM. La vista presenta la interfaz y el
controlador conecta los eventos. Esta separación permite probar las reglas
sin abrir un navegador.

La búsqueda utiliza un debounce de 200 milisegundos para reducir repintados
por cada tecla. Además, la vista trata el contenido como texto seguro y el
servidor vuelve a validar y sanear antes de persistir.

### 07:55–08:55 — Pruebas y calidad

**[MOSTRAR `tests/` y `.github/workflows/ci.yml`; opcionalmente, reporte ya
ejecutado.]**

Las pruebas Jest verifican reglas y modelos. Las pruebas de integración
ejecutan Express y cubren CRUD, paginación, autenticación, autorización,
validación y errores. PGlite proporciona PostgreSQL local para pruebas, sin
usar la base productiva.

En la última ejecución local pasaron 74 pruebas Jest y 29 de integración.
ESLint 9 informó cero errores y advertencias en 47 archivos. GitHub Actions
también aprobó el flujo del commit desplegado con Node 22. La zona horaria de
las pruebas está fijada para evitar resultados distintos entre equipos.

### 08:55–09:30 — Despliegue y límites

**[MOSTRAR el repositorio y, si se desea, el panel Render en estado Live;
mantener oculta la pestaña Environment.]**

El código está en `JonnathanBergara/Incidenta`; la demostración funciona en
Render con PostgreSQL de Neon. Comprobé el estado Live, las migraciones del
arranque, la interfaz pública y `/healthz` con HTTP 200. El CRUD y los permisos
se probaron localmente; no afirmo haber hecho operaciones remotas con una
cuenta real. El plan gratuito tiene cuotas y puede dormir por inactividad: es
una demostración, no un servicio con SLA.

### 09:30–10:00 — Cierre

**[MOSTRAR: aplicación o portada.]**

En resumen, Incidenta combina una interfaz MVC, una API con permisos
verificados en servidor y almacenamiento PostgreSQL persistente. La
implementación se despliega y su health check está verificado; las pruebas
automatizadas cubren las reglas, los roles y el CRUD. Gracias.

## Inventario completo del proyecto (chuleta visual)

Esta sección explica las rutas reales que se encuentran en el repositorio.
Úsala como apoyo al mostrar el panel Explorer de VS Code. `node_modules/` y
`.git/` son datos locales generados por npm/Git, no código fuente de la
aplicación ni archivos que se suban como parte del proyecto.

### Archivos de la raíz

| Ruta | Para qué sirve |
|---|---|
| `server.js` | Punto de entrada. Valida configuración, migra/siembra la base, crea Express y escucha peticiones. |
| `package.json` | Nombre, versión, dependencias y comandos npm (`start`, `test`, `lint`, evidencias y medición). |
| `package-lock.json` | Versiones exactas del árbol de dependencias para instalaciones reproducibles con `npm ci`. |
| `.env.example` | Plantilla de variables locales; no contiene secretos reales. Se copia a `.env`, que no se versiona. |
| `.gitignore` | Excluye dependencias, `.env`, claves privadas y archivos temporales. |
| `eslint.config.js` | Configuración flat de ESLint 9 para JavaScript/ESM y reglas del proyecto. |
| `render.yaml` | Blueprint de Render: runtime Node, comandos, health check y nombres de variables requeridas. Los valores secretos se completan en Render. |
| `README.md` | Descripción, arquitectura, ejecución, pruebas, enlaces y límites de la demo. |
| `.github/workflows/ci.yml` | GitHub Actions: Node 22, zona `America/Guayaquil`, `npm ci`, pruebas y lint. |

### Servidor: `src/`

| Ruta | Para qué sirve |
|---|---|
| `src/config/index.js` | Lee variables de entorno, define límites/roles y falla al iniciar si falta configuración obligatoria. |
| `src/routes/definiciones.js` | Define método, ruta, middleware de autenticación/rol, validadores y controlador. |
| `src/routes/index.js` | Monta en Express las rutas centralizadas de `definiciones.js`. |
| `src/controllers/auth.controller.js` | Login, consulta del perfil autenticado y alta de usuarios. |
| `src/controllers/incidentes.controller.js` | Maneja HTTP para listar, consultar, crear, actualizar y eliminar incidentes. |
| `src/models/usuario.model.js` | Consultas parametrizadas para buscar, crear y actualizar usuarios en PostgreSQL. |
| `src/models/incidente.model.js` | CRUD, filtros, estadísticas y paginación de incidentes mediante SQL parametrizado. |
| `src/db/connection.js` | Pool `pg` en ejecución; conexión PGlite dentro de pruebas; consulta, ejecución y cierre. |
| `src/db/migrate.js` | Aplica migraciones SQL pendientes en orden y registra cuáles se ejecutaron. |
| `src/db/seed.js` | Crea datos de ejemplo si la tabla está vacía y usuarios iniciales si no existen. |
| `src/migrations/001_create_incidentes.sql` | Tabla de incidentes, columnas, tipos y restricciones iniciales. |
| `src/migrations/002_trigger_updated_at.sql` | Trigger y función que actualizan `updated_at` al modificar un registro. |
| `src/migrations/003_create_usuarios.sql` | Tabla de usuarios, roles, estado activo y restricciones/índices de identidad. |
| `src/migrations/004_indices_listado.sql` | Índices para ordenar y filtrar eficientemente los listados. |
| `src/middleware/auth.js` | Verifica JWT y usuario activo; aplica autorización por roles y produce 401/403. |
| `src/middleware/validate.js` | Valida parámetros, filtros, login, incidentes y creación de usuarios antes del controlador. |
| `src/middleware/security.js` | Cabeceras de seguridad, CORS permitido y exigencia de HTTPS detrás del proxy. |
| `src/middleware/compresion.js` | Comprime las respuestas compatibles para reducir transferencia de red. |
| `src/middleware/estaticos.js` | Añade cabeceras/cache a recursos estáticos. |
| `src/middleware/logger.js` | Registra ruta, método, estado, duración y usuario sin credenciales. |
| `src/middleware/rateLimit.js` | Limita intentos repetidos de autenticación por ventana/IP en la instancia actual. |
| `src/middleware/errorHandler.js` | Convierte errores y rutas inexistentes en respuestas HTTP controladas. |
| `src/utils/jwt.js` | Firma/verifica JWT HS256 y comprueba expiración, emisor, audiencia y firma. |
| `src/utils/password.js` | Genera y compara hashes scrypt salados para contraseñas. |
| `src/utils/sanitize.js` | Escapa caracteres especiales en búsquedas y sanea datos de entrada. |
| `src/utils/validators.js` | Reglas reutilizables de formato, campos, roles, email y datos de incidentes. |

### Cliente: `public/`

| Ruta | Para qué sirve |
|---|---|
| `public/index.html` | Estructura semántica de la página, navegación, resumen, tabla, formulario y carga del módulo principal. |
| `public/css/styles.css` | Diseño visual responsive, componentes, estados y accesibilidad visual. |
| `public/img/favicon.svg` | Ícono del sitio. |
| `public/js/main.mjs` | Punto de composición del cliente: crea sesión, API, modelo, vista y controlador. |
| `public/js/model/api.mjs` | Cliente HTTP, envío del token, login y traducción de respuestas/errores. |
| `public/js/model/incidentes.model.mjs` | Estado de incidentes, filtros, paginación y operaciones de datos que llama a la API. |
| `public/js/model/reglas.mjs` | Reglas puras: permisos visuales, estadísticas, filtros, fechas y estado de sesión. No accede al DOM. |
| `public/js/model/sesion.model.mjs` | Guarda/consulta/cierra la sesión y expone el rol/permisos actuales. |
| `public/js/view/incidentes.view.mjs` | Lee formularios y actualiza lista, detalle, estadísticas, login y mensajes en el DOM. |
| `public/js/view/html.mjs` | Construye/escapa contenido HTML dinámico para evitar insertar datos como marcado ejecutable. |
| `public/js/controller/app.controller.mjs` | Coordina eventos y llamadas modelo-vista; contiene debounce de búsqueda de 200 ms. |

### Pruebas: `tests/`

| Ruta | Para qué sirve |
|---|---|
| `tests/harness.js` | Arnés de solicitudes que reutiliza las cadenas reales de middleware/rutas sin levantar HTTP. |
| `tests/http.test.js` | Pruebas HTTP/integración contra la aplicación Express real. |
| `tests/seguridad.test.js` | Casos de autenticación, permisos, seguridad, validación y CRUD con `node:test`. |
| `tests/unit/reglas-servidor.test.js` | Pruebas Jest de validadores, saneamiento y reglas del servidor. |
| `tests/unit/reglas-cliente.test.js` | Pruebas Jest de reglas puras de interfaz, permisos y fechas. |
| `tests/unit/cliente-mvc.test.js` | Pruebas Jest del cliente MVC, flujo modelo/controlador y sesión. |
| `tests/unit/compresion.test.js` | Pruebas de la compresión de respuestas. |

### Herramientas reproducibles: `scripts/`

| Ruta | Para qué sirve |
|---|---|
| `scripts/capturas-navegador.js` | Ejecuta recorridos con navegador real y produce capturas/trazas de roles. |
| `scripts/devtools-auditoria.js` | Automatiza comprobaciones del navegador mediante Chrome DevTools Protocol y guarda evidencias. |
| `scripts/servidor-evidencia.js` | Levanta el servidor/arnés que usan los generadores de evidencia. |
| `scripts/transcripcion.js` | Ejecuta escenarios de prueba y guarda salidas reales en archivos de transcripción. |
| `scripts/lint-reporte.js` | Ejecuta ESLint y persiste resultados legibles/JSON en `evidencias/lint/`. |
| `scripts/prelint.js` | Respaldo de análisis estático; no sustituye ESLint. |
| `scripts/medir.js` | Mide consulta/plan SQL, recurso de imagen, red y carga; guarda JSON comparativo. |
| `scripts/optimizar-imagenes.js` | Redimensiona/convierte imágenes de documentación a WebP y formatos compactos. |

### Documentación: `docs/`

| Ruta | Para qué sirve |
|---|---|
| `docs/ARQUITECTURA-DESPLIEGUE.md` | Diagrama, configuración de Render/Neon, variables, seguridad y límites operativos. |
| `docs/MEMORIA-TECNICA.md` / `.docx` | Memoria técnica en Markdown y Word con resultados y figuras. |
| `docs/GUIA-USUARIO.md` / `.docx` | Manual de usuario en Markdown y Word. |
| `docs/GUION-DEFENSA-VIDEO.md` / `.docx` | Guion hablado de diez minutos e inventario de rutas del repositorio. |
| `docs/INFORME-CALIDAD.md` | Informe histórico de defectos, métricas antes/después y costos; indica qué es de SQLite. |
| `docs/Incidenta-presentacion.pptx` | Presentación de apoyo. |
| `docs/img/crear-incidente.*` | Imágenes de apoyo para explicar registro de incidentes. |
| `docs/img/mensaje-401.*` y `mensaje-403.*` | Imágenes de apoyo para errores de autenticación/autorización. |

### Evidencias: `evidencias/`

| Ruta | Contenido |
|---|---|
| `evidencias/produccion-*` | Capturas verificadas del servicio público: login/interfaz, Render Live, `/healthz` y API sin token (401). |
| `evidencias/integracion/` | 13 capturas y traza de pruebas locales de los flujos por rol, respuestas 201/400/401/403/204. |
| `evidencias/devtools/` | Capturas Elements, Network, Performance, estados antes/después y lista de capturas manuales pendientes. |
| `evidencias/calidad/` | Resultados visuales de SQL, imagen, HTTP, carga, MVC, lint y defectos de la versión previa. |
| `evidencias/mediciones/` | Archivos JSON con números medidos antes/después y medición actual PGlite. |
| `evidencias/lint/` | Reportes de ESLint en texto/JSON y comparación pre/post. |
| `evidencias/transcripciones/` | Salidas de pruebas/escenarios conservadas como texto. |
| `evidencias/antes-reto2/` | Capturas históricas del estado anterior del proyecto; no describen necesariamente la versión desplegada actual. |
| `evidencias/captura-*.png` y `codigo-*.png` | Evidencia gráfica resumen de pruebas, API, seguridad y fragmentos del código. |

### Rutas HTTP de la API

| Método y ruta | Quién puede usarla | Resultado esperado |
|---|---|---|
| `GET /healthz` | Pública | Comprueba conexión a PostgreSQL y devuelve `{"status":"ok"}`. |
| `POST /api/auth/login` | Pública, con límite de intentos | Comprueba usuario/contraseña y devuelve JWT y perfil. |
| `GET /api/auth/me` | Cualquier usuario autenticado | Devuelve el perfil asociado al token. |
| `POST /api/auth/usuarios` | Admin | Crea usuario con contraseña hasheada y rol validado. |
| `GET /api/incidentes?page=1&limit=10` | Lector, analista o admin | JSON paginado `{data, pagination, estadisticas}`. |
| `GET /api/incidentes?status=Abierto&priority=Alta&search=servidor` | Lector, analista o admin | Aplica filtros de estado, prioridad y búsqueda. |
| `GET /api/incidentes/:id` | Lector, analista o admin | Obtiene un detalle por ID. |
| `POST /api/incidentes` | Analista o admin | Valida y crea un incidente. |
| `PUT /api/incidentes/:id` / `PATCH /api/incidentes/:id` | Analista o admin | Reemplaza o actualiza campos del incidente. |
| `DELETE /api/incidentes/:id` | Admin | Elimina el incidente indicado. |

Para probar en navegador, `/healthz` se puede abrir directamente. Los
endpoints de incidentes requieren iniciar sesión: sin token es correcto recibir
401. Después de iniciar sesión, el cliente adjunta automáticamente el
encabezado `Authorization: Bearer <token>` a cada solicitud protegida. Abrir
una ruta directamente en el navegador no añade ese encabezado y puede devolver
401. No publiques tokens ni conviertas la API en pública solo para ver JSON.
