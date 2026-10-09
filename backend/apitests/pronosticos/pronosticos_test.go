// Package pronosticos prueba por HTTP los pronósticos: cuánto se demora el usuario
// frente a lo que estima y cuándo terminaría un proyecto al ritmo reciente.
package pronosticos

import (
	"context"
	"net/http"
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
	api := apitest.New(t, "pronosticos")
	return api, newUser(t, api, "ana@pronosticos.test"), newUser(t, api, "beto@pronosticos.test")
}

func ok(t *testing.T, res *apitest.Response) *apitest.Response {
	t.Helper()
	if res.Status < 200 || res.Status >= 300 {
		t.Fatalf("código %d; cuerpo: %s", res.Status, res.Body)
	}
	return res
}

func proyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string, extra map[string]any) int {
	t.Helper()
	body := map[string]any{
		"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q",
		"criterio_finalizacion": "c", "prioridad": "Media",
	}
	for k, v := range extra {
		body[k] = v
	}
	return ok(t, api.Do(u, http.MethodPost, "/api/proyects", body)).ID(t)
}

func tarea(t *testing.T, api *apitest.API, u *apitest.User, proyecto int, estado string) int {
	t.Helper()
	return ok(t, api.Do(u, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "T", "proyect_id": proyecto, "estado": estado})).ID(t)
}

func fijar(t *testing.T, api *apitest.API, sql string, args ...any) {
	t.Helper()
	if _, err := api.DB.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

// completado arma un proyecto completado que debía durar `estimado` días y duró `real`.
func completado(t *testing.T, api *apitest.API, u *apitest.User, nombre string, estimado, real int) {
	t.Helper()
	p := proyecto(t, api, u, nombre, nil)
	inicio := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	fijar(t, api, `UPDATE proyectos SET estado = 'Completado', fecha_creacion = $1,
		fecha_limite = $2, fecha_terminado = $3 WHERE id = $4`,
		inicio, inicio.AddDate(0, 0, estimado), inicio.AddDate(0, 0, real), p)
}

func TestPlanificacion(t *testing.T) {
	api, ana, beto := setup(t)

	var res models.Planificacion
	api.Do(ana, http.MethodGet, "/api/pronosticos/planificacion", nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.Proyectos != 0 || res.Factor != nil {
		t.Errorf("sin proyectos completados no hay factor: %+v", res)
	}

	completado(t, api, ana, "A", 10, 10) // factor 1, a tiempo
	completado(t, api, ana, "B", 10, 30) // 3
	api.Do(ana, http.MethodGet, "/api/pronosticos/planificacion", nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.Proyectos != 2 || res.Factor != nil {
		t.Errorf("con 2 proyectos todavía no hay factor: %+v", res)
	}

	completado(t, api, ana, "C", 10, 25) // 2.5
	// No cuentan: sin fecha límite, cancelado, de otro usuario.
	proyecto(t, api, ana, "Sin fecha", nil)
	completado(t, api, beto, "Ajeno", 10, 100)
	c := proyecto(t, api, ana, "Cancelado", map[string]any{"fecha_limite": "2026-02-01T00:00:00Z"})
	fijar(t, api, "UPDATE proyectos SET estado = 'Cancelado' WHERE id = $1", c)

	api.Do(ana, http.MethodGet, "/api/pronosticos/planificacion", nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.Proyectos != 3 || res.ATiempo != 1 || res.Factor == nil || *res.Factor != 2.5 {
		t.Errorf("se esperaba mediana 2,5 de 3 proyectos (1 a tiempo): %+v", res)
	}
}

func TestPronosticoDeProyecto(t *testing.T) {
	api, ana, _ := setup(t)
	p := proyecto(t, api, ana, "Mudanza", nil)

	var res models.PronosticoProyecto
	tarea(t, api, ana, p, "Abierto")
	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/pronostico", p), nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.TareasAbiertas != 1 || res.SemanasMin != nil {
		t.Errorf("sin historia no hay pronóstico: %+v", res)
	}

	// 2 tareas cerradas por semana en las últimas 4 semanas (8 en total) y 7 abiertas
	// más (8 abiertas): el ritmo de la ventana de 8 semanas es 1/semana → ~8 semanas.
	for semana := range 4 {
		for range 2 {
			id := tarea(t, api, ana, p, "Terminado")
			fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = now() - make_interval(days => $1) WHERE id = $2",
				semana*7+2, id)
		}
	}
	for range 7 {
		tarea(t, api, ana, p, "En Curso")
	}
	// Una cerrada hace más de 8 semanas no cuenta.
	vieja := tarea(t, api, ana, p, "Terminado")
	fijar(t, api, "UPDATE tareas_proyectos SET fecha_terminado = now() - interval '70 days' WHERE id = $1", vieja)

	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/pronostico", p), nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.TareasAbiertas != 8 || res.TerminadasVentana != 8 || res.SemanasVentana != 8 {
		t.Fatalf("conteos: %+v", res)
	}
	if res.SemanasMin == nil || res.SemanasMax == nil || *res.SemanasMin > 8 || *res.SemanasMax < 8 || *res.SemanasMin > *res.SemanasMax {
		t.Errorf("el rango debería rodear ~8 semanas: min=%v max=%v", res.SemanasMin, res.SemanasMax)
	}
}

func TestCambiosDeFechaLimite(t *testing.T) {
	api, ana, _ := setup(t)
	p := proyecto(t, api, ana, "Casa", map[string]any{"fecha_limite": "2026-11-01T00:00:00Z"})
	ruta := apitest.Path("/api/proyects/%d", p)

	ok(t, api.Do(ana, http.MethodPut, ruta, map[string]any{"fecha_limite": "2026-12-01T00:00:00Z"}))
	ok(t, api.Do(ana, http.MethodPut, ruta, map[string]any{"fecha_limite": "2027-01-15T00:00:00Z"}))
	// Mismo día con otra hora: no es mover la fecha.
	ok(t, api.Do(ana, http.MethodPut, ruta, map[string]any{"fecha_limite": "2027-01-15T10:00:00Z"}))

	var res models.PronosticoProyecto
	api.Do(ana, http.MethodGet, ruta+"/pronostico", nil).Expect(t, http.StatusOK).JSON(t, &res)
	if res.CambiosFechaLimite != 2 {
		t.Errorf("la fecha límite se movió 2 veces de día: %d", res.CambiosFechaLimite)
	}
}

func TestPronosticoDeProyectoAjeno(t *testing.T) {
	api, ana, beto := setup(t)
	p := proyecto(t, api, ana, "Secreto", nil)
	api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/pronostico", p), nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodGet, "/api/proyects/abc/pronostico", nil).Expect(t, http.StatusBadRequest)
	api.Do(nil, http.MethodGet, "/api/pronosticos/planificacion", nil).Expect(t, http.StatusUnauthorized)
}
