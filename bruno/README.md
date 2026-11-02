# Colección de Cassandra para Bruno

Abre `cassandra api/opencollection.yml` en Bruno y selecciona el entorno
`cassandra`. Las rutas se contrastan con `backend/server/router.go`.

1. Configura `base_url` (sin `/api` ni barra final), `email` y la variable secreta
   `password` en el entorno de Bruno.
2. Ejecuta `auth/login`: guarda `access_token` y `refresh_token` desde las cookies
   de respuesta en variables de ejecución. No persiste los secretos en YAML.
3. Ejecuta `auth/me` para guardar `user_id`. `auth/refresh` renueva el token mediante
   la cookie `refresh_token`; `auth/logout` cierra la sesión y vacía ambas variables.
4. Ajusta los IDs del entorno a recursos propios: `proyecto_id`, `tarea_id`,
   `persona_id`, etc. `tarea_padre_id` debe ser una tarea del mismo proyecto.
   Las altas existentes no actualizan automáticamente esos IDs.

Las peticiones habituales heredan el JWT del entorno. Las carpetas de memoria
y tareas de integración usan `api_key`: crea una con `api keys/Crear clave`
después del login. Esa petición guarda el secreto y su ID en variables de ejecución;
la clave queda limitada a `proyecto_id` con los permisos indicados en el cuerpo.
Para probar las integraciones con sesión, cambia el bearer de esas carpetas a
`{{access_token}}`. Administrar claves requiere sesión.

Para guardar memoria, consulta primero el contexto: captura `memory_revision`.
Cambia `memory_operacion_id` para cada avance nuevo. Un reintento debe mantener
todo el cuerpo original, incluida la revisión; no vuelvas a consultar contexto
entre el intento y su reintento. Para crear otra tarea de integración, cambia
`task_operacion_id`; repetir el mismo identificador y cuerpo devuelve la creación
original. La creación de integración captura `tarea_id`.

`anio`, `mes`, `anio_destino` y `mes_destino` controlan los ejemplos de finanzas.
`desde` y `hasta` son fechas RFC3339 para el resumen de actividad. TickTick usa
la fecha de hoy en `time_zone`; su configuración y el flujo OAuth están descritos
en [docs/TICKTICK.md](../docs/TICKTICK.md). Abre `authorization_url` en el navegador;
la petición de callback es solo para diagnóstico manual con un código y estado
vigentes de un solo uso.

La colección incluye altas, modificaciones, eliminaciones y revocaciones. Ejecuta
las peticiones que necesites de forma individual; no es una suite para ejecutar
recursivamente contra una instancia con datos personales. Las variables secretas
se configuran en Bruno y no deben incorporarse a los archivos versionados.
