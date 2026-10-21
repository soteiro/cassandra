# Memoria de proyectos y MCP

El conector local ofrece cuatro herramientas a un asistente de programación. El
asistente redacta la memoria con la conversación y el repositorio que tiene
disponibles; Cassandra la valida y guarda. No se contrata ni ejecuta un modelo en
el servidor, no se ingieren chats automáticamente y no se publica un MCP remoto.

## 1. Publicar y generar una clave desde la interfaz

Integrar la rama mediante el flujo habitual de QA/release descrito en
[deploy/README.md](../deploy/README.md). La migración 29 añade las tablas de memoria
y claves. La 30 traslada las copias gestionadas de memoria a `project_logs`,
conserva sus fechas y referencias, y oculta los documentos originales sin borrarlos.
Los documentos y logs manuales se conservan. El despliegue a producción crea su
respaldo normal. Esta entrega de desarrollo no despliega ni genera keys de prod.

Desplegar también el frontend de esta rama. Con la sesión iniciada, abrir
**Claves API** en la barra lateral; en móvil, abrir primero **Menú**.
La dirección de la pantalla es `/claves-api`.

1. Escribir un nombre identificable para el asistente.
2. Seleccionar entre uno y cincuenta proyectos propios.
3. Elegir **Leer y guardar memoria** si el agente registrará avances y decisiones;
   **Solo leer memoria** permite consultar el contexto sin modificarlo.
4. Elegir vencimiento (90 días por defecto) y pulsar **Generar clave**.
5. Pulsar **Copiar clave**, guardarla en el entorno del conector y cerrar el aviso
   con **Ya la guardé**. El secreto no vuelve a mostrarse; si se pierde, revocar
   esa clave y generar otra. Si el portapapeles falla, el campo permite copia manual.

La lista muestra prefijo, proyectos, permisos, vencimiento y último uso. **Revocar**
pide confirmación y corta el acceso en próximas peticiones. El secreto solo se
mantiene en memoria mientras se muestra el aviso; no se guarda en el navegador.

La gestión de keys usa la sesión existente y también está disponible por REST:

| Método y ruta | Resultado |
|---|---|
| `POST /api/api-keys` | Emitir key: el secreto aparece una sola vez en `token`. |
| `GET /api/api-keys` | Listar metadatos propios, sin secreto ni huella. |
| `DELETE /api/api-keys/{id}` | Revocar inmediatamente para próximas peticiones. |

Por ejemplo, desde Bruno con sesión válida en el servidor de destino:

```json
{
  "nombre": "Asistente de programación",
  "scopes": ["memory:read", "memory:write"],
  "proyecto_ids": [12]
}
```

Sustituir `12` por un proyecto propio existente. Puede añadirse `expira_en` en
RFC3339; el vencimiento debe estar en el futuro. Se admiten de uno a cincuenta
proyectos por key. Guardar el secreto en el gestor de secretos/entorno del cliente,
fuera del repositorio y de la conversación. Una key permite solo memoria; no es una
sesión JWT ni autoriza REST general, administración de keys, tareas, CRM o finanzas.

El login actual devuelve cookies: conservarlas en el cookie jar de Bruno/curl.
Si se usa cookie, quitar un header Authorization heredado vacío o incorrecto:
el backend lo considera autoritativo y no cae a la cookie.

## 2. Compilar e iniciar el conector local

Para configurar por proyecto Codex, Claude Code u OpenCode, seguir la
[guía de clientes MCP](MCP_CLIENT_SETUP.md), con plantillas sin secretos.

```bash
make build-memory-mcp
```

