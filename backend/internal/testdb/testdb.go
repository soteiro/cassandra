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
	baseURL, msg := baseURL()
	if msg != "" {
		skipMsg = msg
		return
	}
	testURL, err := recreate(baseURL, name)
	if err != nil {
		initErr = err
		return
	}
	if err = database.RunMigrations(testURL); err != nil {
		initErr = err
		return
	}
	pool, initErr = pgxpool.New(context.Background(), testURL)
}

// NewEmpty crea (o recrea) la base cassandra_test_<name> vacía, sin migraciones, y
// devuelve su URL. Sirve para probar las migraciones en sí (p. ej. migrar hasta una
// versión, cargar datos y seguir). Usa un nombre distinto del de New.
func NewEmpty(t *testing.T, name string) string {
	t.Helper()
	base, msg := baseURL()
	if msg != "" {
		t.Skip(msg)
	}
	u, err := recreate(base, name)
	if err != nil {
		t.Fatalf("testdb: %v", err)
	}
	return u
}

// baseURL devuelve la URL del servidor de test, o un mensaje para saltar los tests.
func baseURL() (string, string) {
	if u := os.Getenv("TEST_DATABASE_URL"); u != "" {
		return u, ""
	}
	env, err := godotenv.Read(filepath.Join(moduleRoot(), ".env"))
	if err != nil || env["DATABASE_URL_LOCAL"] == "" {
		return "", "sin base de datos de test: define TEST_DATABASE_URL o DATABASE_URL_LOCAL en backend/.env"
	}
	return env["DATABASE_URL_LOCAL"], ""
}

// recreate borra y crea la base cassandra_test_<name> y devuelve su URL.
func recreate(baseURL, name string) (string, error) {
	dbName := "cassandra_test_" + name
	if !safeName.MatchString(dbName) {
		return "", fmt.Errorf("nombre de base de datos no permitido: %q", dbName)
	}
	testURL, err := withDatabase(baseURL, dbName)
	if err != nil {
		return "", err
	}
	adminURL, _ := withDatabase(baseURL, "postgres")

	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		return "", fmt.Errorf("conectando a postgres: %w", err)
	}
	defer admin.Close(ctx)
	if _, err = admin.Exec(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE)", dbName)); err != nil {
		return "", err
	}
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+dbName); err != nil {
		return "", err
	}
	return testURL, nil
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
