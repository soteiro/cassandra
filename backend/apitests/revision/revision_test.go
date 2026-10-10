// Package revision prueba por HTTP la revisión semanal: tareas estancadas, guardar y
// listar revisiones, y las preferencias del usuario.
package revision

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/admin"
	"cassandra/internal/apitest"
	"cassandra/models"
	"cassandra/repository"
	"cassandra/utils"
)

func newUser(t *testing.T, api *apitest.API, email string) *apitest.User {
	t.Helper()
	alias := strings.Split(email, "@")[0]
	u, err := admin.CreateUser(context.Background(), repository.NewUserRepository(api.DB),
		admin.NewUser{Nombre: alias, Alias: alias, Email: email, Password: "clave-de-test-123"})
	if err != nil {
		t.Fatal(err)
	}
	token, err := utils.GenerateAccessToken(u.ID, apitest.JWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return &apitest.User{ID: u.ID, Email: u.Email, Token: token}
}

func setup(t *testing.T) (*apitest.API, *apitest.User, *apitest.User) {
	t.Helper()
	api := apitest.New(t, "revision")
	return api, newUser(t, api, "ana@revision.test"), newUser(t, api, "beto@revision.test")
}

func ok(t *testing.T, res *apitest.Response) *apitest.Response {
	t.Helper()
	if res.Status < 200 || res.Status >= 300 {
		t.Fatalf("código %d; cuerpo: %s", res.Status, res.Body)
	}
	return res
}

func proyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre, estado string) int {
	t.Helper()
	id := ok(t, api.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q",
		"criterio_finalizacion": "c", "prioridad": "Media",
	})).ID(t)
	if estado != "" {
		ok(t, api.Do(u, http.MethodPut, apitest.Path("/api/proyects/%d", id), map[string]any{"estado": estado}))
	}
	return id
}