Produce `./cassandra-memory-mcp`, independiente del binario del servidor. El
conector requiere `CASSANDRA_URL` y `CASSANDRA_API_KEY` en su entorno; sin
`CASSANDRA_API_KEY` usa la key guardada del proyecto vinculado (ver
[guía de clientes MCP](MCP_CLIENT_SETUP.md#alternativa-un-mcp-global-con-una-key-por-proyecto)). HTTPS es
obligatorio salvo `localhost`, `127.0.0.1` o `::1` para pruebas. No sigue
redirecciones. stdout está reservado al protocolo MCP; los diagnósticos van a stderr.

Ejemplo de configuración de Codex (ajustar la ruta absoluta):

```toml
[mcp_servers.cassandra-memory]
command = "/ruta/a/cassandra/cassandra-memory-mcp"
env_vars = ["CASSANDRA_URL", "CASSANDRA_API_KEY"]
```

El proceso que inicia el agente debe recibir ambas variables de forma segura.
Configurar un transporte local `stdio` equivalente en otros clientes MCP. Consultar
su documentación antes de trasladar la configuración específica de Codex.

Vincular cada repositorio mediante un archivo `.cassandra-memory.json` sin secretos:

```json
{"proyecto_id": 12, "servidor": "https://cassandra.ejemplo.com"}
```

La URL del archivo es una referencia para el agente; no cambia la conexión del
conector. El endpoint efectivo es exclusivamente `CASSANDRA_URL`.

## 3. Instalar la skill

La skill versionada está en
[`integrations/skills/cassandra-memory`](../integrations/skills/cassandra-memory/SKILL.md).
Copiar esa carpeta a la ubicación de skills del cliente. En Codex puede instalarse
para el usuario en `~/.agents/skills/cassandra-memory/`. La copia de este repositorio
no se instala ni modifica automáticamente configuraciones personales.

La skill puede activarse por su descripción o invocarse como `$cassandra-memory`.
Primero recuperar contexto, luego guardar conclusiones útiles y avances
significativos. Si la intención no está registrada, pregunta; si una acción es
solo una sugerencia, la identifica como tal. La autorización del usuario y las
políticas del cliente siguen aplicándose a las escrituras.

## 4. Contrato REST y herramientas

Las rutas bajo `/api/memory` aceptan sesión normal o `Authorization: Bearer
cass_mem_…`. Las demás rutas solo admiten su autenticación normal.

| Herramienta | Operación REST |
|---|---|
| `obtener_contexto` | `GET /api/memory/projects/{id}` |
| `buscar_memoria` | `GET /api/memory/projects/{id}/entries?q=texto&limit=10&offset=0&historico=false` |
| `guardar_avance` | `POST /api/memory/projects/{id}/advances` |
| `registrar_decision` | La misma operación de guardado, con una sola ficha. |

Ejemplo de avance; en MCP añadir `proyecto_id: 12` a estos argumentos:

```json
{
  "operacion_id": "1a34ddf3-fd59-4bfc-8513-e16936e85f64",
  "revision_esperada": 0,
  "memoria": {
    "de_que_trata": "Conservar el contexto necesario para retomar este proyecto.",
    "en_que_quede": "Primera exploración; implementación pendiente.",
    "por_que_asi": "Se eligió una síntesis breve para limitar la lectura acumulada.",
    "que_sigue": ["Comprobar un cierre de sesión con un proyecto piloto."],
    "fuentes": [{"tipo": "conversacion", "referencia": "Exploración de memoria, 2026-10-18"}]
  },
  "fichas": [{
    "titulo": "Memoria acotada",
    "contenido": "Actualizar la síntesis en vez de añadirle cada sesión; conservar razones relevantes en fichas consultables.",
    "tipo": "decision",
    "estado": "elegida",
    "fuentes": [{"tipo": "conversacion", "referencia": "Exploración de memoria, 2026-10-18"}]
  }]
}
```

- Memoria: cuatro apartados obligatorios, hasta 400 palabras (sin contar fuentes),
  máximo tres acciones y 24000 bytes de texto.
- Ficha: título de hasta 160 caracteres; título y contenido suman hasta 150 palabras
  y el contenido no excede 6000 bytes. Hasta cinco fichas por operación.
- Tipos: `decision` / `exploracion`. Estados nuevos: `explorada`, `elegida`,
  `implementada`, `descartada`. `sustituye_id` conserva una ficha anterior del mismo
  proyecto como `sustituida`; una ficha ya sustituida no se vuelve a sustituir.
- Fuentes: de una a diez por memoria/ficha; tipos `commit`, `conversacion`, `archivo`
  o `nota`, con referencia identificable de hasta 1024 caracteres.
- Contexto: síntesis y cinco fichas vigentes recientes, con el total indicado. No
  implica que sean todas las decisiones relevantes: buscar por demanda.
- El propósito/criterio del proyecto existente se limita a 1200 caracteres por
  campo; `proyecto.texto_truncado` avisa cuando no se devolvió todo el texto.
- Búsqueda textual literal: hasta 20 resultados por página. `historico=true`
  incluye descartadas/sustituidas; `hay_mas` permite continuar por offset.
- Una operación que guarde solo fichas también aumenta la revisión. Usar la última
  revisión leída. Un 409 exige reconciliar; nunca forzar la escritura.
- Reintentar con el mismo `operacion_id` y el mismo cuerpo devuelve el resultado
  original. Reusar el ID con otro cuerpo se rechaza. Validación, revisión,
  logs, fichas e idempotencia se guardan en una transacción por proyecto.
- Las lecturas y escrituras nuevas devuelven `log_id` como referencia visible.
  `documento_id` se conserva por compatibilidad con resultados antiguos; reintentar
  una operación anterior a la migración devuelve su resultado original.

## 5. Lectura en Cassandra y límites de la entrega

Dentro de **Documentos** hay dos pestañas: **Documentos** para los documentos que
redactas y **Project logs** para la bitácora. La síntesis aparece como **Memoria
actual** en Project logs, junto con las fichas de decisiones y exploraciones.
La lista permite buscar por título o contenido y recorrer páginas de 30 entradas.
Al abrir una entrada se renderiza Markdown, incluidos los diagramas Mermaid, y se
puede copiar el texto original.

Las entradas gestionadas se modifican mediante la operación de memoria para
mantener revisión y contenido estructurado consistentes. El CRUD normal de logs
rechaza su edición o borrado con 409. Los documentos manuales mantienen su editor.

La captura depende del agente y de las fuentes a las que tenga acceso. La skill no
garantiza ejecución al cerrar abruptamente ni instala hooks. No hay búsqueda
semántica, modelo en el servidor, lectura global de chats, MCP remoto ni OAuth.

## Verificación

El paquete `backend/apitests/memory` prueba el recorrido de cliente MCP real → API
HTTP → PostgreSQL desechable, además de permisos, aislamiento, revocación,
vencimiento, límites, rollback, reintentos y escrituras concurrentes. Usar
`TEST_DATABASE_URL` apuntando a un servidor local de pruebas; el harness recrea
únicamente bases `cassandra_test_*`.

Fuentes de implementación: [SDK Go MCP](https://github.com/modelcontextprotocol/go-sdk),
[MCP en Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[skills de Codex](https://learn.chatgpt.com/docs/build-skills).
