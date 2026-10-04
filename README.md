# Cassandra

ERP personal autoalojado: proyectos y tareas, notas y documentos Markdown, CRM
personal y finanzas mensuales. Backend en Go, frontend en Angular y app Android
con Capacitor.

- **Autoalojar tu instancia:** [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)
- **Descargas** (binario del servidor y APK): [Releases](https://github.com/soteiro/cassandra/releases)
- **Cambios por versión:** [CHANGELOG.md](CHANGELOG.md)

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

El backend lee su configuración de `backend/.env` (ver la tabla de variables en la guía de autoalojamiento).
