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

func TestMemoryLogsMigrationPreservesContentAndManualRecords(t *testing.T) {
	url := testdb.NewEmpty(t, "memory_logs_migration")
	before := fstest.MapFS{}
	err := fs.WalkDir(database.MigrationFS(), "migrations", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if strings.TrimPrefix(path, "migrations/")[:6] >= "000030" {
			return nil
		}
		data, err := fs.ReadFile(database.MigrationFS(), path)
		before[path] = &fstest.MapFile{Data: data}
		return err
	})
	if err != nil {
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
	if err := conn.QueryRow(ctx, `INSERT INTO users(nombre,email) VALUES('Ana','migration@memory.test') RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRow(ctx, `INSERT INTO proyectos(user_id,nombre,por_que,para_que,criterio_finalizacion,prioridad) VALUES($1,'Proyecto','recordar','retomar','comprobado','Media') RETURNING id`, userID).Scan(&projectID); err != nil {
		t.Fatal(err)
	}
	createDocument := func(title, content string, managed bool) int {
		t.Helper()
		var id int
		if err := conn.QueryRow(ctx, `INSERT INTO documentos_proyecto(proyecto_id,user_id,titulo,contenido,tipo,gestionado) VALUES($1,$2,$3,$4,'general',$5) RETURNING id`, projectID, userID, title, content, managed).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	manual := createDocument("Entregable", "# Mi documento", false)
	summary := createDocument("Memoria actual", "## Qué sigue\nContinuar.", true)
	longTitle := strings.Repeat("ñ", 160)
	entry := createDocument(longTitle, "Estado: **elegida**\n\nDecisión con fuentes.", true)
	if _, err := conn.Exec(ctx, `INSERT INTO project_logs(proyecto_id,user_id,titulo,contenido_raw) VALUES($1,$2,'Sesión manual','Texto original')`, projectID, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO memoria_proyectos(proyecto_id,user_id,revision,contenido,documento_id) VALUES($1,$2,7,'{"de_que_trata":"Recordar"}',$3)`, projectID, userID, summary); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO memoria_fichas(proyecto_id,user_id,titulo,contenido,tipo,estado,fuentes,documento_id) VALUES($1,$2,$3,'Decisión con fuentes.','decision','elegida','[{"tipo":"nota","referencia":"Migración"}]',$4)`, projectID, userID, longTitle, entry); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO memoria_operaciones(proyecto_id,user_id,operacion_id,request_hash,resultado) VALUES($1,$2,'legacy-operation',repeat('a',64),jsonb_build_object('revision',7,'documento_id',$3::int,'ficha_ids',jsonb_build_array(1)))`, projectID, userID, summary); err != nil {
		t.Fatal(err)
	}
	var cachedBefore string
	if err := conn.QueryRow(ctx, `SELECT resultado::text FROM memoria_operaciones`).Scan(&cachedBefore); err != nil {
		t.Fatal(err)
	}
	if err := database.RunMigrations(url); err != nil {
		t.Fatal(err)
	}
	var content, title string
	var revision int
	if err := conn.QueryRow(ctx, `SELECT m.revision,l.contenido_raw FROM memoria_proyectos m JOIN project_logs l ON l.id=m.log_id WHERE m.proyecto_id=$1 AND l.gestionado=true`, projectID).Scan(&revision, &content); err != nil || revision != 7 || content != "## Qué sigue\nContinuar." {
		t.Fatalf("síntesis migrada: %d %q %v", revision, content, err)
	}
	if err := conn.QueryRow(ctx, `SELECT l.titulo,l.contenido_raw FROM memoria_fichas f JOIN project_logs l ON l.id=f.log_id WHERE f.proyecto_id=$1`, projectID).Scan(&title, &content); err != nil || title != longTitle || !strings.Contains(content, "Decisión con fuentes.") {
		t.Fatalf("ficha migrada: %q %q %v", title, content, err)
	}
	var visibleDocs, visibleLogs int
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM documentos_proyecto WHERE eliminado=false`).Scan(&visibleDocs); err != nil || visibleDocs != 1 {
		t.Fatalf("documentos visibles: %d %v", visibleDocs, err)
	}
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM project_logs WHERE eliminado=false`).Scan(&visibleLogs); err != nil || visibleLogs != 3 {
		t.Fatalf("logs visibles: %d %v", visibleLogs, err)
	}
	var cachedAfter string
	if err := conn.QueryRow(ctx, `SELECT resultado::text FROM memoria_operaciones`).Scan(&cachedAfter); err != nil || cachedAfter != cachedBefore {
		t.Fatal("la migración cambió el resultado de un reintento previo", err)
	}
	var manualContent string
	if err := conn.QueryRow(ctx, `SELECT contenido FROM documentos_proyecto WHERE id=$1 AND eliminado=false AND gestionado=false`, manual).Scan(&manualContent); err != nil || manualContent != "# Mi documento" {
		t.Fatal("se modificó el entregable manual", err)
	}
	// El rollback también debe conservar fichas creadas ya con el modelo nuevo.
	var newLog int
	if err := conn.QueryRow(ctx, `INSERT INTO project_logs(proyecto_id,user_id,titulo,contenido_raw,gestionado) VALUES($1,$2,'Ficha nueva','Contenido nuevo',true) RETURNING id`, projectID, userID).Scan(&newLog); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO memoria_fichas(proyecto_id,user_id,titulo,contenido,tipo,estado,fuentes,log_id) VALUES($1,$2,'Ficha nueva','Contenido nuevo','decision','elegida','[]',$3)`, projectID, userID, newLog); err != nil {
		t.Fatal(err)
	}
	down, err := fs.ReadFile(database.MigrationFS(), "migrations/000030_move_memory_to_project_logs.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, string(down)); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM documentos_proyecto WHERE eliminado=false`).Scan(&visibleDocs); err != nil || visibleDocs != 4 {
		t.Fatalf("rollback perdió documentos: %d %v", visibleDocs, err)
	}
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM project_logs WHERE eliminado=false`).Scan(&visibleLogs); err != nil || visibleLogs != 1 {
		t.Fatalf("rollback cambió el log manual: %d %v", visibleLogs, err)
	}
	if err := conn.QueryRow(ctx, `SELECT d.contenido FROM memoria_fichas f JOIN documentos_proyecto d ON d.id=f.documento_id WHERE f.titulo='Ficha nueva' AND d.eliminado=false`).Scan(&content); err != nil || content != "Contenido nuevo" {
		t.Fatal("rollback perdió la ficha nueva", err)
	}
}
