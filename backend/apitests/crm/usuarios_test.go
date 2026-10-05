package crm

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func login(t *testing.T, api *apitest.API, email, pass string) *apitest.Response {
	t.Helper()
	return api.Do(nil, http.MethodPost, "/api/auth/login", map[string]any{"email": email, "password": pass})
}

func TestUsuarioGetPropio(t *testing.T) {
	api, ana, _ := setup(t)
	res := api.Do(ana, http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusOK)
	var u models.UserResponse
	res.JSON(t, &u)
	if u.ID != ana.ID || u.Email != ana.Email || u.Nombre != "ana" || u.Alias != "ana" || u.FechaCreacion.IsZero() {
		t.Errorf("perfil = %+v", u)
	}
	if strings.Contains(strings.ToLower(string(res.Body)), "password") || strings.Contains(string(res.Body), "$2a$") {
		t.Errorf("el perfil expone la contraseña: %s", res.Body)
	}
}

func TestUsuarioUpdatePropio(t *testing.T) {
	api, ana, _ := setup(t)
	path := apitest.Path("/api/users/%d", ana.ID)

	var u models.UserResponse
	api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "  Ana María ", "alias": " anita ", "email": " ana.maria@crm.test "}).
		Expect(t, http.StatusOK).JSON(t, &u)
	if u.ID != ana.ID || u.Nombre != "Ana María" || u.Alias != "anita" || u.Email != "ana.maria@crm.test" {
		t.Errorf("PUT devolvió %+v", u)
	}
	var got models.UserResponse
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got != u {
		t.Errorf("GET tras PUT = %+v, se esperaba %+v", got, u)
	}

	// El login pasa a usar el email nuevo.
	login(t, api, "ana.maria@crm.test", password).Expect(t, http.StatusOK)
	login(t, api, ana.Email, password).Expect(t, http.StatusUnauthorized)
}

func TestUsuarioValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	path := apitest.Path("/api/users/%d", ana.ID)

	cases := []struct {
		name, method, path string
		body               any
		want               int
	}{
		{"PUT JSON roto", http.MethodPut, path, "{roto", http.StatusBadRequest},
		{"PUT nombre vacío", http.MethodPut, path, map[string]any{"nombre": " ", "email": "a@crm.test"}, http.StatusBadRequest},
		{"PUT email vacío", http.MethodPut, path, map[string]any{"nombre": "Ana", "email": ""}, http.StatusBadRequest},
		{"PUT email inválido", http.MethodPut, path, map[string]any{"nombre": "Ana", "email": "no-es-email"}, http.StatusBadRequest},
		{"GET id no numérico", http.MethodGet, "/api/users/abc", nil, http.StatusBadRequest},
		{"PUT id no numérico", http.MethodPut, "/api/users/abc", map[string]any{"nombre": "Ana", "email": "a@crm.test"}, http.StatusBadRequest},
		{"DELETE id no numérico", http.MethodDelete, "/api/users/abc", nil, http.StatusBadRequest},
		{"GET id cero", http.MethodGet, "/api/users/0", nil, http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			api.Do(ana, c.method, c.path, c.body).Expect(t, c.want)
		})
	}
	// Usuario inexistente: 403 (no es uno mismo) o 404.
	expectDenied(t, api.Do(ana, http.MethodGet, "/api/users/999999", nil), "GET usuario inexistente")

	var u models.UserResponse
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &u)
	if u.Nombre != "ana" || u.Email != ana.Email {
		t.Errorf("el usuario cambió tras peticiones inválidas: %+v", u)
	}
}

func TestUsuarioEmailOAliasDuplicadoDevuelve409(t *testing.T) {
	api, ana, beto := setup(t)
	path := apitest.Path("/api/users/%d", ana.ID)
	api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "Ana", "alias": "ana", "email": beto.Email}).Expect(t, http.StatusConflict)
	api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "Ana", "alias": "beto", "email": ana.Email}).Expect(t, http.StatusConflict)
}

// Varios usuarios sin alias deben poder convivir: alias vacío debería guardarse como NULL.
func TestUsuarioAliasVacioEnVariosUsuarios(t *testing.T) {
	api, ana, beto := setup(t)
	api.Do(ana, http.MethodPut, apitest.Path("/api/users/%d", ana.ID),
		map[string]any{"nombre": "Ana", "alias": "", "email": ana.Email}).Expect(t, http.StatusOK)
	api.Do(beto, http.MethodPut, apitest.Path("/api/users/%d", beto.ID),
		map[string]any{"nombre": "Beto", "alias": "  ", "email": beto.Email}).Expect(t, http.StatusOK)
}

// Lo mismo al crear cuentas como el CLI (create-user sin --alias) — es lo que hace api.User.
func TestCrearDosUsuariosSinAlias(t *testing.T) {
	api := apitest.New(t, "crm")
	api.User("uno@crm.test")
	api.User("dos@crm.test")
}

func TestUsuarioCamposLargosDevuelven400(t *testing.T) {
	api, ana, _ := setup(t)
	path := apitest.Path("/api/users/%d", ana.ID)
	expect4xx(t, api.Do(ana, http.MethodPut, path,
		map[string]any{"nombre": strings.Repeat("n", 51), "email": ana.Email}), "nombre de 51 caracteres")
	expect4xx(t, api.Do(ana, http.MethodPut, path,
		map[string]any{"nombre": "Ana", "email": strings.Repeat("e", 45) + "@crm.test"}), "email de 54 caracteres")
}

