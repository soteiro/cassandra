# TickTick en Home: alcance de la primera versión

Estado: implementación de la primera versión en la rama; activación OAuth pendiente de configurar por entorno.
Fecha: 2026-10-28. Rama: `feat/ticktick-integration`, creada desde `qa` en `aee0bb7`.
Origen: tarea #56 del proyecto Cassandra y confirmación del usuario: **solo ver las tareas de hoy**.

## Resultado esperado

Consultar desde Home las tareas de hoy de la cuenta TickTick conectada, con
título, lista de origen, prioridad y hora o indicación de día completo. TickTick
sigue siendo la fuente de esos datos. Las tareas externas no se convierten en
tareas de Cassandra ni se mezclan con sus acciones de completar o cambiar estado.

Una persona puede usar Cassandra aunque no conecte TickTick. Cada usuario ve
únicamente su propia conexión y sus tareas. Un fallo del proveedor debe quedar
contenido en el widget de TickTick, conservando operativos los módulos locales.

## Condición de viabilidad: lectura de Inbox

El usuario recordó un problema previo para leer el buzón de entrada. Su cobertura
queda como primera condición que comprobar, antes de implementar la pantalla de
conexión completa y el widget. Una consulta correcta de las listas no demuestra
que también se hayan recuperado las tareas de Inbox.

Aurora llama `getProjectData("inbox")`, que construye
`GET /open/v1/project/inbox/data`. No resuelve un identificador real del buzón ni
comprueba que ese alias sea aceptado por ese endpoint. El historial incorporó
la llamada en `1e2fdcf` y la conservó en `d0d120b`; eso acredita el intento de
integración, no una respuesta correcta de la cuenta.

La documentación actual acepta `inbox` en `projectIds` de
`POST /open/v1/task/undone`. Ese contrato no garantiza que el mismo literal
funcione como `projectId` en la ruta de lectura por proyecto. La solución del
problema anterior no se considera comprobada por la mera presencia de código
o documentación.

La primera prueba debía recuperar con `tasks:read` una tarea conocida de Inbox
con vencimiento de hoy, comparar su ID con la interfaz TickTick y contrastar la
consulta específica del buzón con la consulta global. Una respuesta vacía no
prueba que Inbox esté vacío. Si no se consigue una lectura oficial verificable,
se revisaría el alcance antes de avanzar; no se dará por completa una entrega que
omita el buzón ni se recurrirá automáticamente a endpoints privados.

**Comprobación realizada (2026-10-28):** la cuenta de Aurora devolvía cero tareas
pendientes; el usuario confirmó que las anteriores estaban completadas y añadió
una. La nueva tarea apareció con el mismo identificador en la lectura por
`project/inbox/data`, en `task/undone` de Inbox (hoy y rango de catorce días) y en
la consulta global de hoy. No se guardaron títulos, identificadores ni credenciales
en el repositorio. La respuesta de Inbox contiene `tasks` y `columns`, pero no
`project`; el cliente admite ese esquema. Una respuesta sin `tasks` sí se considera
incompleta. Esta prueba acredita ese caso real; no acredita todos los tipos de
recurrencia o rangos de fechas de una cuenta.

## Revisión de Aurora

Se revisó estáticamente el árbol actual de `/home/soteiro/Escritorio/proyectos/aurora`,
que contiene cambios locales. El código es un antecedente para adaptar a Go;
no demuestra por sí solo el comportamiento actual de una cuenta TickTick real.

| Archivo de Aurora | Hallazgo y aplicación a Cassandra |
|---|---|
| `server/utils/fetchers/ticktickFetcher.ts` | Usa la Open API con Bearer y separa llamadas HTTP del negocio. Reutilizar el patrón en un cliente Go; añadir timeout, límites y errores acotados. El token actual es global, no pertenece a un usuario de Cassandra. |
| `server/utils/services/ticktickService.ts` | Consulta listas e intenta leer Inbox con el literal `inbox`; filtra por `dueDate` de hoy y normaliza resultados. Conservar la separación entre adquisición y filtrado, además de la identidad de lista y tarea, verificando primero la cobertura del buzón. |
| `server/utils/services/ticktickService.ts:3` | Compara fechas con `new Date()` y la zona local del proceso. No usa `runtimeConfig.timezone`; en Cassandra el día debe depender de una zona IANA explícita. |
| `server/utils/services/ticktickService.ts:28` | Excluye únicamente estado `2`. La documentación actual también contempla tareas abandonadas (`-1`); el widget debe seleccionar tareas activas (`0`). |
| `server/utils/services/ticktickService.ts:43` | Inbox y listas iniciales dependen de `Promise.all`; después consulta cada lista en serie. Un fallo descarta el resultado completo y cada petición repite el recorrido. Añadir caché y distinguir resultado parcial de ausencia de tareas. |
| `server/api/task.get.ts` | El `Promise.all` entre proveedores hace fallar la respuesta combinada. En el catch devuelve un campo `status: 500`, sin fijar el estado HTTP. Cassandra tendrá un endpoint y recurso independientes para TickTick. |
| `scripts/ticktick-auth.ts` | Ya solicita OAuth con `tasks:read`. El `state` fijo no se valida al volver, y el script imprime el token para configurarlo manualmente. Adaptar el flujo a una conexión por usuario con estado aleatorio, temporal y de un solo uso. |

