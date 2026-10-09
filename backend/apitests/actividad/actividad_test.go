// Package actividad prueba por HTTP "Lo que hiciste" (GET /api/actividad/resumen) y
// "En qué quedaste" (GET /api/proyects/{id}/actividad y ultima_actividad).
package actividad

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

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
	api := apitest.New(t, "actividad")
	return api, newUser(t, api, "ana@actividad.test"), newUser(t, api, "beto@actividad.test")
}

func ok(t *testing.T, res *apitest.Response) *apitest.Response {
	t.Helper()
	if res.Status < 200 || res.Status >= 300 {
		t.Fatalf("código %d; cuerpo: %s", res.Status, res.Body)
	}
	return res
}

func proyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string) int {
	t.Helper()
	return ok(t, api.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q",
		"criterio_finalizacion": "c", "prioridad": "Media",
	})).ID(t)
}

func tarea(t *testing.T, api *apitest.API, u *apitest.User, proyecto int, nombre string) int {
	t.Helper()
	return ok(t, api.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": nombre, "proyect_id": proyecto})).ID(t)
}

// fijar cambia fechas directamente en la base para armar escenarios en el pasado.
func fijar(t *testing.T, api *apitest.API, sql string, args ...any) {
	t.Helper()
	if _, err := api.DB.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func resumenPath(desde, hasta time.Time) string {
	return "/api/actividad/resumen?desde=" + url.QueryEscape(desde.Format(time.RFC3339)) +
		"&hasta=" + url.QueryEscape(hasta.Format(time.RFC3339))
}

func TestResumenDeLaSemana(t *testing.T) {
	api, ana, beto := setup(t)
	lunes := time.Date(2026, 10, 5, 3, 0, 0, 0, time.UTC) // lunes 00:00 en Chile (UTC-3)
	sigLunes := lunes.AddDate(0, 0, 7)

	p := proyecto(t, api, ana, "Mudanza")
	dentro := tarea(t, api, ana, p, "Cotizar flete")
	borde := tarea(t, api, ana, p, "Justo al empezar")
	fuera := tarea(t, api, ana, p, "Semana anterior")
	alFinal := tarea(t, api, ana, p, "Justo al terminar")
	abierta := tarea(t, api, ana, p, "Sigue abierta")
	for _, id := range []int{dentro, borde, fuera, alFinal} {
		ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", id), map[string]any{"estado": "Terminado"}))
	}
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = $1 WHERE id = $2", lunes.Add(48*time.Hour), dentro)
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = $1 WHERE id = $2", lunes, borde)
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = $1 WHERE id = $2", lunes.Add(-time.Second), fuera)
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = $1 WHERE id = $2", sigLunes, alFinal)
	// Tres tareas creadas en la semana (dentro, borde, abierta); las demás antes.
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_creacion = $1 WHERE id IN ($2, $3, $4)", lunes.Add(time.Hour), dentro, borde, abierta)
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_creacion = $1 WHERE id IN ($2, $3)", lunes.AddDate(0, 0, -10), fuera, alFinal)

	// Proyecto completado en la semana.
	ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", p), map[string]any{"estado": "Completado"}))
	fijar(t, api, "UPDATE proyectos SET fecha_terminado = $1 WHERE id = $2", lunes.Add(72*time.Hour), p)

	// Otra actividad: una interacción con una persona y una reflexión.
	persona := ok(t, api.Do(ana, http.MethodPost, "/api/personas", map[string]any{"nombre": "Ada"})).ID(t)
	ok(t, api.Do(ana, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", persona), map[string]any{"interaccion": "Café"}))
	ok(t, api.Do(ana, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", persona), map[string]any{"interaccion": "Llamada"}))
	ok(t, api.Do(ana, http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "Hoy…", "tipo": "reflexion"}))
	fijar(t, api, "UPDATE interacciones SET fecha_creacion = $1", lunes.Add(time.Hour))
	fijar(t, api, "UPDATE reflexiones SET fecha_creacion = $1", lunes.Add(time.Hour))

	// Lo de beto no cuenta para ana.
	pb := proyecto(t, api, beto, "Ajeno")
	tb := tarea(t, api, beto, pb, "Tarea ajena")
	ok(t, api.Do(beto, http.MethodPut, apitest.Path("/api/tareas/%d", tb), map[string]any{"estado": "Terminado"}))
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = $1, fecha_creacion = $1 WHERE id = $2", lunes.Add(time.Hour), tb)

	var r models.ResumenActividad
	api.Do(ana, http.MethodGet, resumenPath(lunes, sigLunes), nil).Expect(t, http.StatusOK).JSON(t, &r)

	ids := map[int]bool{}
	for _, tt := range r.TareasTerminadas {
		ids[tt.ID] = true
		if tt.ProyectoNombre != "Mudanza" {
			t.Errorf("tarea %d sin nombre de proyecto: %+v", tt.ID, tt)
		}
	}
	if len(ids) != 2 || !ids[dentro] || !ids[borde] {
		t.Errorf("tareas terminadas: se esperaban %d y %d (desde incluido, hasta excluido), hay %+v", dentro, borde, r.TareasTerminadas)
	}
	if len(r.ProyectosCompletados) != 1 || r.ProyectosCompletados[0].ID != p {
		t.Errorf("proyectos completados: %+v", r.ProyectosCompletados)
	}
	if r.Flujo != (models.FlujoTareas{Creadas: 3, Terminadas: 2}) {
		t.Errorf("flujo: %+v", r.Flujo)
	}
	if r.Otros.Interacciones != 2 || r.Otros.PersonasContactadas != 1 || r.Otros.Reflexiones != 1 {
		t.Errorf("otra actividad: %+v", r.Otros)
	}
}

func TestResumenVacioDevuelveListas(t *testing.T) {
	api, ana, _ := setup(t)
	desde := time.Date(2020, 1, 6, 3, 0, 0, 0, time.UTC)
	res := api.Do(ana, http.MethodGet, resumenPath(desde, desde.AddDate(0, 0, 7)), nil).Expect(t, http.StatusOK)
	if !strings.Contains(string(res.Body), `"tareas_terminadas":[]`) || !strings.Contains(string(res.Body), `"proyectos_completados":[]`) {
		t.Errorf("sin datos las listas deben ser [] y no null: %s", res.Body)
	}
}

func TestResumenParametrosInvalidos(t *testing.T) {
	api, ana, _ := setup(t)
	lunes := time.Date(2026, 10, 5, 3, 0, 0, 0, time.UTC)
	for nombre, path := range map[string]string{
		"sin parámetros":    "/api/actividad/resumen",
		"desde inválido":    "/api/actividad/resumen?desde=ayer&hasta=" + url.QueryEscape(lunes.Format(time.RFC3339)),
		"hasta antes":       resumenPath(lunes, lunes.Add(-time.Hour)),
		"hasta igual":       resumenPath(lunes, lunes),
		"periodo muy largo": resumenPath(lunes, lunes.AddDate(2, 0, 0)),
	} {
		t.Run(nombre, func(t *testing.T) {
			api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusBadRequest)
		})
	}
	api.Do(nil, http.MethodGet, resumenPath(lunes, lunes.AddDate(0, 0, 7)), nil).Expect(t, http.StatusUnauthorized)
}

func TestActividadDelProyecto(t *testing.T) {
	api, ana, _ := setup(t)
	p := proyecto(t, api, ana, "Cassandra")
	otro := proyecto(t, api, ana, "Otro")
	tt := tarea(t, api, ana, p, "Deploy por SSH")
	tarea(t, api, ana, otro, "No debe aparecer")
	ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tt), map[string]any{"estado": "En Curso"}))
	larga := strings.Repeat("a", 300)
	ok(t, api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/notas", p), map[string]any{"nota": larga}))
	borrada := tarea(t, api, ana, p, "Se borra")
	ok(t, api.Do(ana, http.MethodDelete, apitest.Path("/api/tareas/%d", borrada), nil))

	var evs []models.EventoActividad
	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/actividad", p), nil).Expect(t, http.StatusOK).JSON(t, &evs)

	// proyecto creado, tarea creada, cambio de estado, nota, tarea borrada (creada y eliminada)
	if len(evs) != 6 {
		t.Fatalf("se esperaban 6 eventos, hay %d: %+v", len(evs), evs)
	}
	for i := 1; i < len(evs); i++ {
		if evs[i].OcurridoEn.After(evs[i-1].OcurridoEn) {
			t.Errorf("los eventos deben venir del más reciente al más antiguo")
		}
	}
	ultimo := evs[0]
	if ultimo.Entidad != "tarea" || ultimo.Accion != "eliminado" || !ultimo.Eliminado {
		t.Errorf("el último evento debe ser el borrado de la tarea: %+v", ultimo)
	}
	var estado, nota bool
	for _, e := range evs {
		if e.Nombre != nil && *e.Nombre == "No debe aparecer" {
			t.Error("aparece una tarea de otro proyecto")
		}
		if e.Entidad == "tarea" && e.EntidadID == tt && e.Accion == "modificado" {
			estado = strings.Contains(string(e.Cambios), `"En Curso"`) && e.Nombre != nil && *e.Nombre == "Deploy por SSH"
		}
		if e.Entidad == "nota" {
			nota = e.Nombre != nil && len([]rune(*e.Nombre)) == 140
		}
	}
	if !estado {
		t.Error("falta el cambio de estado con el nombre de la tarea")
	}
	if !nota {
		t.Error("la nota debe venir con un extracto de 140 caracteres")
	}

	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/actividad?limit=2", p), nil).Expect(t, http.StatusOK).JSON(t, &evs)
	if len(evs) != 2 {
		t.Errorf("limit=2 devolvió %d eventos", len(evs))
	}
	for _, l := range []string{"0", "101", "x"} {
		api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/actividad?limit=%s", p, l), nil).Expect(t, http.StatusBadRequest)
	}
}

func TestActividadDeProyectoAjeno(t *testing.T) {
	api, ana, beto := setup(t)
	p := proyecto(t, api, ana, "Secreto")
	tarea(t, api, ana, p, "Tarea secreta")
	res := api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/actividad", p), nil).Expect(t, http.StatusNotFound)
	if strings.Contains(string(res.Body), "secreta") {
		t.Errorf("la respuesta filtra datos ajenos: %s", res.Body)
	}
	api.Do(ana, http.MethodGet, "/api/proyects/999999/actividad", nil).Expect(t, http.StatusNotFound)
}

func TestUltimaActividadDelProyecto(t *testing.T) {
	api, ana, _ := setup(t)
	p := proyecto(t, api, ana, "Cassandra")
	tt := tarea(t, api, ana, p, "Tarea")
	fijar(t, api, "UPDATE eventos SET ocurrido_en = $1", time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tt), map[string]any{"estado": "En Curso"}))

	var lista []models.ProyectResponse
	api.Do(ana, http.MethodGet, "/api/proyects", nil).Expect(t, http.StatusOK).JSON(t, &lista)
	if len(lista) != 1 || lista[0].UltimaActividad == nil || time.Since(*lista[0].UltimaActividad) > time.Minute {
		t.Errorf("ultima_actividad debe ser el cambio de la tarea (ahora): %+v", lista)
	}

	var detalle models.ProyectResponse
	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d", p), nil).Expect(t, http.StatusOK).JSON(t, &detalle)
	if detalle.UltimaActividad == nil {
		t.Error("el detalle del proyecto debe incluir ultima_actividad")
	}
}
