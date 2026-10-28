package database_test

import (
	"context"
	"io/fs"
	"strings"
	"testing"
	"testing/fstest"

	"cassandra/database"
	"cassandra/internal/testdb"

	"github.com/jackc/pgx/v5"
)

func TestTaskMigrationPreservesExistingKeysAndRollbackRevokesTaskKeys(t *testing.T) {
	url := testdb.NewEmpty(t, "integration_tasks_migration")
	before := fstest.MapFS{}
	if err := fs.WalkDir(database.MigrationFS(), "migrations", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if strings.TrimPrefix(path, "migrations/")[:6] >= "000031" {
			return nil
		}
		data, err := fs.ReadFile(database.MigrationFS(), path)
		before[path] = &fstest.MapFile{Data: data}
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.RunMigrationsFrom(url, before, "migrations"); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var userID, projectID int
	if err := conn.QueryRow(ctx, `INSERT INTO users(nombre,email) VALUES('Ana','migration@tasks.test') RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRow(ctx, `INSERT INTO proyectos(user_id,nombre,por_que,para_que,criterio_finalizacion,prioridad) VALUES($1,'Proyecto','ordenar','trabajar','comprobado','Media') RETURNING id`, userID).Scan(&projectID); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO api_keys(user_id,nombre,prefijo,token_hash,scopes) VALUES($1,'Anterior','cass_mem_old',repeat('a',64),ARRAY['memory:read'])`, userID); err != nil {
		t.Fatal(err)
	}
	if err := database.RunMigrations(url); err != nil {
		t.Fatal(err)
	}
	var valid bool
	if err := conn.QueryRow(ctx, `SELECT scopes=ARRAY['memory:read'] AND revocada_en IS NULL FROM api_keys WHERE nombre='Anterior'`).Scan(&valid); err != nil || !valid {
		t.Fatalf("la migración alteró la clave anterior: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO api_keys(user_id,nombre,prefijo,token_hash,scopes) VALUES
		($1,'Solo tareas','cass_mem_task',repeat('b',64),ARRAY['tasks:read','tasks:create']),
		($1,'Combinada','cass_mem_both',repeat('c',64),ARRAY['memory:read','tasks:read'])`, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO tareas_proyectos(user_id,proyecto_id,nombre) VALUES($1,$2,'Conservar')`, userID, projectID); err != nil {
		t.Fatal(err)
	}
	down, err := fs.ReadFile(database.MigrationFS(), "migrations/000031_add_integration_tasks.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, string(down)); err != nil {
		t.Fatal(err)
	}
	var oldActive, newRevoked, taskCount int
	if err := conn.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM api_keys WHERE nombre='Anterior' AND scopes=ARRAY['memory:read'] AND revocada_en IS NULL),
		(SELECT count(*) FROM api_keys WHERE nombre IN ('Solo tareas','Combinada') AND revocada_en IS NOT NULL AND scopes=ARRAY['memory:read']),
		(SELECT count(*) FROM tareas_proyectos WHERE nombre='Conservar')`).Scan(&oldActive, &newRevoked, &taskCount); err != nil {
		t.Fatal(err)
	}
	if oldActive != 1 || newRevoked != 2 || taskCount != 1 {
		t.Fatalf("rollback: claves anteriores=%d, nuevas revocadas=%d, tareas conservadas=%d", oldActive, newRevoked, taskCount)
	}
	up, err := fs.ReadFile(database.MigrationFS(), "migrations/000031_add_integration_tasks.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, string(up)); err != nil {
		t.Fatalf("reaplicar después del rollback: %v", err)
	}
}
