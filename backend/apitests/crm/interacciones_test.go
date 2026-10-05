package crm

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestInteraccionesCRUD(t *testing.T) {
	api, ana, _ := setup(t)
	carla := createPersona(t, api, ana, "Carla")
	diego := createPersona(t, api, ana, "Diego")

	// Crear por ruta anidada (recorta espacios) y por /api/interacciones con persona_id.
	i1 := createInteraccion(t, api, ana, carla.ID, "  café con Carla  ")
	if i1.UserID != ana.ID || i1.PersonaID != carla.ID || i1.Interaccion != "café con Carla" ||
		i1.Eliminado || i1.FechaCreacion.IsZero() || i1.FechaActualizacion != nil {
		t.Errorf("interacción creada = %+v", i1)
	}
	var i2 models.InteraccionResponse
	api.Do(ana, http.MethodPost, "/api/interacciones",
		map[string]any{"persona_id": diego.ID, "interaccion": "llamada con Diego"}).Expect(t, http.StatusCreated).JSON(t, &i2)
	if i2.PersonaID != diego.ID || i2.UserID != ana.ID {
		t.Errorf("interacción creada por body = %+v", i2)
	}
	// La persona de la URL manda sobre la del cuerpo.
	var i3 models.InteraccionResponse
	api.Do(ana, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", carla.ID),
		map[string]any{"persona_id": diego.ID, "interaccion": "almuerzo"}).Expect(t, http.StatusCreated).JSON(t, &i3)
	if i3.PersonaID != carla.ID {
		t.Errorf("persona_id = %d, se esperaba la de la URL %d", i3.PersonaID, carla.ID)
	}

	if got := getInteraccion(t, api, ana, i1.ID); !got.FechaCreacion.Equal(i1.FechaCreacion) || got.Interaccion != i1.Interaccion {
		t.Errorf("GET = %+v, se esperaba %+v", got, i1)
	}

	// Listados: general y por persona.
	if is := listInteracciones(t, api, ana, "/api/interacciones"); len(is) != 3 {
		t.Errorf("listado general: %d interacciones, se esperaban 3", len(is))
	}
	is := listInteracciones(t, api, ana, apitest.Path("/api/personas/%d/interacciones", carla.ID))
	if len(is) != 2 {
		t.Errorf("listado de Carla: %d interacciones, se esperaban 2", len(is))
	}
	for _, i := range is {
		if i.PersonaID != carla.ID {
			t.Errorf("el listado de Carla incluye %+v", i)
		}
	}

	// PUT: cambia el texto y fija fecha_actualizacion.
	var upd models.InteraccionResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/interacciones/%d", i1.ID),
		map[string]any{"interaccion": "  té con Carla "}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Interaccion != "té con Carla" || upd.PersonaID != carla.ID || upd.FechaActualizacion == nil ||
		upd.FechaActualizacion.Before(i1.FechaCreacion) {
		t.Errorf("PUT devolvió %+v", upd)
	}
	got := getInteraccion(t, api, ana, i1.ID)
	if got.Interaccion != "té con Carla" || got.FechaActualizacion == nil || !got.FechaActualizacion.Equal(*upd.FechaActualizacion) {
		t.Errorf("GET tras PUT = %+v", got)
	}
	// PUT vacío ({}): no cambia el texto.
	api.Do(ana, http.MethodPut, apitest.Path("/api/interacciones/%d", i1.ID), map[string]any{}).Expect(t, http.StatusOK)
	if got := getInteraccion(t, api, ana, i1.ID); got.Interaccion != "té con Carla" {
		t.Errorf("PUT {} cambió el texto: %+v", got)
	}

	// DELETE: 204 y después 404 / fuera de listados.
	path := apitest.Path("/api/interacciones/%d", i1.ID)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, path, map[string]any{"interaccion": "zombi"}).Expect(t, http.StatusNotFound)
	if is := listInteracciones(t, api, ana, apitest.Path("/api/personas/%d/interacciones", carla.ID)); len(is) != 1 || is[0].ID != i3.ID {
		t.Errorf("listado de Carla tras borrar = %+v", is)
	}

	// Interacción sobre la propia persona yo.
	createInteraccion(t, api, ana, yoDe(t, api, ana).ID, "nota personal")
}

func TestInteraccionesValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	carla := createPersona(t, api, ana, "Carla")
	i := createInteraccion(t, api, ana, carla.ID, "café")
	nested := apitest.Path("/api/personas/%d/interacciones", carla.ID)
	path := apitest.Path("/api/interacciones/%d", i.ID)

	cases := []struct {
		name, method, path string
		body               any
		want               int
	}{
		{"POST anidado JSON roto", http.MethodPost, nested, "{roto", http.StatusBadRequest},
		{"POST anidado texto vacío", http.MethodPost, nested, map[string]any{"interaccion": "  "}, http.StatusBadRequest},
		{"POST anidado sin texto", http.MethodPost, nested, map[string]any{}, http.StatusBadRequest},
		{"POST sin persona_id", http.MethodPost, "/api/interacciones", map[string]any{"interaccion": "x"}, http.StatusBadRequest},
		{"POST persona_id negativo", http.MethodPost, "/api/interacciones", map[string]any{"persona_id": -3, "interaccion": "x"}, http.StatusBadRequest},
		{"POST persona_id texto", http.MethodPost, "/api/interacciones", map[string]any{"persona_id": "uno", "interaccion": "x"}, http.StatusBadRequest},
		{"POST anidado persona no numérica", http.MethodPost, "/api/personas/abc/interacciones", map[string]any{"interaccion": "x"}, http.StatusBadRequest},
		{"GET anidado persona no numérica", http.MethodGet, "/api/personas/abc/interacciones", nil, http.StatusBadRequest},
		{"PUT JSON roto", http.MethodPut, path, "{roto", http.StatusBadRequest},
		{"PUT texto vacío", http.MethodPut, path, map[string]any{"interaccion": " "}, http.StatusBadRequest},
		{"GET id no numérico", http.MethodGet, "/api/interacciones/abc", nil, http.StatusBadRequest},
		{"PUT id no numérico", http.MethodPut, "/api/interacciones/abc", map[string]any{"interaccion": "x"}, http.StatusBadRequest},
		{"DELETE id no numérico", http.MethodDelete, "/api/interacciones/abc", nil, http.StatusBadRequest},
		{"GET id cero", http.MethodGet, "/api/interacciones/0", nil, http.StatusBadRequest},
		{"GET inexistente", http.MethodGet, "/api/interacciones/999999", nil, http.StatusNotFound},
		{"PUT inexistente", http.MethodPut, "/api/interacciones/999999", map[string]any{"interaccion": "x"}, http.StatusNotFound},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			api.Do(ana, c.method, c.path, c.body).Expect(t, c.want)
		})
	}
	if is := listInteracciones(t, api, ana, "/api/interacciones"); len(is) != 1 || is[0].Interaccion != "café" {
		t.Errorf("las peticiones inválidas modificaron datos: %+v", is)
	}
}

func TestInteraccionPersonaInexistenteDevuelve4xx(t *testing.T) {
	api, ana, _ := setup(t)
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/personas/999999/interacciones",
		map[string]any{"interaccion": "x"}), "POST anidado persona inexistente")
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/interacciones",
		map[string]any{"persona_id": 999999, "interaccion": "x"}), "POST persona_id inexistente")
}

func TestInteraccionDeleteInexistenteDevuelve404(t *testing.T) {
	bug(t, "DELETE de interacción inexistente, ajena o ya borrada responde 500 en vez de 404")
	api, ana, beto := setup(t)
	i := createInteraccion(t, api, ana, createPersona(t, api, ana, "Carla").ID, "café")
	path := apitest.Path("/api/interacciones/%d", i.ID)
	api.Do(ana, http.MethodDelete, "/api/interacciones/999999", nil).Expect(t, http.StatusNotFound)
	expectDenied(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE interacción ajena")
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNotFound)
}

// Persona sin interacciones o inexistente: lista vacía (no 500).
func TestInteraccionesListadoPersonaSinDatos(t *testing.T) {
	api, ana, _ := setup(t)
	carla := createPersona(t, api, ana, "Carla")
	if is := listInteracciones(t, api, ana, apitest.Path("/api/personas/%d/interacciones", carla.ID)); len(is) != 0 {
		t.Errorf("persona sin interacciones = %+v", is)
	}
	res := api.Do(ana, http.MethodGet, "/api/personas/999999/interacciones", nil)
	if res.Status != http.StatusOK && res.Status != http.StatusNotFound {
		t.Errorf("persona inexistente: código %d; cuerpo: %s", res.Status, res.Body)
	}
}
