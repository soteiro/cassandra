# Planificar tareas en el calendario por MCP

El conector `cassandra-memory-mcp` también funciona como PM. Ve el tiempo libre
del usuario en el calendario, estima tareas, reserva bloques de trabajo con hora
antes de cada deadline y cambia el estado de las tareas, incluido cerrarlas. Usa
el mismo ejecutable, la misma clave `cass_mem_…` y la misma vinculación por
proyecto que la [memoria](PROJECT_MEMORY.md) y las [tareas](MCP_TASKS.md).

## Cómo se calculan los huecos libres

Un hueco es tiempo en que el usuario puede trabajar. Cassandra lo calcula así:

1. Parte del **horario base**: las franjas de cada día de la semana en que el
   usuario puede trabajar (por ejemplo, de lunes a viernes de 14:00 a 18:00).
2. Suma lo que **libera** un calendario. Por ejemplo, el colegio: mientras el
   hijo está ahí, hay tiempo libre aunque quede fuera del horario base.
3. Resta lo que **ocupa** un calendario (terapias, citas) y los bloques de
   trabajo ya reservados.
4. Los calendarios de **contexto**, como los turnos de otra persona, no cambian
   los huecos, pero el asistente los ve como información.

Los huecos empiezan en la hora actual del cliente, se cortan a medianoche y no se
ofrecen los de menos de 15 minutos. Las actividades canceladas no cuentan. Los
turnos usan sus horas reales: el Largo va de 08:00 a 20:00 y la Noche de 20:00 a
08:00 del día siguiente.

Una actividad también puede cruzar la medianoche. Si su término es anterior a su
inicio (por ejemplo, dormir de 22:30 a 07:00), termina al día siguiente: ocupa la
noche de su día y la madrugada del siguiente. En `ver_disponibilidad` aparece con
`termina_dia_siguiente: true`.

En la aplicación, la capa **Para trabajar** muestra estos huecos como fondo verde
en las vistas de semana y día, y como una línea en la agenda del día. Ahí no se
descuentan los bloques ya reservados (se dibujan encima) ni la hora actual. Se
puede ocultar como cualquier capa.

Un **choque** solo se marca entre cosas del mismo dueño: dos del mismo
calendario (dos cosas del hijo a la vez), o dos que te ocupan a ti (calendarios
*me ocupa* y bloques de trabajo). Que el colegio, que libera, se cruce con tu
traslado, que ocupa, no es un choque.

La disponibilidad se fija **por calendario**. Si un mismo calendario mezcla cosas
que liberan y cosas que ocupan (el colegio y las terapias del hijo), hay que
separarlas en dos calendarios. Al crear un calendario de turnos, la disponibilidad
por defecto es `contexto`; en uno de actividades es `ocupa`.

## Configurar

1. Desplegar el backend con la migración 34. Esta añade la estimación de tareas,
   la disponibilidad de los calendarios, el horario base, los bloques y los
   permisos nuevos. Los calendarios de turnos que ya existían pasan a `contexto`;
   el resto queda en `ocupa`.
2. En **Calendario → Calendarios…**, editar cada calendario y elegir en
   **Para planificar tareas** si *me ocupa*, *me libera* o es *solo contexto*.
   Luego abrir **Horario de trabajo…** y fijar las franjas de cada día. Por REST:
   `PUT /api/calendarios/{id}` con `disponibilidad` y
   `PUT /api/calendario/horario-base`.
3. En **Configuración → Conexiones → Claves API**, editar la clave del
   asistente (o emitir una nueva) con
   **Tareas: Leer, crear, cerrar y planificar tareas** y **Calendario: Ver mi
   tiempo libre**, y marcar los calendarios que el asistente puede ver con
   detalle. Por REST, los permisos son `tasks:manage` y `calendar:read`, y los
   calendarios van en `calendario_ids`:

   ```json
   {
     "nombre": "PM",
     "scopes": ["tasks:read", "tasks:manage", "calendar:read"],
     "proyecto_ids": [12],
     "calendario_ids": [3]
   }
   ```

4. Compilar el conector (`make build-memory-mcp`) y reiniciar el cliente MCP. Si
   se editó la clave existente, no hay que reemplazarla en el conector.

| Permiso | Autoriza |
|---|---|
| `calendar:read` | Ver la disponibilidad: huecos, eventos, bloques y deadlines. |
| `tasks:manage` | Cambiar estado, prioridad, fechas y estimación de tareas, y reservar o quitar bloques, en los proyectos de la clave. |

### Privacidad

El calendario puede contener datos de la familia, así que la clave muestra solo
lo que se elige:

- **Calendarios en `calendario_ids`:** se ven con su nombre y el título de cada
  evento.
- **Calendarios que no están en la lista:**
  - Los que ocupan aparecen como `"Ocupado"`, sin título ni calendario.
  - Los que liberan cambian los huecos pero no se listan.
  - Los de contexto no aparecen.
- **Bloques y deadlines:** se ven con nombre solo los de proyectos de la clave.
  Los bloques de otros proyectos aparecen como `"Ocupado"`.

Los huecos siempre se calculan con todo el calendario, para que el asistente no
proponga horas que ya están ocupadas.

## Herramientas

