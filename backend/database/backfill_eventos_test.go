package database_test

import (
	"context"
	"io/fs"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"

	"cassandra/database"
	"cassandra/internal/testdb"

	"github.com/jackc/pgx/v5"
)

// hasta devuelve las migraciones embebidas con versión <= max.
func hasta(t *testing.T, max int) fstest.MapFS {
	t.Helper()
	out := fstest.MapFS{}
	entries, err := fs.ReadDir(database.MigrationFS(), "migrations")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		v, err := strconv.Atoi(strings.SplitN(e.Name(), "_", 2)[0])
		if err != nil || v > max {
			continue
		}
		data, err := fs.ReadFile(database.MigrationFS(), "migrations/"+e.Name())
		if err != nil {
			t.Fatal(err)
		}
		out["migrations/"+e.Name()] = &fstest.MapFile{Data: data}
	}
	return out
}

// Datos existentes antes del registro de eventos: el relleno debe reconstruir su
// creación y sus cierres, sin inventar eventos para lo eliminado.
func TestRellenoDeEventos(t *testing.T) {
	url := testdb.NewEmpty(t, "backfill_eventos")
	if err := database.RunMigrationsFrom(url, hasta(t, 23), "migrations"); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	_, err = conn.Exec(ctx, `
		INSERT INTO users (id, nombre, email) VALUES (1, 'Ana', 'ana@test');
		INSERT INTO proyectos (id, user_id, nombre, por_que, para_que, criterio_finalizacion, prioridad, estado, fecha_creacion, fecha_terminado)
		VALUES (10, 1, 'Mudanza', 'p', 'q', 'c', 'Media', 'Completado', '2026-01-01', '2026-03-01');
		INSERT INTO tareas_proyectos (id, user_id, proyecto_id, nombre, estado, fecha_creacion, fecha_terminado)
		VALUES (20, 1, 10, 'Cotizar flete', 'Terminado', '2026-01-02', '2026-01-05'),
		       (21, 1, 10, 'Embalar', 'Abierto', '2026-01-03', NULL),
		       (22, 1, 10, 'Borrada', 'Abierto', '2026-01-04', NULL);
		UPDATE tareas_proyectos SET eliminado = true WHERE id = 22;
		INSERT INTO notas_proyecto (id, user_id, proyecto_id, nota_proyecto, fecha_creacion)
		VALUES (30, 1, 10, 'nota', '2026-01-06');
		INSERT INTO lista_deseos (id, user_id, nombre, comprado, fecha_creacion, fecha_compra)
		VALUES (40, 1, 'Libro', true, '2026-02-01', '2026-02-10');
		INSERT INTO documentos_proyecto (id, user_id, proyecto_id, titulo, contenido, fecha_creacion, fecha_actualizacion)
		VALUES (50, 1, 10, 'ADR', 'x', '2026-01-01', '2026-01-15');
	`)
	if err != nil {
		t.Fatal(err)
	}

	if err := database.RunMigrations(url); err != nil {
		t.Fatal(err)
	}

	type ev struct {
		entidad string
		id      int
		accion  string
		fecha   string
	}
	rows, err := conn.Query(ctx, `
		SELECT entidad, entidad_id, accion, to_char(ocurrido_en AT TIME ZONE 'UTC', 'YYYY-MM-DD')
		FROM eventos WHERE origen = 'backfill' ORDER BY entidad, entidad_id, ocurrido_en`)
	if err != nil {
		t.Fatal(err)
	}
	got := map[ev]bool{}
	for rows.Next() {
		var e ev
		if err := rows.Scan(&e.entidad, &e.id, &e.accion, &e.fecha); err != nil {
			t.Fatal(err)
		}
		got[e] = true
	}
	rows.Close()

	want := []ev{
		{"proyecto", 10, "creado", "2026-01-01"},
		{"proyecto", 10, "modificado", "2026-03-01"},
		{"tarea", 20, "creado", "2026-01-02"},
		{"tarea", 20, "modificado", "2026-01-05"},
		{"tarea", 21, "creado", "2026-01-03"},
		{"nota", 30, "creado", "2026-01-06"},
		{"deseo", 40, "creado", "2026-02-01"},
		{"deseo", 40, "modificado", "2026-02-10"},
		{"documento", 50, "creado", "2026-01-01"},
		{"documento", 50, "modificado", "2026-01-15"},
	}
	for _, w := range want {
		if !got[w] {
			t.Errorf("falta el evento %+v", w)
		}
		delete(got, w)
	}
	for e := range got {
		t.Errorf("evento de más: %+v", e)
	}

	// El relleno no dispara los triggers ni toca las filas: ningún evento 'app'.
	var app int
	if err := conn.QueryRow(ctx, "SELECT count(*) FROM eventos WHERE origen <> 'backfill'").Scan(&app); err != nil {
		t.Fatal(err)
	}
	if app != 0 {
		t.Errorf("la migración generó %d eventos que no son de relleno", app)
	}

	// La tarea terminada guarda su estado final.
	var estado string
	if err := conn.QueryRow(ctx, `
		SELECT cambios->'estado'->>'despues' FROM eventos
		WHERE entidad = 'tarea' AND entidad_id = 20 AND accion = 'modificado'`).Scan(&estado); err != nil {
		t.Fatal(err)
	}
	if estado != "Terminado" {
		t.Errorf("estado reconstruido: %q", estado)
	}
}
