# Directorio de migraciones
MIGRATIONS_DIR = backend/database/migrations

.PHONY: help migration build run dev-backend dev-frontend test

help: ## Muestra la lista de comandos disponibles
	@echo "Comandos disponibles:"
	@echo "  make migration name=nombre  -> Crea un nuevo par de archivos de migración (.up y .down)"
	@echo "  make build                  -> Compila Angular y Go en el binario ./cassandra-app"
	@echo "  make run                    -> Compila y ejecuta la aplicación completa"
	@echo "  make dev-backend            -> Ejecuta el backend en modo desarrollo"
	@echo "  make dev-frontend           -> Ejecuta el frontend con ng serve"
	@echo "  make test                   -> Ejecuta los tests del backend"

migration: ## Crea una nueva migración secuencial (ej: make migration name=crear_tabla_x)
	@if [ -z "$(name)" ]; then \
		echo "❌ Error: Especifica el nombre. Ejemplo: make migration name=mi_migracion"; \
		exit 1; \
	fi
	@command -v migrate >/dev/null 2>&1 || { \
		echo "❌ 'migrate' no está instalado o no está en PATH."; \
		echo "👉 Instálalo con: go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"; \
		echo "👉 Y asegúrate de tener export PATH=\$$PATH:\$$HOME/go/bin"; \
		exit 1; \
	}
	@migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)
	@echo "✅ Archivos de migración creados en $(MIGRATIONS_DIR)/"

build: ## Compila Frontend y Backend usando build.sh
	@bash build.sh

run: build ## Compila todo y corre el binario ./cassandra-app
	@./cassandra-app

dev-backend: ## Ejecuta el backend en Go directamente
	@cd backend && air

dev-frontend: ## Ejecuta el servidor de desarrollo de Angular
	@cd frontend && npm start

test: ## Ejecuta los tests de Go
	@cd backend && go test ./...