| Herramienta | Argumentos | Permiso |
|---|---|---|
| `ver_disponibilidad` | opcionales: `desde`, `hasta` (`YYYY-MM-DD`, máximo 31 días; por defecto hoy y 13 días más). | `calendar:read` |
| `actualizar_tarea` | `proyecto_id`, `tarea_id`; uno o más de: `estado`, `prioridad`, `fecha_inicio`, `fecha_limite`, `estimacion_min`, `quitar_fecha_inicio`, `quitar_fecha_limite`, `quitar_estimacion`. | `tasks:manage` |
| `planificar_tarea` | `proyecto_id`, `tarea_id`, `operacion_id`, `bloques` (de 1 a 20 con `fecha`, `hora_inicio` y `hora_fin`). | `tasks:manage` |
| `quitar_bloque` | `proyecto_id`, `bloque_id`. | `tasks:manage` |

El conector envía su hora local como `ahora`; como corre en la máquina del
usuario, los huecos empiezan en la hora real de este.

Respuesta de `ver_disponibilidad`, resumida:

```json
{
  "desde": "2026-11-16", "hasta": "2026-11-29", "ahora": "2026-11-16T09:30",
  "horario_base": [{"dia_semana": 0, "hora_inicio": "14:00", "hora_fin": "18:00"}],
  "calendarios": [{"id": 3, "nombre": "Colegio", "tipo": "actividades", "disponibilidad": "libera"}],
  "huecos": [{"fecha": "2026-11-16", "hora_inicio": "09:30", "hora_fin": "13:00", "minutos": 210}],
  "minutos_libres": 2940,
  "eventos": [
    {"fecha": "2026-11-17", "hora_inicio": "15:00", "hora_fin": "16:00", "titulo": "Ocupado", "disponibilidad": "ocupa"}
  ],
  "bloques": [{"id": 8, "tarea_id": 41, "tarea": "Informe", "fecha": "2026-11-17", "hora_inicio": "16:00", "hora_fin": "17:30", "origen": "mcp"}],
  "deadlines": [{"tipo": "tarea", "id": 41, "titulo": "Informe", "fecha_limite": "2026-11-18"}],
  "avisos": []
}
```

Si no hay horario base, `avisos` lo indica: en ese caso los huecos solo incluyen
lo que liberan los calendarios.

### Reglas de los bloques

- Se guardan todos o ninguno.
- No pueden solaparse entre sí ni con otros bloques del usuario. Un solape
  responde `409`.
- Un bloque que no cae entero en un hueco libre se guarda igual, con un aviso en
  `avisos`, porque el usuario puede pedir trabajar fuera de su horario.
- `hora_fin` admite `24:00`.
- Repetir la misma petición con el mismo `operacion_id` devuelve el resultado
  original. Usar el mismo identificador con otros datos responde `409`.
- En la aplicación, los bloques aparecen en la capa **Planificado** del
  calendario. Esa capa se puede ocultar y solo se muestra cuando hay bloques.
  Al tocar dos veces un bloque se abren sus opciones: **Abrir proyecto** y
  **Quitar bloque**. Por REST, los bloques vienen en `GET /api/calendario`
  (campo `bloques`) y se quitan con `DELETE /api/calendario/bloques/{id}`.
- La estimación también se edita en el detalle de la tarea (**Estimación**).

### Reglas de los cambios de tareas

- Pasar una tarea a `Terminado` también cierra sus subtareas pendientes, igual
  que en la aplicación.
- Al cerrar una tarea se liberan sus bloques de trabajo y los de las subtareas
  que se cierran con ella. Reabrir una tarea permite planificarla de nuevo.
- Los cambios quedan en el historial con origen `mcp`.
- `fecha_inicio` no puede ser posterior a `fecha_limite`.
- `estimacion_min` admite de 1 a 10080 minutos.
- Las tareas ahora incluyen `fecha_inicio`, `fecha_limite`, `estimacion_min` y
  `minutos_planificados` (la suma de sus bloques vigentes) también en `listar_tareas` y
  `obtener_tarea`.

## Contrato REST

Estas rutas admiten sesión o `Authorization: Bearer cass_mem_…`:

| Método y ruta | Permiso |
|---|---|
| `GET /api/integrations/calendar?desde&hasta&ahora` | `calendar:read` |
| `PATCH /api/integrations/projects/{project_id}/tasks/{task_id}` | `tasks:manage` |
| `POST /api/integrations/projects/{project_id}/tasks/{task_id}/bloques` | `tasks:manage` |
| `DELETE /api/integrations/projects/{project_id}/bloques/{bloque_id}` | `tasks:manage` |

`ahora` usa el formato `AAAA-MM-DDTHH:MM`; si falta, se usa la hora del
servidor. Con sesión normal se ve todo el calendario y todos los proyectos.

Estas rutas solo admiten sesión:

| Método y ruta | Uso |
|---|---|
| `GET` / `PUT /api/calendario/horario-base` | Leer o reemplazar las franjas (`{"franjas": [...]}`). |
| `PUT /api/calendarios/{id}` | Acepta `disponibilidad`: `ocupa`, `libera` o `contexto`. |
| `DELETE /api/calendario/bloques/{id}` | Quitar un bloque propio. |

El rollback de la migración 34 quita los permisos nuevos de las claves y revoca
las que se quedan sin permisos. También borra los bloques, el horario base, la
estimación y la disponibilidad.
