# Guía de usuario de Incidenta

## Acceso

1. Abre [Incidenta](https://plataforma-incidenta.onrender.com) por HTTPS.
2. Inicia sesión con el nombre de usuario y contraseña que te haya entregado
   por un canal privado. No compartas una cuenta con otros usuarios.
3. Pulsa **Cerrar sesión** al terminar, especialmente en un equipo compartido.

Las cuentas iniciales del despliegue son `admin`, `analista` y `lector`. La
contraseña de `admin` es la que se configuró en Render como
`SEED_ADMIN_PASSWORD`; las contraseñas de los otros roles también las definió
el propietario durante el despliegue. No existe una contraseña predeterminada
y nadie puede consultar las claves en texto claro. La interfaz no ofrece
recuperación automática: si se pierde una contraseña, contacta al
administrador del sistema para que aplique el procedimiento de recuperación
aprobado. Cambiar una variable `SEED_*_PASSWORD` después de crear la cuenta no
rota su clave. Nunca envíes una contraseña por correo, chat o captura.

## Funciones por rol

| Rol | Consultar y filtrar | Crear | Actualizar | Eliminar |
|---|---:|---:|---:|---:|
| Lector | Sí | No | No | No |
| Analista | Sí | Sí | Sí | No |
| Admin | Sí | Sí | Sí | Sí |

Los permisos se verifican también en la API; ocultar un botón en la interfaz
no concede ni quita permisos.

## Consultar incidentes

- **Resumen** presenta indicadores generales y actividad reciente.
- En **Incidentes**, escribe palabras del título o categoría en la búsqueda.
  Espera un instante para que se aplique el filtro.
- Usa las listas de estado y prioridad para acotar resultados; los filtros se
  pueden combinar.
- Si hay varias páginas, usa **Anterior** y **Siguiente**. Se muestran hasta 50
  elementos por página; el API limita el máximo a 100.
- Pulsa **Ver detalle** para consultar el incidente.

## Registrar un incidente

Disponible para analistas y administradores:

1. Abre **Registrar** o el panel **Nuevo incidente**.
2. Completa el título (3–80 caracteres), categoría, prioridad, fecha y
   descripción (hasta 500 caracteres); agrega un correo válido si corresponde.
3. Pulsa **Registrar incidente** una sola vez y espera el aviso de éxito.
4. Si aparece un error de validación, corrige los campos señalados. No
   recargues ni vuelvas a enviar antes de recibir el resultado.

La aplicación evita doble envío en un mismo formulario. Reporta errores
persistentes al administrador e incluye el mensaje, nunca la contraseña ni un
token.

## Actualizar y cerrar

Analistas y administradores pueden abrir **Ver detalle**, cambiar campos
permitidos y guardar. Para cerrar, selecciona el estado **Resuelto**; el
historial refleja el estado actualizado.

## Eliminar

Solo un administrador puede eliminar. La acción no debe usarse como forma
habitual de cerrar un incidente; prefiere el estado **Resuelto**. Antes de
confirmar, verifica que sea el registro correcto. Una eliminación es
permanente en la aplicación; la recuperación depende de una copia de seguridad.

## Uso responsable

Introduce solo información necesaria para atender el incidente. Evita
contraseñas, tokens, datos financieros o información personal sensible en el
título y descripción. Reporta incidentes de seguridad por el canal acordado de
la organización.

## Problemas frecuentes

- **La contraseña de admin no funciona:** confirma que el usuario sea
  `admin` y utiliza el valor original configurado en Render como
  `SEED_ADMIN_PASSWORD`. Cambiar esa variable después no cambia la contraseña
  almacenada.
- **La página tarda al abrirse:** el hosting gratuito puede haberse dormido.
  Espera la reactivación y vuelve a cargar si es necesario.
- **401 / sesión vencida:** inicia sesión nuevamente.
- **403 / acción no permitida:** tu rol no tiene permiso para esa operación.
- **No aparece el nuevo registro:** revisa filtros y página actual; limpia los
  filtros y busca por título.
- **Servicio no disponible:** informa el URL y hora al administrador; no
  compartas datos de acceso.

## Disponibilidad

El despliegue de demostración usa planes gratuitos. Render puede suspender la
instancia cuando queda inactiva, por lo que el primer acceso posterior puede
tardar alrededor de un minuto. Neon mantiene la base de datos por separado,
pero su plan tiene cuotas y límites; evita datos personales sensibles y no
consideres este entorno un servicio con SLA o copias de seguridad garantizadas.
