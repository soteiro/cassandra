#!/bin/bash
    set -e

    echo "0. Regenerando Documentación OpenAPI desde Bruno..."
    node scripts/generate-docs.js

    echo "1. Compilando Frontend Angular..."
    cd frontend
    npm run build
    cd ..

    echo "2. Copiando archivos de distribución a backend/dist..."
    rm -rf backend/dist
    mkdir -p backend/dist
    cp -r frontend/dist/frontend/browser/* backend/dist/

    # Versión: VERSION del entorno (CI) o el último tag de git (+commits y -dirty).
    VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"

    echo "3. Compilando binario de Go (versión $VERSION)..."
    cd backend
    go build -ldflags="-s -w -X main.version=$VERSION" -o ../cassandra-app .
    cd ..

    echo "✅ ¡Compilación exitosa! Binario generado: ./cassandra-app"
