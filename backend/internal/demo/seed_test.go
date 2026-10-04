package demo

import (
	"context"
	"errors"
	"testing"
	"time"

	"cassandra/internal/testdb"
	"cassandra/repository"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func count(t *testing.T, db *pgxpool.Pool, q string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(context.Background(), q).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}

func TestSeed(t *testing.T) {
	db := testdb.New(t, "demo")
	ctx := context.Background()
	now := time.Date(2026, time.January, 15, 12, 0, 0, 0, time.UTC)

	sum, err := Seed(ctx, db, "QA@Cassandra.Local", "demo-segura-123", now)
	if err != nil {
		t.Fatal(err)
	}
	want := Summary{Email: "qa@cassandra.local", Proyectos: 4, Tareas: 8, Personas: 2, Movimientos: 10}
	if *sum != want {
		t.Errorf("resumen = %+v, se esperaba %+v", *sum, want)
	}

	user, err := repository.NewUserRepository(db).GetByEmail(ctx, "qa@cassandra.local")
	if err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("demo-segura-123")) != nil {
		t.Error("el usuario demo no puede iniciar sesión con la contraseña entregada")
	}

	checks := map[string]struct {
		query string
		want  int
	}{
		"subproyecto":                {`SELECT count(*) FROM proyectos WHERE proyecto_padre_id IS NOT NULL`, 1},
		"subtareas":                  {`SELECT count(*) FROM tareas_proyectos WHERE tarea_padre_id IS NOT NULL`, 2},
		"notas (una ligada a tarea)": {`SELECT count(*) FROM notas_proyecto WHERE tarea_id IS NOT NULL`, 1},
		"documentos":                 {`SELECT count(*) FROM documentos_proyecto`, 1},
		"interacciones":              {`SELECT count(*) FROM interacciones`, 3},
		"persona propia (es_yo)":     {`SELECT count(*) FROM persona WHERE es_yo`, 1},
		// El año cruza: enero 2026 y diciembre 2025.
		"movimientos del mes actual":   {`SELECT count(*) FROM finanzas_plantilla WHERE mes = 1 AND anio = 2026`, 5},
		"movimientos del mes anterior": {`SELECT count(*) FROM finanzas_plantilla WHERE mes = 12 AND anio = 2025 AND estado = 'completado'`, 5},
	}
	for name, c := range checks {
		t.Run(name, func(t *testing.T) {
			if got := count(t, db, c.query); got != c.want {
				t.Errorf("= %d, se esperaba %d", got, c.want)
			}
		})
	}
}

func TestSeedRefusesNonEmptyDatabase(t *testing.T) {
	db := testdb.New(t, "demo")
	ctx := context.Background()
	if _, err := Seed(ctx, db, "uno@cassandra.local", "demo-segura-123", time.Now()); err != nil {
		t.Fatal(err)
	}
	_, err := Seed(ctx, db, "dos@cassandra.local", "demo-segura-123", time.Now())
	if !errors.Is(err, ErrNotEmpty) {
		t.Errorf("error = %v, se esperaba ErrNotEmpty", err)
	}
}
