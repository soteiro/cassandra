// Tests de integración HTTP del módulo de finanzas (bancos, grupos, movimientos
// esperados, plantilla mensual, resumen, clonación) y de la lista de deseos.
package finanzas

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

const (
	pathBancos   = "/api/finanzas/bancos"
	pathGrupos   = "/api/finanzas/grupos"
	pathMovs     = "/api/finanzas/movimientos-esperados"
	pathPlant    = "/api/finanzas/plantilla"
	pathResumen  = "/api/finanzas/resumen"
	pathClonar   = "/api/finanzas/clonar"
	pathDeseos   = "/api/lista-deseos"
	emailA       = "ana@cassandra.test"
	emailB       = "beto@cassandra.test"
	nombreSecret = "SECRETO-DE-ANA"
)

func setup(t *testing.T) (*apitest.API, *apitest.User, *apitest.User) {
	t.Helper()
	api := apitest.New(t, "finanzas")
	return api, newUser(t, api, emailA), newUser(t, api, emailB)
}

// newUser crea un usuario con alias único. No se usa api.User porque crea usuarios con
// alias ” y users.alias es UNIQUE: el segundo usuario fallaría ("ya existe un usuario
// con ese email"). Es un problema del helper/admin.CreateUser, no de finanzas.
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

func ptr[T any](v T) *T { return &v }

func crearBanco(t *testing.T, api *apitest.API, u *apitest.User, nombre, tipo string) models.BancoResponse {
	t.Helper()
	var b models.BancoResponse
	api.Do(u, http.MethodPost, pathBancos, map[string]any{"nombre": nombre, "tipo": tipo}).
		Expect(t, http.StatusCreated).JSON(t, &b)
	return b
}

func crearGrupo(t *testing.T, api *apitest.API, u *apitest.User, nombre string) models.GrupoItemFinanzasResponse {
	t.Helper()
	var g models.GrupoItemFinanzasResponse
	api.Do(u, http.MethodPost, pathGrupos, map[string]any{"nombre": nombre}).
		Expect(t, http.StatusCreated).JSON(t, &g)
	return g
}

func crearMov(t *testing.T, api *apitest.API, u *apitest.User, nombre string) models.MovimientoEsperadoFinanzasResponse {
	t.Helper()
	var m models.MovimientoEsperadoFinanzasResponse
	api.Do(u, http.MethodPost, pathMovs, map[string]any{"nombre": nombre}).
		Expect(t, http.StatusCreated).JSON(t, &m)
	return m
}

// crearItem crea un ítem de plantilla; extra sobrescribe/añade campos al cuerpo base.
func crearItem(t *testing.T, api *apitest.API, u *apitest.User, tipo string, monto, anio, mes int, extra map[string]any) models.FinanzasPlantillaResponse {
	t.Helper()
	body := map[string]any{"nombre": "item-" + tipo, "tipo": tipo, "monto": monto, "anio": anio, "mes": mes}
	for k, v := range extra {
		body[k] = v
	}
	var it models.FinanzasPlantillaResponse
	api.Do(u, http.MethodPost, pathPlant, body).Expect(t, http.StatusCreated).JSON(t, &it)
	return it
}

func crearDeseo(t *testing.T, api *apitest.API, u *apitest.User, body map[string]any) models.ListaDeseosResponse {
	t.Helper()
	var d models.ListaDeseosResponse
	api.Do(u, http.MethodPost, pathDeseos, body).Expect(t, http.StatusCreated).JSON(t, &d)
	return d
}

func plantilla(t *testing.T, api *apitest.API, u *apitest.User, anio, mes int) []models.FinanzasPlantillaResponse {
	t.Helper()
	var items []models.FinanzasPlantillaResponse
	api.Do(u, http.MethodGet, apitest.Path("%s?anio=%d&mes=%d", pathPlant, anio, mes), nil).
		Expect(t, http.StatusOK).JSON(t, &items)
	return items
}

func resumen(t *testing.T, api *apitest.API, u *apitest.User, anio, mes int) models.FinanzasResumenPeriodo {
	t.Helper()
	var r models.FinanzasResumenPeriodo
	api.Do(u, http.MethodGet, apitest.Path("%s?anio=%d&mes=%d", pathResumen, anio, mes), nil).
		Expect(t, http.StatusOK).JSON(t, &r)
	return r
}

// expectDenegado exige 403 o 404 (recurso ajeno o inexistente).
func expectDenegado(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status != http.StatusForbidden && res.Status != http.StatusNotFound {
		t.Errorf("%s: código %d, se esperaba 403 o 404; cuerpo: %s", what, res.Status, res.Body)
	}
}

// expectNo2xx exige que la petición no haya tenido éxito (cualquier código >= 400).
func expectNo2xx(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status < 400 {
		t.Errorf("%s: código %d, se esperaba un error; cuerpo: %s", what, res.Status, res.Body)
	}
}

// expect4xx exige un error de cliente (ni 2xx ni 5xx).
func expect4xx(t *testing.T, res *apitest.Response, what string) {
	t.Helper()
	if res.Status < 400 || res.Status >= 500 {
		t.Errorf("%s: código %d, se esperaba 4xx; cuerpo: %s", what, res.Status, res.Body)
	}
}

// bug marca un test que documenta un bug de producción: se salta salvo que se ejecute
// con FINANZAS_BUGS=1 (para comprobar que el bug sigue ahí o que ya se corrigió).
func bug(t *testing.T, desc string) {
	t.Helper()
	if os.Getenv("FINANZAS_BUGS") == "" {
		t.Skip("BUG: " + desc + " — ver reporte")
	}
}
