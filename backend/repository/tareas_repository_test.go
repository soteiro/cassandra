package repository

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"

	"cassandra/internal/testdb"
	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// seedProyecto crea un usuario y un proyecto y devuelve sus ids.
func seedProyecto(t *testing.T, db *pgxpool.Pool) (userID, proyectoID int) {
	t.Helper()
	ctx := context.Background()
	if err := db.QueryRow(ctx,
		`INSERT INTO users (nombre, email, password) VALUES ('Test', 'tareas@cassandra.test', 'x') RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO proyectos (user_id, nombre, por_que, para_que, criterio_finalizacion, prioridad)
		 VALUES ($1, 'Proyecto', 'p', 'p', 'c', 'Media') RETURNING id`, userID,
	).Scan(&proyectoID); err != nil {
		t.Fatal(err)
	}
	return userID, proyectoID
}

func TestTareasCreateUsesAbiertoWhenEstadoIsMissing(t *testing.T) {
	db := testdb.New(t, "repository")
	userID, proyectoID := seedProyecto(t, db)
	repo := NewTareasRepository(db)
	vacio := ""

	for name, estado := range map[string]*string{"estado nil": nil, "estado vacío": &vacio} {
		t.Run(name, func(t *testing.T) {
			tarea, err := repo.Create(context.Background(), &models.TareaRequest{
				Nombre: "Tarea " + name, UserID: userID, ProyectID: proyectoID, Estado: estado,
			})
			if err != nil {
				t.Fatal(err)
			}
			if tarea.Estado == nil || *tarea.Estado != "Abierto" {
				t.Errorf("estado = %v, se esperaba \"Abierto\"", tarea.Estado)
			}
		})
	}

	t.Run("respeta un estado explícito", func(t *testing.T) {
		enCurso := "En Curso"
		tarea, err := repo.Create(context.Background(), &models.TareaRequest{
			Nombre: "Explícita", UserID: userID, ProyectID: proyectoID, Estado: &enCurso,
		})
		if err != nil {
			t.Fatal(err)
		}
		if *tarea.Estado != "En Curso" {
			t.Errorf("estado = %q", *tarea.Estado)
		}
	})
}

func TestTareasGetByIDLogsUnreadableSubtasks(t *testing.T) {
	db := testdb.New(t, "repository")
	userID, proyectoID := seedProyecto(t, db)
	repo := NewTareasRepository(db)
	ctx := context.Background()

	padre, err := repo.Create(ctx, &models.TareaRequest{Nombre: "Padre", UserID: userID, ProyectID: proyectoID})
	if err != nil {
		t.Fatal(err)
	}
	for _, nombre := range []string{"Sana", "Rota"} {
		if _, err := repo.Create(ctx, &models.TareaRequest{
			Nombre: nombre, UserID: userID, ProyectID: proyectoID, TareaPadreID: &padre.ID,
		}); err != nil {
			t.Fatal(err)
		}
	}
	// Dato editado a mano: descripcion NULL no se puede leer en un string.
	if _, err := db.Exec(ctx, `UPDATE tareas_proyectos SET descripcion = NULL WHERE nombre = 'Rota'`); err != nil {
		t.Fatal(err)
	}

	var logs bytes.Buffer
	prev := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(prev) })

	tarea, err := repo.GetByID(ctx, padre.ID, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(tarea.Subtareas) != 1 || tarea.Subtareas[0].Nombre != "Sana" {
		t.Errorf("subtareas = %+v, se esperaba solo \"Sana\"", tarea.Subtareas)
	}
	if !strings.Contains(logs.String(), "Error al leer subtarea") {
		t.Errorf("se esperaba un log de la subtarea omitida; logs:\n%s", logs.String())
	}
}
