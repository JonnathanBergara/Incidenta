# Arquitectura técnica y despliegue

## Arquitectura

La aplicación se entrega como un solo servicio Node.js: Express sirve la
interfaz de `public/` y expone `/api`. Esto mantiene UI y API en el mismo
origen, sin CORS entre sí. Las rutas declaradas en
`src/routes/definiciones.js` aplican autenticación, rol, validación y
controlador en ese orden.

```text
Navegador HTTPS
    │
    ▼
Render Web Service (Node.js / Express)
    ├── public/ HTML + CSS + módulos JS (MVC)
    ├── /api/auth: login, perfil, alta de usuarios admin
    ├── /api/incidentes: CRUD, filtros y paginación
    └── /healthz: SELECT 1 contra PostgreSQL
             │ TLS (DATABASE_URL)
             ▼
        Neon PostgreSQL
```

### Persistencia y esquema

`pg` administra el pool de conexiones. Las consultas usan parámetros `$1…`,
no concatenan entradas. `src/db/migrate.js` aplica los SQL pendientes en
`src/migrations/`; el runner se ejecuta antes de atender tráfico. `seed.js`
inserta incidentes de ejemplo solo si la tabla está vacía y crea las cuentas
iniciales si todavía no hay usuarios.

PostgreSQL mantiene incidentes, hash scrypt de credenciales y roles. Los índices
apoyan el orden y filtros del listado; un trigger actualiza `updated_at`.
`activo` es booleano y los dominios de estado/prioridad/rol también están
restringidos por la base.

**Cambio de motor:** el despliegue usa PostgreSQL y no convierte
automáticamente archivos SQLite existentes. Esta configuración parte de una
base Postgres nueva. Si hubiera información local que conservar, exportarla y
migrarla de forma controlada antes de apuntar el dominio; no se deben subir
archivos de base de datos al repositorio. Ejecutar migraciones sobre una
instalación SQLite anterior no es compatible.

### API

| Método | Ruta | Permiso | Resultado |
|---|---|---|---|
| GET | `/healthz` | Público | 200 si puede consultar la BD; 500 si no |
| POST | `/api/auth/login` | Público + rate limit | JWT y rol vigente |
| GET | `/api/auth/me` | Autenticado | Perfil |
| POST | `/api/auth/usuarios` | Admin | Crear usuario |
| GET | `/api/incidentes` | Cualquier rol | Página, total filtrado, estadísticas globales |
| GET | `/api/incidentes/:id` | Cualquier rol | Un incidente |
| POST | `/api/incidentes` | Analista/admin | Crear |
| PUT/PATCH | `/api/incidentes/:id` | Analista/admin | Reemplazar/actualizar |
| DELETE | `/api/incidentes/:id` | Admin | Eliminar |

El endpoint paginado responde:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 },
  "estadisticas": { "total": 0, "abiertos": 0, "criticos": 0, "resueltos": 0 }
}
```

`limit` se restringe a 1–100. Los filtros aceptados son `status`, `priority`,
`search`, `page` y `limit`; el total considera filtros, las estadísticas son
globales.

## Seguridad operativa

- Render termina TLS. `TRUST_PROXY=1` permite reconocer el protocolo seguro
  reenviado por el proxy; `FORCE_HTTPS=true` rechaza solicitudes HTTP no
  seguras. Render emite HTTPS para el dominio `onrender.com`.
- `JWT_SECRET` se genera en Render, no se guarda en Git. Token de vida limitada;
  cada solicitud protegida vuelve a consultar usuario, estado y rol.
- Las contraseñas iniciales deben tener 12+ caracteres con letras y números.
  Definir `SEED_ADMIN_PASSWORD`, `SEED_ANALISTA_PASSWORD` y
  `SEED_LECTOR_PASSWORD` como secretos antes del primer despliegue.
- El limitador de login es en memoria por instancia. Para múltiples instancias
  se requiere un almacén compartido y límite distribuido.
- Los logs registran método, ruta, estado, duración y usuario; no deben incluir
  cabeceras Authorization ni cuerpo de login.
- `GET /healthz` comprueba la conexión a Postgres y es usado por el health
  check del host; no revela el connection string.

## Configuración de entorno

| Variable | Requerida | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | URI de Neon; secreto, con SSL requerido |
| `JWT_SECRET` | Sí | Firma JWT, mínimo 32 caracteres |
| `NODE_ENV` | Sí en host | `production` |
| `PORT` | Host | Puerto asignado automáticamente |
| `TRUST_PROXY` | Host | `1` para el proxy Render |
| `FORCE_HTTPS` | Host | `true` |
| `PUBLIC_URL` | Opcional | URL fija para redirección segura HTTP→HTTPS |
| `SEED_*_PASSWORD` | Sí al iniciar producción | Credenciales iniciales de los tres roles |
| `CORS_ORIGINS` | Solo frontend separado | Lista blanca; vacío para mismo origen |

## Despliegue gratuito: Neon + Render

La configuración `render.yaml` define un servicio Node gratuito. La base se
crea en Neon porque el filesystem de Render Free es efímero y no sirve para
SQLite persistente.

1. Crear un proyecto en Neon Free y copiar el connection string PostgreSQL
   desde **Connect**. Conservarlo en un gestor de secretos; no pegarlo en
   código, capturas ni chat. Neon informa actualmente cuota y límites en
   [sus planes](https://neon.com/docs/introduction/plans); confirmar límites
   y requisitos vigentes antes del uso.
2. El código está publicado en
   [JonnathanBergara/Incidenta](https://github.com/JonnathanBergara/Incidenta),
   rama `main`.
3. Iniciar sesión en Render, **New → Blueprint**, seleccionar el repositorio y
   aplicar `render.yaml`.
4. En las variables del servicio, agregar `DATABASE_URL` (Neon URI) y tres
   contraseñas únicas de 12+ caracteres, letras y números. No son valores
   predefinidos de demo. Guardar y desplegar.
5. Esperar build, migraciones y health check. Probar
   `https://<servicio>.onrender.com/healthz`; respuesta esperada:
   `{"status":"ok"}`. Si falla, revisar logs del deploy y la URI/SSL de Neon,
   nunca copiar secretos a un issue público.
