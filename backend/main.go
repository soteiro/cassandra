package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"

	"cassandra/config"
	"cassandra/database"
	"cassandra/server"
)

//go:embed dist/*
var frontendFS embed.FS

// version se inyecta al compilar: go build -ldflags "-X main.version=v1.2.3".
var version = "dev"

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "version" || os.Args[1] == "--version") {
		fmt.Println(version)
		return
	}

	// 1. Cargar configuración
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("configuración inválida: %v", err)
	}

	// 2. Conectar a PostgreSQL
	dbPool, err := database.Connect(cfg.DatabaseUrl)
	if err != nil {
		log.Fatalf("error al conectar el pool: %v", err)
	}
	defer dbPool.Close()

	// 3. Ejecutar migraciones
	if err := database.RunMigrations(cfg.DatabaseUrl); err != nil {
		log.Fatalf("error al ejecutar las migraciones: %v", err)
	}

	// Subcomandos de administración (create-user, reset-password): se ejecutan y salen.
	if len(os.Args) > 1 {
		err := runCommand(context.Background(), os.Args[1:], dbPool, terminalPassword, os.Stdout)
		dbPool.Close()
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		return
	}

	// 4. Frontend embebido y router HTTP (rutas en server/router.go)
	distFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		log.Fatalf("error al cargar frontend embebido: %v", err)
	}
	r := server.NewRouter(server.Options{Config: cfg, DB: dbPool, Frontend: distFS, Version: version})

	fmt.Printf("Cassandra %s running on port %s\n", version, cfg.Port)
	http.ListenAndServe(":"+cfg.Port, r)
}