// Tras borrarse, el usuario no puede iniciar sesión ni ver su perfil.
func TestUsuarioDeleteImpideLogin(t *testing.T) {
	api, ana, beto := setup(t)
	login(t, api, ana.Email, password).Expect(t, http.StatusOK)

	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	login(t, api, ana.Email, password).Expect(t, http.StatusUnauthorized)
	res := api.Do(ana, http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil)
	if res.Status != http.StatusNotFound && res.Status != http.StatusUnauthorized {
		t.Errorf("GET perfil borrado: código %d; cuerpo: %s", res.Status, res.Body)
	}
	// Los demás usuarios no se ven afectados.
	login(t, api, beto.Email, password).Expect(t, http.StatusOK)
	api.Do(beto, http.MethodGet, apitest.Path("/api/users/%d", beto.ID), nil).Expect(t, http.StatusOK)
}

// Tras borrarse, un access token emitido antes no debe seguir sirviendo.
func TestUsuarioBorradoNoPuedeUsarLaAPI(t *testing.T) {
	api, ana, _ := setup(t)
	createPersona(t, api, ana, "Carla")
	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	api.Do(ana, http.MethodGet, "/api/personas", nil).Expect(t, http.StatusUnauthorized)
	api.Do(ana, http.MethodGet, "/api/reflexiones", nil).Expect(t, http.StatusUnauthorized)
	api.Do(ana, http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "post mortem"}).Expect(t, http.StatusUnauthorized)
	api.Do(ana, http.MethodPut, apitest.Path("/api/users/%d", ana.ID),
		map[string]any{"nombre": "Ana", "email": ana.Email}).Expect(t, http.StatusUnauthorized)
}

// Tras borrarse, el refresh token de una sesión previa no debe emitir tokens nuevos.
func TestUsuarioBorradoNoPuedeRefrescarSesion(t *testing.T) {
	api, ana, _ := setup(t)
	res := login(t, api, ana.Email, password).Expect(t, http.StatusOK)
	var refresh *http.Cookie
	for _, c := range (&http.Response{Header: res.Header}).Cookies() {
		if c.Name == "refresh_token" {
			refresh = c
		}
	}
	if refresh == nil {
		t.Fatal("el login no devolvió la cookie refresh_token")
	}

	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	req, err := http.NewRequest(http.MethodPost, api.Server.URL+"/api/auth/refresh", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: refresh.Value})
	r, err := api.Server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	r.Body.Close()
	if r.StatusCode != http.StatusUnauthorized {
		t.Errorf("POST /api/auth/refresh tras borrar el usuario: código %d, se esperaba 401", r.StatusCode)
	}
}

func TestSinTokenDevuelve401(t *testing.T) {
	api, ana, _ := setup(t)
	p := createPersona(t, api, ana, "Carla")
	i := createInteraccion(t, api, ana, p.ID, "café")
	r := createReflexion(t, api, ana, "x", "")

	routes := []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, "/api/personas", nil},
		{http.MethodPost, "/api/personas", map[string]any{"nombre": "X"}},
		{http.MethodGet, apitest.Path("/api/personas/%d", p.ID), nil},
		{http.MethodPut, apitest.Path("/api/personas/%d", p.ID), map[string]any{"nombre": "X"}},
		{http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil},
		{http.MethodGet, apitest.Path("/api/personas/%d/interacciones", p.ID), nil},
		{http.MethodPost, apitest.Path("/api/personas/%d/interacciones", p.ID), map[string]any{"interaccion": "X"}},
		{http.MethodGet, "/api/interacciones", nil},
		{http.MethodPost, "/api/interacciones", map[string]any{"persona_id": p.ID, "interaccion": "X"}},
		{http.MethodGet, apitest.Path("/api/interacciones/%d", i.ID), nil},
		{http.MethodPut, apitest.Path("/api/interacciones/%d", i.ID), map[string]any{"interaccion": "X"}},
		{http.MethodDelete, apitest.Path("/api/interacciones/%d", i.ID), nil},
		{http.MethodGet, "/api/reflexiones", nil},
		{http.MethodGet, "/api/reflexiones?tipo=evento", nil},
		{http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "X"}},
		{http.MethodGet, apitest.Path("/api/reflexiones/%d", r.ID), nil},
		{http.MethodPut, apitest.Path("/api/reflexiones/%d", r.ID), map[string]any{"reflexion": "X"}},
		{http.MethodDelete, apitest.Path("/api/reflexiones/%d", r.ID), nil},
		{http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil},
		{http.MethodPut, apitest.Path("/api/users/%d", ana.ID), map[string]any{"nombre": "X", "email": "x@crm.test"}},
		{http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil},
	}
	falso := &apitest.User{ID: ana.ID, Token: "token-falso"}
	for _, rt := range routes {
		t.Run(rt.method+" "+rt.path, func(t *testing.T) {
			api.Do(nil, rt.method, rt.path, rt.body).Expect(t, http.StatusUnauthorized)
			api.Do(falso, rt.method, rt.path, rt.body).Expect(t, http.StatusUnauthorized)
		})
	}

	// Nada cambió.
	if got := getPersona(t, api, ana, p.ID); got.Nombre != "Carla" {
		t.Errorf("persona modificada sin token: %+v", got)
	}
	if got := getInteraccion(t, api, ana, i.ID); got.Interaccion != "café" {
		t.Errorf("interacción modificada sin token: %+v", got)
	}
	if got := getReflexion(t, api, ana, r.ID); got.Reflexion != "x" {
		t.Errorf("reflexión modificada sin token: %+v", got)
	}
	if n := len(listPersonas(t, api, ana)); n != 2 {
		t.Errorf("se crearon personas sin token: %d", n)
	}
	api.Do(ana, http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusOK)
}
