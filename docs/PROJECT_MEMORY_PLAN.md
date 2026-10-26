# Memoria de proyectos: plan de implementación

Fecha: 2026-10-18. Rama: `feat/project-memory-mcp`.

## Resultado

Retomar un proyecto leyendo una memoria de hasta 400 palabras que responda de qué
trata, en qué quedó, por qué se decidió así y qué sigue (hasta tres acciones).
Conservar exploraciones y decisiones en fichas de hasta 150 palabras con estado y
fuentes. La memoria se actualiza; el historial se consulta por demanda.

## Pasos

1. [x] Crear la rama y registrar alcance, criterios y orden de trabajo.
2. [x] Añadir migraciones aditivas: API keys por usuario/proyecto, memoria actual,
   fichas e identificadores de operaciones para reintentos sin duplicados.
3. [x] Implementar emisión/listado/revocación de keys desde la sesión existente.
   Guardar únicamente la huella del secreto; comprobar usuario activo, expiración,
   revocación, proyectos autorizados y permisos `memory:read` / `memory:write`.
4. [x] Implementar operaciones compartidas de contexto, búsqueda y guardado atómico.
   Validar longitudes, estados y fuentes; usar revisión esperada contra escrituras
   concurrentes. Mostrar la memoria y fichas en la bitácora del proyecto.
5. [x] Exponer REST de memoria con autenticación acotada. Una key de memoria no
   permite acceder a finanzas, CRM, administración de keys ni REST general.
6. [x] Crear un conector MCP local stdio con el SDK oficial Go. Se conecta por HTTPS
   al backend de producción con una key del entorno; no conecta con PostgreSQL.
   Herramientas: contexto, búsqueda, guardar avance y registrar decisión.
7. [x] Crear una skill reutilizable: recuperar contexto al retomar, distinguir
   exploración/decisión/implementación, preguntar ante vacíos materiales y guardar
   avances significativos sin esperar únicamente al cierre de una sesión.
8. [x] Verificar el flujo con PostgreSQL desechable y cliente MCP real. Cubrir
   aislamiento, permisos, revocación/vencimiento, límites, idempotencia y concurrencia.
9. [x] Documentar creación de keys, configuración local, prueba piloto y entrega
   mediante el proceso de release existente.
10. [x] Añadir **Claves API** a la web y al menú móvil: generación con proyectos,
    permisos y vencimiento; copia del secreto una sola vez, listado y revocación.
11. [x] Separar **Documentos** y **Project logs** dentro de Documentos. Renderizar
    la bitácora con Markdown/Mermaid, búsqueda y paginación. Persistir las copias de
    memoria en `project_logs` y migrar las anteriores conservando los datos manuales.

## Decisiones de esta entrega

- El modelo que ya atiende la conversación redacta la memoria. Cassandra no
  necesita proveedor de IA, API key de un modelo ni acceso a historiales externos.
- Los secretos van en el entorno del conector; los archivos de proyecto contienen
  únicamente URL/identificador de proyecto. La key nunca es un argumento de herramienta.
- La gestión de keys se ofrece desde **Configuración → Conexiones → Claves API** en la interfaz y mediante
  REST autenticado (usable con Bruno/curl). La interfaz no persiste el secreto:
  solo permite copiarlo al emitirlo y conserva metadatos para listar/revocar.
- El conector es local y la persistencia es remota. No se publica un endpoint MCP
  HTTP ni se implementa OAuth en esta entrega.
- Las fichas sustituidas conservan su contenido y fuentes. Los reintentos con el
  mismo identificador y otro contenido se rechazan.
- Los logs reflejan la memoria para leerla en la web; la versión estructurada es
  la fuente de las operaciones del agente. Los documentos quedan para el contenido
  que redacta el usuario. La migración 30 oculta las copias gestionadas anteriores
  después de trasladarlas, y conserva las referencias y resultados idempotentes.
- La skill se versiona en `integrations/skills/cassandra-memory/` para poder
  instalarla en cada agente. No se modifican configuraciones personales del usuario.
- El diseño local previo en `docs/MCP_DESIGN.md` describe otro flujo de tareas.
  Este trabajo se rige por el alcance de memoria autorizado en esta conversación.

## Aceptación

- Un agente puede leer contexto y guardar un avance y una decisión usando una key
  limitada a un proyecto propio. La memoria es visible en Documentos → Project logs.
- Otro usuario/proyecto o un permiso insuficiente nunca permite leer ni escribir.
- Una key revocada/vencida o de un usuario eliminado deja de servir; los listados
  de keys no revelan el secreto ni su huella.
- Se puede generar una key desde la interfaz, copiarla o seleccionarla manualmente,
  descartar el secreto y revocar con confirmación. Los errores permiten reintentar.
- Un reintento devuelve el resultado original; una revisión obsoleta no pisa un
  avance de otro agente. Un fallo no deja logs/fichas parcialmente escritos.
- El servidor rechaza memoria/fichas demasiado largas y el contexto/búsqueda están
  acotados. La exploración no se presenta como trabajo ya implementado.
- Pruebas y migraciones se ejecutan contra una base desechable. Publicación y
  despliegue a producción quedan fuera de esta ejecución de desarrollo.

## Verificación realizada

- Suite completa `go test ./...` contra PostgreSQL local desechable: correcta.
- Pruebas de memoria y MCP con `-race`: correctas; dos escrituras concurrentes
  con la misma revisión dejan una guardada y la otra en conflicto.
- Recorrido de cliente MCP real a REST y PostgreSQL: las cuatro herramientas
  funcionan. Prueba adicional del ejecutable por stdin/stdout: inicialización y
  descubrimiento de herramientas correctos, sin exponer el secreto.
- Límites, referencias cruzadas, expiración, revocación, aislamiento, logs
  gestionados, rollback e idempotencia cubiertos por integración. La migración 30
  se prueba desde la versión 29 y al revertirse: conserva contenido, documentos y
  logs manuales, títulos de 160 caracteres y resultados de reintentos anteriores.
- Documentos, subpestañas, Project logs, servicio y renderizador Markdown: 82
  pruebas correctas. Chromium a 390 y 1280 px con API simulada: Markdown/Mermaid,
  portapapeles real, búsqueda, paginación, errores recuperables y navegación por
  teclado correctos. El borrador de documentos se conserva al cambiar de pestaña.
  AXE sin infracciones y sin desbordamiento horizontal. Los bloques de código
  admiten desplazamiento mediante teclado. Capturas: `/tmp/cassandra-logs-ui/`.
- Gestión de claves: 29 pruebas correctas entre pantalla, servicio y barra lateral.
  Chromium a 390 y 1280 px con API simulada: generación, portapapeles real,
  descarte del secreto, recarga sin recuperarlo y revocación correctos, sin
  desbordamiento. AXE sin infracciones WCAG A/AA en formulario, validación,
  emisión y enlace de navegación. Capturas: `/tmp/cassandra-keys-ui/`.
- Skill validada con `quick_validate.py`; detector de UI sin hallazgos sobre el
  archivo cambiado; `git diff --check` correcto.

## Siguiente paso operativo

Revisar e integrar esta rama mediante el proceso de release existente. Una vez
desplegados backend y frontend, emitir una key para un proyecto piloto desde **Claves API**,
configurar el conector y copiar la skill al cliente. Seguir
[PROJECT_MEMORY.md](PROJECT_MEMORY.md). El MCP remoto/OAuth sigue como ampliación posterior.
