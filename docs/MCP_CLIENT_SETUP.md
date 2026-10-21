# Conectar un proyecto con Cassandra desde Codex, Claude Code y OpenCode

Los tres clientes usan el mismo ejecutable local `cassandra-memory-mcp`, que se
conecta a Cassandra por HTTPS. Cada cliente inicia su propio proceso stdio;
Cassandra guarda la memoria del proyecto indicado en cada operación.

## 1. Preparar Cassandra QA y el conector

En **QA → Claves API**, generar una clave para el proyecto con **Leer y guardar
memoria**. Obtener el ID desde su URL: `/proyectos/123` significa ID `123`.
La clave y el ID deben pertenecer a QA: los probados en local son independientes.

En el repositorio de Cassandra, compilar y consultar la ruta del conector:

```bash
make build-memory-mcp
realpath ./cassandra-memory-mcp
```

En la terminal desde la que se iniciará el cliente, cargar las variables (Bash):

```bash
export CASSANDRA_URL='https://qa.ejemplo.com'
read -rsp 'Clave de Cassandra QA: ' CASSANDRA_API_KEY
printf '\n'
export CASSANDRA_API_KEY
```

Sustituir el dominio por el de QA. Usar la URL base, sin `/api` ni `/mcp`.
La clave se introduce sin eco y las plantillas solo contienen referencias a ella.
Estas variables duran en la terminal actual y sus procesos hijos. Una app o IDE
ya abierto necesita recibirlas al iniciarse; un archivo `.env` no se carga por sí
solo con estas configuraciones.

## 2. Configurar el cliente en el repositorio que vas a documentar

Copiar la plantilla correspondiente y sustituir `/ruta/absoluta/cassandra-memory-mcp`
por la ruta obtenida en el paso anterior. Si ya existe configuración, incorporar
la entrada `cassandra-memory` dentro de su tabla u objeto correspondiente.

| Cliente | Plantilla | Archivo de destino en el proyecto | Comprobar |
|---|---|---|---|
| Codex | [TOML](../integrations/mcp/codex.config.example.toml) | `.codex/config.toml` | `codex mcp list`; `/mcp` dentro de Codex |
| Claude Code | [JSON](../integrations/mcp/claude.mcp.example.json) | `.mcp.json` | `claude mcp list`; `/mcp` dentro de Claude |
| OpenCode 2 | [JSON](../integrations/mcp/opencode.v2.example.json) | `opencode.json` | `opencode mcp list`; `/mcps` dentro de OpenCode |

Iniciar `codex`, `claude` u `opencode` desde ese repositorio y esa terminal.
Aceptar la confianza del proyecto o la activación del servidor cuando el cliente
lo solicite. La configuración por proyecto de Codex requiere un proyecto de
confianza. Las claves siguen sujetas a los permisos de Cassandra.

En OpenCode **2**, las entradas van dentro de `mcp.servers`. OpenCode **1** usa
entradas directamente dentro de `mcp`; adaptar la plantilla si se usa esa versión.
La versión local comprobada para esta guía es OpenCode 2.0.28.

## 3. Vincular el proyecto de Cassandra

Copiar [project.example.json](../integrations/mcp/project.example.json) como
`.cassandra-memory.json` en la raíz del repositorio que quieres documentar.
Reemplazar el ID de ejemplo por el del proyecto de QA y el dominio por su URL.

Este archivo orienta al agente; el conector se conecta a `CASSANDRA_URL`.
Mantener ambas URL iguales. La API key determina los proyectos permitidos.

### Alternativa: un MCP global con una key por proyecto

Si registras el conector una sola vez para todo tu usuario, no definas
`CASSANDRA_API_KEY`. Sin esa variable, el conector toma el `proyecto_id` de
`.cassandra-memory.json` (en el directorio de trabajo o hasta la raíz del repositorio)
y lee la key de `~/.config/cassandra-memory/<servidor>/<proyecto_id>.key`.

