// Package proyectos prueba por HTTP los módulos de proyectos, tareas, notas de proyecto
// y logs de proyecto: aislamiento entre usuarios, CRUD, validaciones y reglas propias
// (subproyectos, subtareas, fecha_terminado, filtros, notas ligadas a tareas).
//
// Los tests que documentan un bug de producción se saltan con bug(t, ...); para verlos
// fallar: PROYECTOS_BUGS=1 go test -count=1 ./apitests/proyectos/...
package proyectos

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"

	"cassandra/internal/admin"
	"cassandra/internal/apitest"
	"cassandra/models"
	"cassandra/repository"
	"cassandra/utils"
)

// inexistente es un id que no existe en la base (las tablas se vacían entre tests).
const inexistente = 999999

// bug marca un test que describe el comportamiento correcto pero hoy falla por un bug
// de producción. Se salta salvo que PROYECTOS_BUGS=1.
func bug(t *testing.T, desc string) {
	t.Helper()
	if os.Getenv("PROYECTOS_BUGS") == "" {
		t.Skip("BUG: " + desc + " — ver reporte")
	}
}

// newUser crea un usuario con alias único. No se usa api.User para un segundo usuario
// porque crea usuarios con alias ” y users.alias es UNIQUE.
func newUser(t *testing.T, api *apitest.API, email string) *apitest.User {
	t.Helper()
	alias := strings.Split(email, "@")[0]
	u, err := admin.CreateUser(context.Background(), repository.NewUserRepository(api.DB),
		admin.NewUser{Nombre: alias, Alias: alias, Email: email, Password: "clave-de-test-123"})
	if err != nil {
		t.Fatalf("creando usuario %s: %v", email, err)
	}
	token, err := utils.GenerateAccessToken(u.ID, apitest.JWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return &apitest.User{ID: u.ID, Email: u.Email, Token: token}
}

// setup levanta la API con dos usuarios independientes: ana (A) y beto (B).
func setup(t *testing.T) (*apitest.API, *apitest.User, *apitest.User) {
	t.Helper()
	api := apitest.New(t, "proyectos")
	return api, newUser(t, api, "ana@proyectos.test"), newUser(t, api, "beto@proyectos.test")
}

// ---------- aserciones de código ----------

// expectDenegado: la petición de un usuario sobre un recurso ajeno no debe tener éxito
// (cualquier código no 2xx) ni devolver en el cuerpo ninguno de los textos secretos.
func expectDenegado(t *testing.T, res *apitest.Response, que string, secretos ...string) {
	t.Helper()
	if res.Status >= 200 && res.Status < 300 {
		t.Errorf("%s: código %d (éxito) sobre un recurso ajeno; cuerpo: %s", que, res.Status, res.Body)
	}
	expectSinFuga(t, res, que, secretos...)
}

// expectSinFuga falla si el cuerpo contiene alguno de los textos secretos.
func expectSinFuga(t *testing.T, res *apitest.Response, que string, secretos ...string) {
	t.Helper()
	for _, s := range secretos {
		if strings.Contains(string(res.Body), s) {
			t.Errorf("%s: la respuesta filtra %q; cuerpo: %s", que, s, res.Body)
		}
	}
}

// expect4xx exige un error del cliente (400-499), nunca éxito ni 500.
func expect4xx(t *testing.T, res *apitest.Response, que string) {
	t.Helper()
	if res.Status < 400 || res.Status >= 500 {
		t.Errorf("%s: código %d, se esperaba 4xx; cuerpo: %s", que, res.Status, res.Body)
	}
}

// expectNoEncontrado acepta 403 o 404 (recurso ajeno o inexistente).
func expectNoEncontrado(t *testing.T, res *apitest.Response, que string) {
	t.Helper()
	if res.Status != http.StatusNotFound && res.Status != http.StatusForbidden {
		t.Errorf("%s: código %d, se esperaba 404 (o 403); cuerpo: %s", que, res.Status, res.Body)
	}
}

// ---------- fixtures ----------

func proyectoBody(nombre string) map[string]any {
	return map[string]any{
		"nombre":                nombre,
		"descripcion":           "descripcion de " + nombre,
		"por_que":               "porque " + nombre,
		"para_que":              "para " + nombre,
		"criterio_finalizacion": "terminar " + nombre,
	}
}

func crearProyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string, extra map[string]any) models.ProyectResponse {
	t.Helper()
	body := proyectoBody(nombre)
	for k, v := range extra {
		body[k] = v
	}
	var p models.ProyectResponse
	api.Do(u, http.MethodPost, "/api/proyects", body).Expect(t, http.StatusCreated).JSON(t, &p)
	if p.ID == 0 || p.Nombre != nombre {
		t.Fatalf("proyecto creado inesperado: %+v", p)
	}
	return p
}

func getProyecto(t *testing.T, api *apitest.API, u *apitest.User, id int) models.ProyectResponse {
	t.Helper()
	var p models.ProyectResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/proyects/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &p)
	return p
}

