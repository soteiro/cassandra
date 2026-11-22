# Leer notas por MCP

Las notas de proyecto (`notas_proyecto`) las escribe el usuario desde la
aplicación: documentación de cómo se resolvió algo, a menudo vinculada a una
tarea, y notas de negocio. El MCP `cassandra-memory` las **busca y lee**, pero
**no las escribe**: no hay herramienta ni endpoint de integración para crear,
editar o borrar notas.

Así cada canal tiene un autor claro:

| | Autor | Para qué |
|---|---|---|
| **Project logs** (memoria y fichas) | El agente, vía `guardar_avance` / `registrar_decision` | Recordar en qué quedó el trabajo y por qué. |
| **Notas** | El usuario, desde la aplicación | Documentación propia y reglas de negocio. |

Si una nota contradice una ficha, prevalece la nota y el agente avisa al usuario.

## Permiso

Leer notas usa `memory:read`: cualquier clave que lee la memoria de un proyecto
lee también sus notas. No hay un permiso aparte ni hace falta editar las claves
existentes.

## Herramientas

- **`buscar_notas`** (`proyecto_id`, `consulta`, `tarea_id`, `limit`, `offset`):
  búsqueda literal en el texto (`%` y `_` no son comodines, hasta 300 bytes), de
  la más reciente a la más antigua. `tarea_id` filtra por tarea; `0` devuelve las
  notas sin tarea. Páginas de 1 a 20 (10 por defecto) con `hay_mas`.
- **`obtener_tarea`**: con `memory:read`, incluye las cinco notas más recientes
  de la tarea en `notas` y el total en `notas_total`. Sin ese permiso, los campos
  no aparecen.
- **`obtener_contexto`**: incluye solo `notas_total`, para no inflar el contexto;
  las notas se buscan por demanda.

Cada nota devuelve `id`, `proyecto_id`, `tarea_id`, `tarea_nombre`, `nota`,
`texto_truncado` y `fecha_creacion`. El texto se acota a 4000 caracteres; si
`texto_truncado` es verdadero, la nota recibida es parcial. No se devuelven notas
eliminadas, de proyectos eliminados ni de proyectos fuera de la clave.

## REST

`GET /api/memory/projects/{project_id}/notes?q=&tarea_id=&limit=&offset=`, con la
misma autenticación de integraciones que el resto de `/api/memory`.

## Activación

Desplegar el backend y recompilar el conector con `make build-memory-mcp`;
reiniciar el cliente MCP para que anuncie `buscar_notas`. No hay migración.
