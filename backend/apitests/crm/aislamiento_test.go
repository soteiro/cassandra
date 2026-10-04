package crm

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
)

// Beto no puede leer, listar, editar ni borrar personas de Ana.
func TestAislamientoPersonas(t *testing.T) {
	api, ana, beto := setup(t)
	p := createPersona(t, api, ana, "Carla")
	yoAna := yoDe(t, api, ana)
	path := apitest.Path("/api/personas/%d", p.ID)

	expectDenied(t, api.Do(beto, http.MethodGet, path, nil), "GET persona ajena")
	expectDenied(t, api.Do(beto, http.MethodGet, apitest.Path("/api/personas/%d", yoAna.ID), nil), "GET persona yo ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"nombre": "Hackeada"}), "PUT persona ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"eliminado": true}), "PUT eliminado persona ajena")
	expectNot2xx(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE persona ajena")

	for _, bp := range listPersonas(t, api, beto) {
		if bp.UserID != beto.ID {
			t.Errorf("el listado de Beto incluye una persona de otro usuario: %+v", bp)
		}
	}
	if n := len(listPersonas(t, api, beto)); n != 1 {
		t.Errorf("Beto debería ver solo su persona yo, ve %d", n)
	}

	got := getPersona(t, api, ana, p.ID)
	if got.Nombre != "Carla" || got.Alias != "al-Carla" || got.Eliminado {
		t.Errorf("la persona de Ana cambió tras los intentos de Beto: %+v", got)
	}
}

// Beto no puede leer, listar, editar ni borrar interacciones de Ana, ni por id ni por la
// ruta anidada de la persona.
func TestAislamientoInteracciones(t *testing.T) {
	api, ana, beto := setup(t)
	p := createPersona(t, api, ana, "Carla")
	i := createInteraccion(t, api, ana, p.ID, "café con Carla")
	path := apitest.Path("/api/interacciones/%d", i.ID)

	expectDenied(t, api.Do(beto, http.MethodGet, path, nil), "GET interacción ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"interaccion": "editada por Beto"}), "PUT interacción ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"eliminado": true}), "PUT eliminado interacción ajena")
	expectNot2xx(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE interacción ajena")

	// Ruta anidada sobre persona de Ana: vacío, 403 o 404, pero nunca sus datos.
	res := api.Do(beto, http.MethodGet, apitest.Path("/api/personas/%d/interacciones", p.ID), nil)
	if res.Status == http.StatusOK {
		var is []map[string]any
		res.JSON(t, &is)
		if len(is) != 0 {
			t.Errorf("Beto ve %d interacciones de una persona de Ana: %s", len(is), res.Body)
		}
	} else {
		expectDenied(t, res, "GET interacciones de persona ajena")
	}

	if is := listInteracciones(t, api, beto, "/api/interacciones"); len(is) != 0 {
		t.Errorf("el listado de Beto incluye interacciones ajenas: %+v", is)
	}

	got := getInteraccion(t, api, ana, i.ID)
	if got.Interaccion != "café con Carla" || got.Eliminado || got.FechaActualizacion != nil {
		t.Errorf("la interacción de Ana cambió tras los intentos de Beto: %+v", got)
	}
}

// Beto no debe poder colgar interacciones de una persona de Ana.
func TestAislamientoCrearInteraccionEnPersonaAjena(t *testing.T) {
	bug(t, "se pueden crear interacciones sobre personas de otro usuario (no se valida la propiedad de persona_id)")
	api, ana, beto := setup(t)
	p := createPersona(t, api, ana, "Carla")

	expectDenied(t, api.Do(beto, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", p.ID),
		map[string]any{"interaccion": "intrusa por ruta"}), "POST interacción en persona ajena (ruta anidada)")
	expectDenied(t, api.Do(beto, http.MethodPost, "/api/interacciones",
		map[string]any{"persona_id": p.ID, "interaccion": "intrusa por body"}), "POST interacción en persona ajena (body)")

	var n int
	if err := api.DB.QueryRow(t.Context(), `SELECT count(*) FROM interacciones WHERE persona_id = $1`, p.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("se crearon %d interacciones en la persona de Ana", n)
	}
}

// Beto no puede leer, listar, editar ni borrar reflexiones de Ana.
func TestAislamientoReflexiones(t *testing.T) {
	api, ana, beto := setup(t)
	r := createReflexion(t, api, ana, "pensamiento privado", "memoria")
	path := apitest.Path("/api/reflexiones/%d", r.ID)

	expectDenied(t, api.Do(beto, http.MethodGet, path, nil), "GET reflexión ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"reflexion": "editada", "tipo": "evento"}), "PUT reflexión ajena")
	expectDenied(t, api.Do(beto, http.MethodPut, path, map[string]any{"eliminado": true}), "PUT eliminado reflexión ajena")
	expectNot2xx(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE reflexión ajena")

	for _, q := range []string{"", "?tipo=memoria"} {
		if rs := listReflexiones(t, api, beto, q); len(rs) != 0 {
			t.Errorf("GET /api/reflexiones%s de Beto incluye reflexiones ajenas: %+v", q, rs)
		}
	}

	got := getReflexion(t, api, ana, r.ID)
	if got.Reflexion != "pensamiento privado" || got.Tipo != "memoria" || got.Eliminado || got.FechaActualizacion != nil {
		t.Errorf("la reflexión de Ana cambió tras los intentos de Beto: %+v", got)
	}
}

// Beto no puede ver, editar ni borrar al usuario Ana.
func TestAislamientoUsuarios(t *testing.T) {
	api, ana, beto := setup(t)
	path := apitest.Path("/api/users/%d", ana.ID)

	res := api.Do(beto, http.MethodGet, path, nil)
	expectDenied(t, res, "GET usuario ajeno")
	if strings.Contains(string(res.Body), ana.Email) {
		t.Errorf("la respuesta filtra el email de Ana: %s", res.Body)
	}
	expectDenied(t, api.Do(beto, http.MethodPut, path,
		map[string]any{"nombre": "Pirata", "alias": "pirata", "email": "pirata@crm.test"}), "PUT usuario ajeno")
	expectDenied(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE usuario ajeno")

	var me struct {
		ID     int    `json:"id"`
		Nombre string `json:"nombre"`
		Email  string `json:"email"`
	}
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &me)
	if me.Nombre != "ana" || me.Email != ana.Email {
		t.Errorf("el usuario Ana cambió tras los intentos de Beto: %+v", me)
	}
	api.Do(nil, http.MethodPost, "/api/auth/login",
		map[string]any{"email": ana.Email, "password": password}).Expect(t, http.StatusOK)
}
