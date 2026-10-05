// Package documentos prueba por HTTP real los documentos de proyecto, el flujo de
// sesión con cookies y la robustez general del router (404, 405, CORS).
package documentos

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"cassandra/internal/admin"
	"cassandra/internal/apitest"
	"cassandra/models"
	"cassandra/repository"
	"cassandra/utils"
)

// usuario crea un usuario con alias único. No se usa api.User porque crea usuarios con
// alias "" y users.alias es UNIQUE: el segundo usuario falla con "ya existe un usuario
// con ese email" (bug de admin.CreateUser/UserRepository.Create, ver reporte).
func usuario(t *testing.T, api *apitest.API, email string) *apitest.User {
	t.Helper()
	nombre := strings.Split(email, "@")[0]
	u, err := admin.CreateUser(context.Background(), repository.NewUserRepository(api.DB),
		admin.NewUser{Nombre: nombre, Alias: nombre, Email: email, Password: password})
	if err != nil {
		t.Fatalf("creando usuario %s: %v", email, err)
	}
	token, err := utils.GenerateAccessToken(u.ID, apitest.JWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return &apitest.User{ID: u.ID, Email: u.Email, Token: token}
}

// TestBug_SegundoUsuarioSinAlias: crear dos usuarios sin alias (como hace el CLI
// create-user sin --alias) debe funcionar.
func TestBug_SegundoUsuarioSinAlias(t *testing.T) {
	api := apitest.New(t, "documentos")
	api.User("uno@cassandra.test")
	api.User("dos@cassandra.test")
}

func crearProyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string) int {
	t.Helper()
	return api.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre":                nombre,
		"por_que":               "porque sí",
		"para_que":              "para probar",
		"criterio_finalizacion": "tests verdes",
		"prioridad":             "Media",
	}).Expect(t, http.StatusCreated).ID(t)
}

func crearDoc(t *testing.T, api *apitest.API, u *apitest.User, proyectoID int, body map[string]any) models.DocumentoResponse {
	t.Helper()
	var d models.DocumentoResponse
	api.Do(u, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", proyectoID), body).
		Expect(t, http.StatusCreated).JSON(t, &d)
	return d
}

func getDoc(t *testing.T, api *apitest.API, u *apitest.User, id int) models.DocumentoResponse {
	t.Helper()
	var d models.DocumentoResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/documentos/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &d)
	return d
}

func listDocs(t *testing.T, api *apitest.API, u *apitest.User, path string) []models.DocumentoResponse {
	t.Helper()
	var ds []models.DocumentoResponse
	api.Do(u, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &ds)
	return ds
}

// expectAjeno exige 403 o 404 (nunca 2xx ni 5xx) al tocar un recurso de otro usuario.
func expectAjeno(t *testing.T, res *apitest.Response, que string) {
	t.Helper()
	if res.Status != http.StatusForbidden && res.Status != http.StatusNotFound {
		t.Errorf("%s: código %d, se esperaba 403 o 404; cuerpo: %s", que, res.Status, res.Body)
	}
}

// expect4xx exige un código 4xx (entrada inválida no debe dar 500).
func expect4xx(t *testing.T, res *apitest.Response, que string) {
	t.Helper()
	if res.Status < 400 || res.Status >= 500 {
		t.Errorf("%s: código %d, se esperaba 4xx; cuerpo: %s", que, res.Status, res.Body)
	}
}

// esperar garantiza que CURRENT_TIMESTAMP avance entre dos peticiones.
func esperar() { time.Sleep(20 * time.Millisecond) }

// bug salta un test que documenta un bug de producción con el comportamiento correcto
// esperado. Con APITEST_BUGS=1 se ejecuta igualmente, para comprobar si sigue fallando.
func bug(t *testing.T, descripcion string) {
	t.Helper()
	if os.Getenv("APITEST_BUGS") == "" {
		t.Skip("BUG: " + descripcion + " — ver reporte")
	}
}
