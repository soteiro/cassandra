// Package crm prueba por HTTP los módulos de personas, interacciones, reflexiones y
// usuarios: aislamiento entre usuarios, CRUD, validaciones y reglas propias.
//
// Los tests que documentan un bug de producción se saltan con bug(t, ...); para verlos
// fallar: CRM_BUGS=1 go test ./apitests/crm/...
package crm

import (
	"context"
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

const password = "clave-de-test-123"

// bug marca un test que describe el comportamiento correcto pero hoy falla por un bug
// de producción. Se salta salvo que CRM_BUGS=1.
func bug(t *testing.T, desc string) {
	t.Helper()
	if os.Getenv("CRM_BUGS") == "" {
		t.Skip("BUG: " + desc + " — ver reporte")
	}
}

// newUser crea un usuario con alias único (= parte local del email).
// No se usa api.User para el segundo usuario porque crea usuarios con alias ” y la
// columna users.alias es UNIQUE (ver TestCrearDosUsuariosSinAlias).
func newUser(t *testing.T, api *apitest.API, email string) *apitest.User {
	t.Helper()
	alias := strings.Split(email, "@")[0]
	u, err := admin.CreateUser(context.Background(), repository.NewUserRepository(api.DB),
		admin.NewUser{Nombre: alias, Alias: alias, Email: email, Password: password})
	if err != nil {
		t.Fatalf("creando usuario %s: %v", email, err)
	}
	token, err := utils.GenerateAccessToken(u.ID, apitest.JWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return &apitest.User{ID: u.ID, Email: u.Email, Token: token}
}

// setup levanta la API con dos usuarios independientes.
func setup(t *testing.T) (*apitest.API, *apitest.User, *apitest.User) {
	t.Helper()
	api := apitest.New(t, "crm")
	return api, newUser(t, api, "ana@crm.test"), newUser(t, api, "beto@crm.test")
}

// expectDenied acepta 403 o 404 (recurso ajeno o inexistente).
func expectDenied(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status != http.StatusForbidden && res.Status != http.StatusNotFound {
		t.Errorf("%s: código %d, se esperaba 403 o 404; cuerpo: %s", what, res.Status, res.Body)
	}
}

// expectNot2xx comprueba solo que la operación no tuvo éxito (el código exacto se
// verifica aparte).
func expectNot2xx(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status >= 200 && res.Status < 300 {
		t.Errorf("%s: código %d (éxito), se esperaba un rechazo; cuerpo: %s", what, res.Status, res.Body)
	}
}

// expect4xx comprueba un error de cliente (nunca 2xx ni 5xx).
func expect4xx(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status < 400 || res.Status >= 500 {
		t.Errorf("%s: código %d, se esperaba 4xx; cuerpo: %s", what, res.Status, res.Body)
	}
}

func createPersona(t *testing.T, api *apitest.API, u *apitest.User, nombre string) models.PersonaResponse {
	t.Helper()
	var p models.PersonaResponse
	api.Do(u, http.MethodPost, "/api/personas", map[string]any{
		"nombre": nombre, "alias": "al-" + nombre, "entorno": "trabajo", "informacion": "info de " + nombre,
	}).Expect(t, http.StatusCreated).JSON(t, &p)
	return p
}

func getPersona(t *testing.T, api *apitest.API, u *apitest.User, id int) models.PersonaResponse {
	t.Helper()
	var p models.PersonaResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/personas/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &p)
	return p
}

func listPersonas(t *testing.T, api *apitest.API, u *apitest.User) []models.PersonaResponse {
	t.Helper()
	var ps []models.PersonaResponse
	api.Do(u, http.MethodGet, "/api/personas", nil).Expect(t, http.StatusOK).JSON(t, &ps)
	return ps
}

func yoDe(t *testing.T, api *apitest.API, u *apitest.User) models.PersonaResponse {
	t.Helper()
	for _, p := range listPersonas(t, api, u) {
		if p.EsYo {
			return p
		}
	}
	t.Fatalf("el usuario %s no tiene persona es_yo", u.Email)
	return models.PersonaResponse{}
}

func createInteraccion(t *testing.T, api *apitest.API, u *apitest.User, personaID int, texto string) models.InteraccionResponse {
	t.Helper()
	var i models.InteraccionResponse
	api.Do(u, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", personaID),
		map[string]any{"interaccion": texto}).Expect(t, http.StatusCreated).JSON(t, &i)
	return i
}

func getInteraccion(t *testing.T, api *apitest.API, u *apitest.User, id int) models.InteraccionResponse {
	t.Helper()
	var i models.InteraccionResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/interacciones/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &i)
	return i
}

func listInteracciones(t *testing.T, api *apitest.API, u *apitest.User, path string) []models.InteraccionResponse {
	t.Helper()
	var is []models.InteraccionResponse
	api.Do(u, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &is)
	return is
}

func createReflexion(t *testing.T, api *apitest.API, u *apitest.User, texto, tipo string) models.ReflexionResponse {
	t.Helper()
	body := map[string]any{"reflexion": texto}
	if tipo != "" {
		body["tipo"] = tipo
	}
	var r models.ReflexionResponse
	api.Do(u, http.MethodPost, "/api/reflexiones", body).Expect(t, http.StatusCreated).JSON(t, &r)
	return r
}

func getReflexion(t *testing.T, api *apitest.API, u *apitest.User, id int) models.ReflexionResponse {
	t.Helper()
	var r models.ReflexionResponse
	api.Do(u, http.MethodGet, apitest.Path("/api/reflexiones/%d", id), nil).Expect(t, http.StatusOK).JSON(t, &r)
	return r
}

func listReflexiones(t *testing.T, api *apitest.API, u *apitest.User, query string) []models.ReflexionResponse {
	t.Helper()
	var rs []models.ReflexionResponse
	api.Do(u, http.MethodGet, "/api/reflexiones"+query, nil).Expect(t, http.StatusOK).JSON(t, &rs)
	return rs
}