El `AGENTS.md` de Aurora menciona tareas de hoy o vencidas, pero el servicio
revisado filtra solo vencimiento de hoy. El alcance confirmado coincide con ese
filtro de hoy; no se añadirá una sección de vencidas en esta entrega.

## Qué incluye

1. **Conexión propia por usuario.** Entrada TickTick en Configuración → Conexiones:
   conectar mediante OAuth, consultar estado y desconectar. Pedir únicamente
   `tasks:read`. Guardar credenciales de usuario cifradas en el servidor, separadas
   del secreto de sesión y de las claves MCP. Una cuenta TickTick por usuario.
2. **Widget independiente en Home.** Mostrar las tareas activas de hoy, con la
   cobertura de Inbox comprobada en la primera prueba. Mostrar lista, prioridad,
   horario y fecha de última consulta, con actualización manual y orden estable.
3. **Regla inicial de hoy.** Para mantener continuidad con Aurora, seleccionar
   tareas activas cuyo `dueDate` corresponda al día solicitado en la zona IANA
   del usuario; inicialmente la comunicada por el navegador. Respetar la fecha
   civil de las tareas de día completo y su `timeZone`, sin trasladarlas de día
   por convertirlas indiscriminadamente a UTC. Excluir completadas, abandonadas,
   sin vencimiento, vencidas en días anteriores y futuras. El tratamiento de
   rangos con inicio y fin distintos se validará expresamente con casos reales.
4. **Estados comprensibles.** Sin conexión configurada, cargando, sin tareas,
   consulta completa, consulta parcial, datos anteriores y autorización vencida.
   Un error o una respuesta incompleta no se presentará como «sin tareas».
5. **Carga controlada.** Consulta desde el backend, caché breve por usuario,
   conexión, fecha y zona horaria; invalidación al desconectar o sustituir la
   conexión. Actualización al entrar en Home, al cambiar de día y por petición
   manual. Propuesta inicial: caché de cinco minutos y agrupación de solicitudes
   concurrentes, sin recolector periódico en segundo plano.
6. **Web y móvil.** Widget adaptable al Home y acceso desde la APK mediante la API
   configurada. Primera propuesta: autorización inicial desde la web; la conexión
   guardada en el servidor sirve después al mismo usuario en Android. El retorno
   OAuth directo a la APK mediante enlaces de aplicación queda fuera de esta versión.

## Contrato oficial y comprobación inicial

