# Directorio de migraciones
MIGRATIONS_DIR = backend/database/migrations
# APK Android (Capacitor)
APK_DEBUG_SRC = frontend/android/app/build/outputs/apk/debug/app-debug.apk
APK_MOBILE = cassandra-mobile.apk
# JDK para Gradle (fallback si JAVA_HOME no existe o es inválido)
JAVA_FALLBACK = $(HOME)/.jdks/jbr-21.0.11

.PHONY: help migration build run dev-backend dev-frontend test docs mobile mobile-sync mobile-install mobile-clean all

help: ## Muestra la lista de comandos disponibles
	@echo "Comandos disponibles:"
	@echo "  make migration name=nombre  -> Crea un nuevo par de archivos de migración (.up y .down)"
	@echo "  make docs                   -> Regenera la documentación OpenAPI desde las colecciones de Bruno"
	@echo "  make build                  -> Compila Docs, Angular y Go en el binario ./cassandra-app"
	@echo "  make run                    -> Compila y ejecuta la aplicación completa"
	@echo "  make dev-backend            -> Ejecuta el backend en modo desarrollo"
	@echo "  make dev-frontend           -> Regenera docs y ejecuta el servidor de desarrollo de Angular"
	@echo "  make test                   -> Ejecuta los tests del backend"
	@echo "  make upload-server          -> sube al server configurado en config ssh"
	@echo "  make mobile                 -> Compila Angular (mobile) + Capacitor + Gradle y deja listo ./$(APK_MOBILE)"
	@echo "  make mobile-sync            -> Solo build Angular mobile + cap sync (sin compilar APK)"
	@echo "  make mobile-install         -> Instala el APK en dispositivo/emulador conectado y lo abre"
	@echo "  make mobile-clean           -> Limpia el build de Android y el APK copiado"
	@echo "  make all                    -> Compila todo: ./cassandra-app + ./$(APK_MOBILE)"
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

docs: ## Regenera la documentación OpenAPI a partir de Bruno
	@node scripts/generate-docs.js

build: ## Compila Frontend y Backend usando build.sh
	@bash build.sh

run: build ## Compila todo y corre el binario ./cassandra-app
	@./cassandra-app

dev-backend: ## Ejecuta el backend en Go directamente
	@cd backend && air

dev-frontend: docs ## Ejecuta el servidor de desarrollo de Angular (con docs actualizadas)
	@cd frontend && npm start

upload-server: 
	@scp ./cassandra-app cassandra:~/cassandra-app
test: ## Ejecuta los tests de Go
	@cd backend && go test ./...

mobile-sync: ## Build Angular (config mobile) + cap sync android
	@cd frontend && pnpm run mobile:sync

mobile: mobile-sync ## Compila APK debug y lo deja listo en ./cassandra-mobile.apk
	@echo "📦 Compilando APK debug con Gradle..."
	@if [ -x "$$JAVA_HOME/bin/java" ]; then JAVA="$$JAVA_HOME"; else JAVA="$(JAVA_FALLBACK)"; fi; \
	if [ ! -x "$$JAVA/bin/java" ]; then echo "❌ Java no válido: $$JAVA (JAVA_HOME=$$JAVA_HOME)"; exit 1; fi; \
	echo "☕ Usando JAVA_HOME=$$JAVA"; \
	cd frontend/android && JAVA_HOME="$$JAVA" ./gradlew assembleDebug
	@cp $(APK_DEBUG_SRC) $(APK_MOBILE)
	@echo "✅ APK listo: ./$(APK_MOBILE)"

mobile-install: ## Instala el APK en el dispositivo/emulador conectado y lo abre
	@if [ ! -f "$(APK_MOBILE)" ] && [ ! -f "$(APK_DEBUG_SRC)" ]; then \
		echo "❌ No hay APK. Corre primero: make mobile"; \
		exit 1; \
	fi
	@if [ -f "$(APK_MOBILE)" ]; then \
		adb install -r $(APK_MOBILE); \
	else \
		adb install -r $(APK_DEBUG_SRC); \
	fi
	@adb shell am start -n com.cassandra.app/.MainActivity

mobile-clean: ## Limpia builds de Android y el APK copiado
	@if [ -x "$$JAVA_HOME/bin/java" ]; then JAVA="$$JAVA_HOME"; else JAVA="$(JAVA_FALLBACK)"; fi; \
	cd frontend/android && JAVA_HOME="$$JAVA" ./gradlew clean
	@rm -f $(APK_MOBILE)
	@echo "🧹 Limpieza Android lista"

all: build mobile ## Compila todo: binario web + APK móvil
	@echo "✅ Todo compilado:"
	@echo "   - ./cassandra-app (backend + frontend web)"
	@echo "   - ./$(APK_MOBILE) (app Android)"