1. Registrar el conector sin key (el cliente lo inicia en el directorio del repo):

   ```bash
   claude mcp add --scope user cassandra-memory \
     -e CASSANDRA_URL=https://qa.ejemplo.com -- /ruta/absoluta/cassandra-memory-mcp
   ```

   Si ya lo registraste con `CASSANDRA_API_KEY`, quítala (`claude mcp remove` y volver
   a añadirlo): esa variable tiene prioridad y fijaría la misma key para todos.
   En Codex, `env_vars = ["CASSANDRA_URL"]`; en OpenCode, solo `CASSANDRA_URL`.

2. Guardar la key de cada proyecto. `<servidor>` es el host de `CASSANDRA_URL` en
   minúsculas, con `_` en lugar de `:` si lleva puerto (`localhost_8080`):

   ```bash
   dir=~/.config/cassandra-memory/qa.ejemplo.com
   mkdir -p -m 700 "$dir"
   (umask 077; read -rsp 'Clave del proyecto 12: ' k; printf '%s\n' "$k" > "$dir/12.key"); echo
   ```

3. Vincular el repositorio con `.cassandra-memory.json`, como en el paso 3.

Detalles: el archivo de la key debe ser regular y sin permisos para grupo/otros
(`chmod 600`), y la key se busca por el host de `CASSANDRA_URL`, no por el `servidor`
del repositorio, así que un repo ajeno no puede redirigirla. `CASSANDRA_KEYS_DIR`
cambia la carpeta de keys. Si falta el vínculo o la key, el conector arranca igual y
cada herramienta explica qué falta, sin contactar con Cassandra. Hay que reiniciar el
cliente tras actualizar el conector.

## 4. Instalar la skill para retomar y guardar contexto

Copiar la carpeta [cassandra-memory](../integrations/skills/cassandra-memory/SKILL.md)
del repositorio de Cassandra a estas ubicaciones del repositorio de trabajo:

| Cliente | Destino |
|---|---|
| Codex y OpenCode | `.agents/skills/cassandra-memory/` |
| Claude Code | `.claude/skills/cassandra-memory/` |

OpenCode también descubre la copia de `.claude/skills`; basta una de las dos
ubicaciones para ese cliente. Mantener las copias de la skill sincronizadas.
La skill guía la captura de conclusiones y preguntas ante información faltante;
su activación depende del agente y de los permisos de cada cliente.

## 5. Comprobar la conexión

Reabrir el cliente y pedir:

> Lee `.cassandra-memory.json`, usa el MCP cassandra-memory para obtener el contexto
> de ese proyecto y dime en qué quedó y qué sigue.

La prueba debe devolver el nombre del proyecto correcto y su revisión mediante
`obtener_contexto`. El listado de servidores confirma configuración/conexión MCP;
esta llamada comprueba además la clave, los permisos y el acceso a Cassandra QA.

Después, para comprobar escritura:

> Crea una ficha breve de prueba de conexión en este proyecto mediante MCP y
> confirma que puedes recuperarla con buscar_memoria.

El cliente anuncia `obtener_contexto`, `buscar_memoria`, `guardar_avance` y
`registrar_decision`. La memoria y sus fichas aparecen en **Documentos → Project logs**.

QA reinicia su base en cada despliegue según el flujo actual de
[deploy](../deploy/README.md): después hay que generar otra clave y revisar el
ID del proyecto. La memoria duradera se guarda en producción.

## Referencias de configuración

- [MCP en Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) y
  [skills de Codex](https://learn.chatgpt.com/docs/build-skills).
- [MCP en Claude Code](https://code.claude.com/docs/en/mcp) y
  [skills de Claude Code](https://code.claude.com/docs/en/skills).
- [MCP en OpenCode 2](https://opencode.ai/v2/docs/mcp-servers/),
  [configuración](https://opencode.ai/v2/docs/config/) y
  [skills](https://opencode.ai/v2/docs/skills/).
