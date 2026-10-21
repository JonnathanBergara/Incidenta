# Guion de defensa de Incidenta

**Duración máxima prevista:** 10 minutos.
**Distribución:** introducción 0:20; demostración 3:00; arquitectura y código
6:10; cierre 0:30. Las indicaciones entre corchetes no se leen en voz alta.

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
- Prepara estas pestañas/archivos en VS Code: `server.js`,
  `src/routes/definiciones.js`, `src/middleware/auth.js`,
  `src/controllers/incidentes.controller.js`, `src/models/incidente.model.js`,
  `src/db/connection.js`, `src/migrations/004_indices_listado.sql`,
  `public/js/model/`, `public/js/view/`, `public/js/controller/`, `tests/` y
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

### 03:20–04:10 — Arquitectura general

**[MOSTRAR: árbol de carpetas del proyecto.]**

El sistema se divide en cliente web, API y persistencia. `public` contiene la
interfaz; `src` contiene el servidor Express; PostgreSQL en Neon conserva los
datos. Render ejecuta el servidor y entrega el sitio por HTTPS. GitHub guarda
el código y GitHub Actions ejecuta pruebas y lint.

El cliente nunca accede directamente a PostgreSQL. Envía solicitudes a la
API; las rutas deciden permisos y validación, el controlador coordina la
operación y el modelo ejecuta las consultas.

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
estar autenticado; para crear y actualizar se admite analista o admin; para
eliminar, únicamente admin. La validación ocurre antes del controlador. Por
eso una entrada inválida se rechaza con 400, y un rol sin permiso recibe 403.

El inicio de sesión entrega un JWT con vigencia limitada. En una operación
protegida, el servidor comprueba el usuario y el rol vigente en la base; no
confía solamente en lo que diga el navegador. También existe un límite de
intentos de login.

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
arranque, la interfaz pública y `/healthz`, que respondió HTTP 200. No afirmo
haber ejecutado un CRUD remoto con una cuenta real: las pruebas de CRUD y
permisos mencionadas fueron las de integración local. El plan gratuito puede
dormir por inactividad y tiene cuotas; esto es una demostración, no un SLA
empresarial.

### 09:30–10:00 — Cierre

**[MOSTRAR: aplicación o portada.]**

En resumen, Incidenta combina una interfaz MVC, una API con permisos
verificados en servidor y almacenamiento PostgreSQL persistente. La
implementación se despliega y su health check está verificado; las pruebas
automatizadas cubren las reglas, los roles y el CRUD. Gracias.
