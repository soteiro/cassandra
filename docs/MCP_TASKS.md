# Crear y consultar tareas por MCP

El mismo ejecutable `cassandra-memory-mcp` permite crear tareas y consultar las
que ya existen en Cassandra. Usa el proyecto vinculado en `.cassandra-memory.json`
y la clave por proyecto descrita en [la guía de clientes](MCP_CLIENT_SETUP.md).
Las tareas se guardan en `tareas_proyectos` y aparecen en la aplicación habitual.

## Permisos y activación

En **Configuración → Conexiones → Claves API**, seleccionar los proyectos y los
permisos independientes de **Memoria** y **Tareas**:

| Permiso | Autoriza |
|---|---|
| `tasks:read` | Listar tareas y leer detalles en los proyectos seleccionados. |
| `tasks:create` | Crear tareas o subtareas en esos proyectos. |

La opción **Leer y crear tareas** concede ambos. También se admite `tasks:create`
sin lectura por REST. Los permisos de memoria no conceden acceso a tareas, y los
de tareas no conceden acceso a memoria. Las claves no permiten editar, completar,
eliminar o mover tareas, ni acceder al REST general.

La migración 31 amplía los permisos admitidos y añade el registro de operaciones;
conserva los permisos de las claves existentes. Desplegar backend y frontend,
compilar el conector con `make build-memory-mcp`, emitir una clave nueva con los
permisos elegidos y reiniciar el cliente después de reemplazar la clave guardada.
Se mantienen el nombre del ejecutable, el prefijo `cass_mem_`, las variables y las
rutas de memoria existentes. No hace falta otro servidor MCP ni exponer uno remoto.

## Herramientas

| Herramienta | Argumentos |
|---|---|
| `crear_tarea` | `proyecto_id`, `operacion_id`, `nombre`; opcionales: `descripcion`, `comentario`, `prioridad`, `tarea_padre_id`. |
| `listar_tareas` | `proyecto_id`; opcionales: `consulta`, `estado`, `prioridad`, `tarea_padre_id`, `limit`, `offset`. |
| `obtener_tarea` | `proyecto_id`, `tarea_id`. |

Ejemplo de creación:

```json
{
  "proyecto_id": 12,
  "operacion_id": "9d6e6f62-dabc-44bf-b5b2-c7c6425a219e",
  "nombre": "Revisar la propuesta",
  "descripcion": "Anotar los puntos pendientes antes de enviarla.",
  "prioridad": "alta"
}
```

La tarea nace en estado `Abierto` y prioridad `normal` si no se especifica otra.
El nombre admite entre 1 y 500 caracteres, y descripción y comentario hasta 4000
caracteres cada uno. Se recortan los espacios exteriores; las prioridades admitidas
son `baja`, `normal`, `alta` y `urgente`. No se aceptan campos de usuario, proyecto
alternativo o estado en la creación. El usuario se determina con la autenticación.

Para crear una subtarea, añadir `tarea_padre_id` de una tarea activa del mismo
proyecto. Un padre de otro proyecto se rechaza aunque pertenezca al mismo usuario.

Ejemplo de consulta:

```json
{
  "proyecto_id": 12,
  "estado": "Abierto",
  "prioridad": "alta",
  "consulta": "propuesta",
  "limit": 10,
  "offset": 0
}
```

Los filtros se combinan. Los estados admitidos son `Abierto`, `Pendiente`,
`En Curso`, `Terminado` y `Bloqueado`. La búsqueda es literal, sin distinguir
mayúsculas, en nombre, descripción y comentario: `%` y `_` no son comodines.
La consulta admite hasta 300 bytes; `limit` admite 1–20 (10 por defecto), y
`offset` 0–10000. El orden es por ID descendente. Continuar sumando `limit` al
`offset` mientras `hay_mas` sea `true`; son páginas por desplazamiento, por lo que
altas o borrados entre consultas pueden desplazar los resultados.

El listado devuelve `{ "tareas": [], "hay_mas": false }` si no hay coincidencias.
Cada fila contiene `proyecto_id`, datos de la tarea, fechas y `tarea_padre_id`.
Es un listado plano: omitir el filtro de padre devuelve todos los niveles; usar
`tarea_padre_id: 0` devuelve solo principales y un ID positivo sus subtareas directas.
El detalle no carga un árbol de subtareas. Los textos antiguos que superen 4000
caracteres por campo se acotan e indican `texto_truncado: true`, sin alterar lo guardado.

## Reintentos y errores

`operacion_id` debe tener entre 8 y 100 caracteres: letras ASCII, números,
guion, guion bajo, punto o dos puntos. Generar un identificador por creación y
conservarlo ante un timeout o pérdida de conexión. No requiere leer la revisión de
memoria: las operaciones de tareas y memoria tienen registros independientes.

La tarea, su evento con origen `mcp` y el resultado se guardan en una transacción.
Repetir la misma operación en el mismo proyecto devuelve la respuesta original,
incluido el ID, sin crear otra tarea. Usar el mismo identificador con datos
distintos devuelve conflicto. La comparación usa los valores normalizados. La
respuesta original se conserva aunque después se edite o elimine la tarea; un
reintento nunca la restaura. Para leer su estado actual usar `obtener_tarea`.

La autenticación y los permisos se comprueban en cada petición, incluidos
reintentos. Una clave revocada o vencida deja de poder recuperar resultados.
Las instrucciones del MCP piden crear tareas solo por solicitud del usuario;
los próximos pasos de la memoria no se convierten automáticamente en tareas.

| HTTP | Significado |
|---|---|
| `400` / `413` | Entrada inválida, campos desconocidos o cuerpo mayor de 64 KiB. |
| `401` | Sin autenticación válida; clave revocada, vencida o usuario inactivo. |
| `403` | Falta el permiso de lectura o creación. |
| `404` | Proyecto, tarea o padre inexistente, eliminado o fuera de alcance. |
| `409` | Identificador de operación reutilizado con otros datos. |

## Contrato REST

Las siguientes rutas admiten sesión o `Authorization: Bearer cass_mem_…`:

| Método y ruta | Permiso |
|---|---|
| `POST /api/integrations/projects/{project_id}/tasks` | `tasks:create` |
| `GET /api/integrations/projects/{project_id}/tasks` | `tasks:read` |
| `GET /api/integrations/projects/{project_id}/tasks/{task_id}` | `tasks:read` |

En REST, el proyecto va en la ruta y no en el cuerpo; el filtro textual se llama
`q` en lugar de `consulta`. La creación devuelve `201` tanto inicialmente como
al repetirla. Las lecturas devuelven `200` y las respuestas usan `Cache-Control: no-store`.

El rollback explícito de la migración elimina el registro de idempotencia y
revoca las claves que tenían permisos de tareas, conservando las tareas y los
metadatos de las claves. Las claves dedicadas a memoria conservan su acceso.
