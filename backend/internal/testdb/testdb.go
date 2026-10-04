// Package testdb prepara una base de datos Postgres desechable para tests de integración.
//
// La URL se toma de TEST_DATABASE_URL (CI) o, en local, del DATABASE_URL_LOCAL de
// backend/.env cambiando el nombre de la base por cassandra_test_<nombre>. La base se
// borra y recrea una vez por proceso de test y se aplican las migraciones reales.
// Entre tests se vacían todas las tablas.
package testdb

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"testing"

	"cassandra/database"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	once    sync.Once
	pool    *pgxpool.Pool
	initErr error
	skipMsg string
)

var safeName = regexp.MustCompile(`^cassandra_test_[a-z0-9_]+$`)

// New devuelve un pool conectado a la base de test, con todas las tablas vacías.
// name identifica al paquete (p. ej. "handlers") para que los paquetes que corren
// en paralelo con `go test ./...` no compartan base de datos.
func New(t *testing.T, name string) *pgxpool.Pool {
	t.Helper()
	once.Do(func() { setup(name) })
	if skipMsg != "" {
		t.Skip(skipMsg)
	}
	if initErr != nil {
		t.Fatalf("testdb: %v", initErr)
	}
	truncateAll(t)
	return pool
}

func setup(name string) {
	baseURL := os.Getenv("TEST_DATABASE_URL")
	if baseURL == "" {
		env, err := godotenv.Read(filepath.Join(moduleRoot(), ".env"))
		if err != nil || env["DATABASE_URL_LOCAL"] == "" {
			skipMsg = "sin base de datos de test: define TEST_DATABASE_URL o DATABASE_URL_LOCAL en backend/.env"
			return
		}
		baseURL = env["DATABASE_URL_LOCAL"]
	}

	dbName := "cassandra_test_" + name
	if !safeName.MatchString(dbName) {
		initErr = fmt.Errorf("nombre de base de datos no permitido: %q", dbName)
		return
	}
	testURL, err := withDatabase(baseURL, dbName)
	if err != nil {
		initErr = err
		return
	}
	adminURL, _ := withDatabase(baseURL, "postgres")

	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		initErr = fmt.Errorf("conectando a postgres: %w", err)
		return
	}
	defer admin.Close(ctx)
	if _, err = admin.Exec(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE)", dbName)); err != nil {
		initErr = err
		return
	}
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+dbName); err != nil {
		initErr = err
		return
	}

	if err = database.RunMigrations(testURL); err != nil {
		initErr = err
		return
	}
	pool, initErr = pgxpool.New(ctx, testURL)
}

// truncateAll vacía todas las tablas de la aplicación (no las de migraciones).
func truncateAll(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT string_agg(format('%I', tablename), ', ')
		FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`)
	if err != nil {
		t.Fatalf("testdb: listando tablas: %v", err)
	}
	var tables *string
	for rows.Next() {
		if err := rows.Scan(&tables); err != nil {
			t.Fatalf("testdb: %v", err)
		}
	}
	rows.Close()
	if tables == nil {
		return
	}
	if _, err := pool.Exec(ctx, "TRUNCATE "+*tables+" RESTART IDENTITY CASCADE"); err != nil {
		t.Fatalf("testdb: truncando tablas: %v", err)
	}
}

func withDatabase(rawURL, dbName string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("URL de base de datos inválida: %w", err)
	}
	u.Path = "/" + dbName
	return u.String(), nil
}

// moduleRoot sube desde el directorio actual hasta encontrar go.mod.
func moduleRoot() string {
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "."
		}
		dir = parent
	}
}
