#!/bin/bash
    set -e

    echo "1. Compilando Frontend Angular..."
    cd frontend
    pnpm build
    cd ..

    echo "2. Copiando archivos de distribución a backend/dist..."
    rm -rf backend/dist
    mkdir -p backend/dist
    cp -r frontend/dist/frontend/browser/* backend/dist/

    echo "3. Compilando binario de Go..."
    cd backend
    go build -o ../cassandra-app main.go
    cd ..

    echo "✅ ¡Compilación exitosa! Binario generado: ./cassandra-app"