La [documentación oficial actual](https://developer.ticktick.com/docs/openapi.md)
incluye OAuth con `tasks:read`, consulta de listas, lectura por proyecto y
`POST /open/v1/task/undone`, con un rango máximo de catorce días y el alias
`inbox` en su filtro `projectIds`. También documenta un filtro que devuelve como máximo doscientas tareas,
cuyas fechas filtran por `startDate`, no por `dueDate`.

La implementación consulta las listas y sus tareas, además de Inbox de forma
explícita, y filtra localmente por `dueDate`. No equivale a todos los criterios
de la vista «Hoy» de TickTick. Si falla la lectura directa de Inbox, intenta
`task/undone` con el rango del día e informa resultado parcial: la documentación
no precisa qué fecha usa ese filtro en todos los casos. Nunca presenta ese
fallback como prueba de inventario completo.

La comprobación previa al adaptador debe verificar:

- Acceso con permiso de solo lectura a listas, consulta por rango y una tarea
  conocida de Inbox, comparando identidad y cobertura con la interfaz de TickTick.
- Vencimiento de hoy con y sin hora, medianoche, rango de fechas y cambio horario
  de `America/Santiago`; comparación con tareas conocidas de la cuenta.
- Ocurrencias recurrentes devueltas por TickTick, sin expandir reglas de repetición
  ni generar ocurrencias en Cassandra.
- Respuestas truncadas y límites de resultados. Una respuesta de doscientas filas
  del filtro no demuestra que el inventario esté completo.
- Respuesta ante expiración, denegación y desconexión. El flujo de renovación
  automática no se presupone; inicialmente se admite volver a autorizar.

La comprobación autenticada fue exclusivamente de lectura. No se copiaron las
credenciales de Aurora a Cassandra ni se modificó Aurora.

## Implementación en Cassandra

Flujo: Home Angular → endpoint autenticado Go → servicio de consulta y fechas →
cliente TickTick. Las credenciales permanecen en el backend. La conexión de
TickTick no pasa por las herramientas ni las claves del MCP.

- `backend/internal/ticktick/`: cliente HTTP con credenciales por petición,
  DTO del proveedor, normalización, límites, caché y clasificación de errores.
- `backend/handlers/`: estado de conexión, inicio y retorno OAuth, desconexión y
  consulta del día. Sesión existente para iniciar operaciones y leer tareas;
  callback validado con estado ligado al usuario, vencimiento y un solo uso.
- `backend/repository/` y nueva migración: conexión por usuario y estados OAuth
  temporales. Tokens cifrados con clave de integración del servidor; borrar datos
  de conexión y caché al desconectar. Conservar la clave de cifrado en despliegues
  y respaldos para poder recuperar las credenciales guardadas.
- `backend/config/` y documentación de autoalojamiento: aplicación OAuth,
  callback exacto por entorno y clave de cifrado. No reutilizar automáticamente
  el token de Aurora ni alterar su configuración.
- `frontend/src/app/services/` y `models/`: contrato propio de tareas externas;
  conservar IDs y prioridades del proveedor sin confundirlos con tareas locales.
- `frontend/src/app/pages/home/`: componente TickTick con recurso independiente.
  `frontend/src/app/pages/configuracion/`: entrada y pantalla de conexión.

Rutas implementadas:

| Método y ruta | Operación |
|---|---|
| `GET /api/connections/ticktick` | Consultar estado, sin devolver secretos. |
| `POST /api/connections/ticktick/authorize` | Preparar autorización de solo lectura. |
| `GET /api/connections/ticktick/callback` | Procesar el retorno OAuth validado. |
| `DELETE /api/connections/ticktick` | Desconectar al usuario y limpiar su caché. |
| `GET /api/ticktick/tasks/today?date=YYYY-MM-DD&time_zone=...` | Consultar el día con fecha y zona validadas. |

Un `POST` de consulta a la API de TickTick no implica modificar tareas. El cliente
implementa únicamente las operaciones de conexión y lectura de esta entrega.

La caché dura cinco minutos para una lectura completa. Consultas parciales,
errores y actualizaciones manuales respetan una espera mínima de treinta segundos.
Se agrupan consultas concurrentes y se invalidan al cambiar la conexión. El
recorrido tiene un máximo de cincuenta listas, tres solicitudes simultáneas y
doscientas tareas visibles, con advertencia explícita si alcanza los límites.
Las lecturas tienen timeout de diez segundos y el recorrido completo de veinticinco.
Los datos anteriores solo se reutilizan para el mismo usuario, conexión, fecha y
zona, nunca después de un rechazo de autorización.

No se implementaron webhooks: la API pública consultada no documenta suscripciones.
Se consulta al entrar, cambiar de día o pedir Actualizar; no hay un recolector
periódico de tareas. El navegador comprueba cada minuto si cambió el día, sin
consultar al proveedor mientras siga siendo el mismo.

## Fuera de alcance

Completar, crear, editar, borrar o mover tareas en TickTick; sincronización
bidireccional; importación a `tareas_proyectos`; vincular listas externas con
proyectos de Cassandra; filtros configurables por lista; histórico y tareas
vencidas; hábitos, Pomodoro, calendario, notificaciones y envío de correos.
Aurora mantiene sus responsabilidades de notificación; esta entrega no lo migra.

## Criterios de aceptación y entregas

1. **Inbox, contrato y fechas:** resolver primero la lectura de una tarea conocida
   del buzón y comprobar los casos anteriores. Fijar la estrategia de lectura sin
   usar endpoints privados de TickTick antes de construir el resto de la integración.
2. **Backend y conexión:** aislamiento entre dos usuarios, callback OAuth válido,
   `state` inválido o reutilizado, permisos de lectura, expiración, timeout,
   limitación del proveedor, respuesta parcial y desconexión. Ninguna operación
   de tareas modifica TickTick ni las tareas locales.
3. **Home y configuración:** mostrar tareas conocidas del día, listas y horarios;
   gestionar vacío, carga, error y datos anteriores sin bloquear Home. Verificar
   teclado, accesibilidad, escritorio y móvil. La zona del servidor no decide hoy.
4. **Entrega:** pruebas de servicio con reloj controlado y servidor TickTick
   simulado, integración HTTP con PostgreSQL, pruebas del frontend y una
   comprobación de lectura con la cuenta real antes de dar por terminada la tarea #56.

Complejidad estimada: media. Se aprovechan el patrón y las reglas útiles de Aurora,
pero la autenticación por usuario, las fechas, los errores y el widget se adaptan
a Go y Angular. La configuración y las limitaciones operativas se describen en
[TICKTICK.md](TICKTICK.md). Las pruebas automatizadas cubren OAuth, vencimiento
y reutilización de estado, cifrado, aislamiento, carrera con desconexión, Inbox,
errores del proveedor, caché, horarios y cambio de día; los casos de cuenta real
que no se enumeran en la comprobación anterior quedan sin verificar.

Verificación del servicio implementado (2026-10-29): consulta autenticada de solo
lectura con la credencial de Aurora, sin persistirla en Cassandra: estado `ready`,
Inbox leído, dos pendientes de hoy y cero advertencias. OAuth completo se probó
con proveedor simulado y PostgreSQL; la autorización real de Cassandra requiere
registrar su aplicación y configurar las variables descritas en la guía.