func listarProyectos(t *testing.T, api *apitest.API, u *apitest.User) []models.ProyectResponse {
	t.Helper()
	var ps []models.ProyectResponse
	api.Do(u, http.MethodGet, "/api/proyects", nil).Expect(t, http.StatusOK).JSON(t, &ps)
	return ps
}

func crearTarea(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int, nombre string, extra map[string]any) models.TareaResponse {
	t.Helper()
	body := map[string]any{"nombre": nombre, "descripcion": "desc " + nombre, "proyect_id": proyectoID}
	for k, v := range extra {
		body[k] = v
	}
	var tr models.TareaResponse
	api.Do(u, http.MethodPost, "/api/tareas", body).Expect(t, http.StatusCreated).JSON(t, &tr)
	if tr.ID == 0 || tr.Nombre != nombre {
		t.Fatalf("tarea creada inesperada: %+v", tr)
	}
	return tr
}

func getTarea(t *testing.T, api *apitest.API, u *apitest.User, id int) models.TareaResponse {
	t.Helper()
	var tr models.TareaResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/tareas/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &tr)
	return tr
}

func listarTareas(t *testing.T, api *apitest.API, u *apitest.User, query string) []models.TareaResponse {
	t.Helper()
	var ts []models.TareaResponse
	api.Do(u, http.MethodGet, "/api/tareas"+query, nil).Expect(t, http.StatusOK).JSON(t, &ts)
	return ts
}

func tareasDeProyecto(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int) []models.TareaResponse {
	t.Helper()
	var ts []models.TareaResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/proyects/%d/tareas", proyectoID), nil).Expect(t, http.StatusOK).JSON(t, &ts)
	return ts
}

func crearNota(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int, texto string) models.NotasProyectoResponse {
	t.Helper()
	var n models.NotasProyectoResponse
	api.Do(u, http.MethodPost, apitest.Path("/api/proyects/%d/notas", proyectoID), map[string]any{"nota": texto}).
		Expect(t, http.StatusCreated).JSON(t, &n)
	if n.ID == 0 || n.Nota != texto || n.ProyectoID != proyectoID {
		t.Fatalf("nota creada inesperada: %+v", n)
	}
	return n
}

func getNota(t *testing.T, api *apitest.API, u *apitest.User, id int) models.NotasProyectoResponse {
	t.Helper()
	var n models.NotasProyectoResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/notas/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &n)
	return n
}

func listarNotas(t *testing.T, api *apitest.API, u *apitest.User, path string) []models.NotasProyectoResponse {
	t.Helper()
	var ns []models.NotasProyectoResponse
	api.Do(u, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &ns)
	return ns
}

func crearLog(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int, titulo, contenido string) models.ProjectLog {
	t.Helper()
	var l models.ProjectLog
	api.Do(u, http.MethodPost, apitest.Path("/api/proyects/%d/logs", proyectoID),
		map[string]any{"titulo": titulo, "contenido_raw": contenido}).Expect(t, http.StatusCreated).JSON(t, &l)
	if l.ID == 0 || l.ProyectoID != proyectoID || l.ContenidoRaw != contenido {
		t.Fatalf("log creado inesperado: %+v", l)
	}
	return l
}

func getLog(t *testing.T, api *apitest.API, u *apitest.User, id int) models.ProjectLog {
	t.Helper()
	var l models.ProjectLog
	api.Do(u, http.MethodGet, apitest.Path("/api/logs/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &l)
	return l
}

func listarLogs(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int) []models.ProjectLog {
	t.Helper()
	var ls []models.ProjectLog
	api.Do(u, http.MethodGet, apitest.Path("/api/proyects/%d/logs", proyectoID), nil).Expect(t, http.StatusOK).JSON(t, &ls)
	return ls
}

// ---------- utilidades ----------

func ids[T any](items []T, id func(T) int) []int {
	out := make([]int, 0, len(items))
	for _, it := range items {
		out = append(out, id(it))
	}
	return out
}

func proyectoIDs(ps []models.ProyectResponse) []int {
	return ids(ps, func(p models.ProyectResponse) int { return p.ID })
}

func tareaIDs(ts []models.TareaResponse) []int {
	return ids(ts, func(x models.TareaResponse) int { return x.ID })
}

func notaIDs(ns []models.NotasProyectoResponse) []int {
	return ids(ns, func(n models.NotasProyectoResponse) int { return n.ID })
}

func logIDs(ls []models.ProjectLog) []int {
	return ids(ls, func(l models.ProjectLog) int { return l.ID })
}

func contiene(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// expectIDs exige exactamente esos ids (en cualquier orden).
func expectIDs(t *testing.T, que string, got []int, want ...int) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: ids %v, se esperaban %v", que, got, want)
		return
	}
	for _, w := range want {
		if !contiene(got, w) {
			t.Errorf("%s: ids %v, se esperaban %v", que, got, want)
			return
		}
	}
}

func ptr[T any](v T) *T { return &v }

func str(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

func idStr(p *int) string {
	if p == nil {
		return "<nil>"
	}
	return fmt.Sprint(*p)
}