6. Probar login y CRUD con cuentas de prueba; eliminar los datos de ensayo.
   Después, comparte el URL `https://...onrender.com`, no credenciales admin.

### Despliegue de demostración verificado

Esta instancia ya quedó publicada en
<https://plataforma-incidenta.onrender.com>, desde
[JonnathanBergara/Incidenta](https://github.com/JonnathanBergara/Incidenta),
rama `main`, commit `613e2ca`. Render informó estado **Live**; el arranque
completó las cuatro migraciones y creó los datos y usuarios iniciales. El
21/10/2026 se verificó externamente `GET /healthz` con HTTP 200 y
`{"status":"ok"}`, además de la respuesta HTML de la página principal. Estas
comprobaciones confirman despliegue y conexión de salud a PostgreSQL, pero no
sustituyen una prueba de inicio de sesión y CRUD con las credenciales del
propietario.

Las cuentas iniciales son `admin`, `analista` y `lector`; sus contraseñas son
los valores privados configurados en Render durante el primer despliegue. No
se incluyen aquí. Cambiar variables `SEED_*_PASSWORD` después de crear las
cuentas no modifica sus claves existentes. Para revisar el despliegue actual,
usar **Render → servicio plataforma-incidenta → Deploys/Logs** y el endpoint
de salud de arriba.

### Límites que afectan la disponibilidad

Render Free duerme el servicio tras inactividad (aprox. 15 min), y el primer
acceso posterior puede tardar cerca de un minuto; puede reiniciar instancias.
Neon Free escala el compute a cero por inactividad y tiene cuotas de cómputo y
almacenamiento. La base externa persiste independientemente del disco efímero
del contenedor, pero las cuotas, políticas y disponibilidad del plan gratuito
pueden cambiar. Render documenta sus
[límites Free](https://render.com/docs/free); Neon publica cuotas en
[Plans](https://neon.com/docs/introduction/plans). Ambos describen Free como
adecuado a pruebas, prototipos o proyectos pequeños, no como SLA de producción.
No compartir datos reales o sensibles. Revisar límites oficiales antes de
comprometerse.

## Verificación local y CI

```powershell
npm ci
npm test
npm run lint
```

Las pruebas usan PGlite para ejecutar PostgreSQL compatible sin servicio
externo. CI de GitHub Actions ejecuta pruebas y lint en Node 22. La verificación
local de PGlite no sustituye una prueba de despliegue contra Neon: hacer
health-check y CRUD de aceptación tras publicar.

## Operación y recuperación

- Observar `GET /healthz`, errores 5xx y logs de Render.
- No hay backups automáticos garantizados en el plan gratuito; exportar
  periódicamente con `pg_dump` desde un entorno seguro y ensayar restauración.
- Cambiar claves comprometidas desde el panel y restablecer contraseñas de
  usuarios usando un procedimiento administrativo seguro.
- Revisar migraciones antes de publicar; respaldar antes de cualquier cambio
  destructivo.
