# Cassandra

ERP personal autoalojado: proyectos y tareas, notas y documentos Markdown, CRM
personal y finanzas mensuales. Backend en Go, frontend en Angular y app Android
con Capacitor.

- **Autoalojar tu instancia:** [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)
- **Descargas** (binario del servidor y APK): [Releases](https://github.com/soteiro/cassandra/releases)
- **Cambios por versión:** [CHANGELOG.md](CHANGELOG.md)
- **Memoria de proyectos y MCP:** [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)
- **Crear y consultar tareas por MCP:** [docs/MCP_TASKS.md](docs/MCP_TASKS.md)
- **Planificar tareas en el calendario por MCP:** [docs/MCP_PLANIFICACION.md](docs/MCP_PLANIFICACION.md)
- **Leer notas de proyecto por MCP:** [docs/MCP_NOTAS.md](docs/MCP_NOTAS.md)
- **Configurar MCP en Codex, Claude Code y OpenCode:** [guía](docs/MCP_CLIENT_SETUP.md)

## Desarrollo

| Comando | Qué hace |
|---|---|
| `make dev-backend` | Backend con recarga en caliente (`air`). |
| `make dev-frontend` | Angular en http://localhost:4200 con proxy a la API. |
| `make test` | Tests de Go (requiere PostgreSQL; ver `backend/internal/testdb`). |
| `make test-frontend` | Tests unitarios del frontend (Vitest). |
| `make test-e2e` | Tests end-to-end (Playwright) contra backend y PostgreSQL reales. |
| `make build` | Binario `./cassandra-app` con el frontend embebido. |
| `make mobile` | APK de debug. |
| `cd frontend && pnpm start:demo` | Demo de portafolio en http://localhost:4200, sin backend. |

## Demo de portafolio

Build del frontend que no necesita backend: la API se simula en el navegador con datos
ficticios (`frontend/src/demo`) y cada visitante guarda sus cambios en su `localStorage`. No
incluye CRM ni finanzas. El build normal no la incluye (se activa con `fileReplacements` en la
configuración `demo` de `angular.json`).

- **Deploy:** `.github/workflows/deploy-demo.yml` la publica en Cloudflare Pages con cada push a
  `main` que toque el frontend. Necesita los secrets `CLOUDFLARE_API_TOKEN` (permiso
  *Account → Cloudflare Pages → Edit*) y `CLOUDFLARE_ACCOUNT_ID`.
- **Mantenerla al día:** si cambia un endpoint, actualiza `src/demo/mock/api.ts`; los datos de
  ejemplo están en `src/demo/mock/seed.ts`. Si cambia la forma de los datos guardados, sube
  `DB_VERSION` en `src/demo/mock/db.ts` para que los visitantes reciban el seed nuevo. CI compila
  la demo y corre sus tests en cada PR.

El backend lee su configuración de `backend/.env` (ver la tabla de variables en la guía de autoalojamiento).