func tarea(t *testing.T, api *apitest.API, u *apitest.User, proyecto int, nombre, estado string, diasSinCambios int) int {
	t.Helper()
	id := ok(t, api.Do(u, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": nombre, "proyect_id": proyecto, "estado": estado})).ID(t)
	// El trigger mantiene fecha_actualizacion: se desactiva para envejecer la tarea.
	ctx := context.Background()
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	for _, sql := range []string{
		"ALTER TABLE tareas_proyectos DISABLE TRIGGER fecha_actualizacion_tareas_proyectos",
		"UPDATE tareas_proyectos SET fecha_actualizacion = now() - make_interval(days => $1) WHERE id = $2",
		"ALTER TABLE tareas_proyectos ENABLE TRIGGER fecha_actualizacion_tareas_proyectos",
	} {
		args := []any{}
		if strings.HasPrefix(sql, "UPDATE") {
			args = []any{diasSinCambios, id}
		}
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestEstancadas(t *testing.T) {
	api, ana, beto := setup(t)
	activo := proyecto(t, api, ana, "Activo", "En Proceso")
	pausado := proyecto(t, api, ana, "Pausado", "Pausado")

	vieja := tarea(t, api, ana, activo, "Vieja", "Abierto", 30)
	media := tarea(t, api, ana, activo, "Media", "Bloqueado", 15)
	tarea(t, api, ana, activo, "Reciente", "En Curso", 3)
	tarea(t, api, ana, activo, "Terminada vieja", "Terminado", 40)
	tarea(t, api, ana, pausado, "De proyecto en pausa", "Abierto", 40)
	ajena := proyecto(t, api, beto, "Ajeno", "")
	tarea(t, api, beto, ajena, "De otro usuario", "Abierto", 40)

	var got []models.TareaEstancada
	api.Do(ana, http.MethodGet, "/api/revision/estancadas", nil).Expect(t, http.StatusOK).JSON(t, &got)
	if len(got) != 2 || got[0].ID != vieja || got[1].ID != media {
		t.Fatalf("se esperaban [vieja, media] (más antigua primero), hay %+v", got)
	}
	if got[0].DiasSinCambios < 29 || got[0].ProyectoNombre != "Activo" {
		t.Errorf("datos de la tarea: %+v", got[0])
	}

	api.Do(ana, http.MethodGet, "/api/revision/estancadas?dias=20", nil).Expect(t, http.StatusOK).JSON(t, &got)
	if len(got) != 1 || got[0].ID != vieja {
		t.Errorf("con dias=20 solo la vieja: %+v", got)
	}

	// Tocar la tarea (cambiarle el estado) la saca de la lista.
	ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", vieja), map[string]any{"estado": "Pendiente"}))
	api.Do(ana, http.MethodGet, "/api/revision/estancadas", nil).Expect(t, http.StatusOK).JSON(t, &got)
	if len(got) != 1 || got[0].ID != media {
		t.Errorf("tras pausarla, la vieja ya no está estancada: %+v", got)
	}

	for _, d := range []string{"0", "366", "x"} {
		api.Do(ana, http.MethodGet, "/api/revision/estancadas?dias="+d, nil).Expect(t, http.StatusBadRequest)
	}
}

func TestGuardarYListarRevisiones(t *testing.T) {
	api, ana, beto := setup(t)

	var revs []models.Revision
	api.Do(ana, http.MethodGet, "/api/revisiones", nil).Expect(t, http.StatusOK).JSON(t, &revs)
	if len(revs) != 0 {
		t.Fatalf("sin revisiones: %+v", revs)
	}

	ok(t, api.Do(ana, http.MethodPost, "/api/revisiones", map[string]any{
		"nota": "  Semana tranquila  ", "resumen": map[string]any{"terminadas": 4, "revisadas": 2}}))
	ok(t, api.Do(ana, http.MethodPost, "/api/revisiones", map[string]any{"nota": "Sin resumen"}))
	ok(t, api.Do(beto, http.MethodPost, "/api/revisiones", map[string]any{"nota": "De beto"}))

	api.Do(ana, http.MethodGet, "/api/revisiones", nil).Expect(t, http.StatusOK).JSON(t, &revs)
	if len(revs) != 2 || revs[0].Nota != "Sin resumen" || revs[1].Nota != "Semana tranquila" {
		t.Fatalf("revisiones de ana, la más reciente primero y con la nota recortada: %+v", revs)
	}
	if string(revs[0].Resumen) != "{}" || !strings.Contains(string(revs[1].Resumen), `"terminadas":4`) {
		t.Errorf("resúmenes: %s / %s", revs[0].Resumen, revs[1].Resumen)
	}

	api.Do(ana, http.MethodGet, "/api/revisiones?limit=1", nil).Expect(t, http.StatusOK).JSON(t, &revs)
	if len(revs) != 1 {
		t.Errorf("limit=1 devolvió %d", len(revs))
	}

	// El registro de eventos no copia la nota.
	var cambios string
	if err := api.DB.QueryRow(context.Background(),
		"SELECT string_agg(cambios::text, ' ') FROM eventos WHERE entidad = 'revision'").Scan(&cambios); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(cambios, "tranquila") {
		t.Errorf("el registro copia la nota: %s", cambios)
	}

	for nombre, body := range map[string]any{
		"resumen no objeto": map[string]any{"nota": "x", "resumen": []int{1, 2}},
		"nota muy larga":    map[string]any{"nota": strings.Repeat("a", 10001)},
		"resumen enorme":    map[string]any{"resumen": map[string]any{"x": strings.Repeat("a", 5000)}},
	} {
		t.Run(nombre, func(t *testing.T) {
			api.Do(ana, http.MethodPost, "/api/revisiones", body).Expect(t, http.StatusBadRequest)
		})
	}
}

func TestPreferencias(t *testing.T) {
	api, ana, beto := setup(t)

	var p models.Preferencias
	api.Do(ana, http.MethodGet, "/api/preferencias", nil).Expect(t, http.StatusOK).JSON(t, &p)
	if p.DiaRevision != 0 || p.LimiteEnCurso != 5 {
		t.Errorf("valores por defecto (domingo, 5): %+v", p)
	}

	api.Do(ana, http.MethodPut, "/api/preferencias", map[string]any{"dia_revision": 1}).Expect(t, http.StatusOK).JSON(t, &p)
	if p.DiaRevision != 1 || p.LimiteEnCurso != 5 {
		t.Errorf("solo cambia el día: %+v", p)
	}
	api.Do(beto, http.MethodGet, "/api/preferencias", nil).Expect(t, http.StatusOK).JSON(t, &p)
	if p.DiaRevision != 0 {
		t.Errorf("las preferencias de beto no cambian: %+v", p)
	}

	for _, body := range []map[string]any{{"dia_revision": 7}, {"dia_revision": -1}, {"limite_en_curso": 0}, {"limite_en_curso": 51}} {
		api.Do(ana, http.MethodPut, "/api/preferencias", body).Expect(t, http.StatusBadRequest)
	}
}
