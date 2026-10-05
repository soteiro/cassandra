package crm

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestPersonasCRUD(t *testing.T) {
	api, ana, _ := setup(t)

	// Crear: recorta espacios e ignora un user_id enviado en el cuerpo.
	var p models.PersonaResponse
	api.Do(ana, http.MethodPost, "/api/personas", map[string]any{
		"nombre": "  Carla  ", "alias": " carlita ", "entorno": " trabajo ", "informacion": " le gusta el té ",
		"user_id": ana.ID + 999,
	}).Expect(t, http.StatusCreated).JSON(t, &p)
	if p.ID == 0 || p.UserID != ana.ID || p.Nombre != "Carla" || p.Alias != "carlita" ||
		p.Entorno != "trabajo" || p.Informacion != "le gusta el té" || p.EsYo || p.Eliminado || p.FechaCreacion.IsZero() {
		t.Errorf("persona creada = %+v", p)
	}
	if got := getPersona(t, api, ana, p.ID); got != p {
		t.Errorf("GET = %+v, se esperaba %+v", got, p)
	}

	// Listado: la persona yo primero, luego las demás.
	ps := listPersonas(t, api, ana)
	if len(ps) != 2 || !ps[0].EsYo || ps[1].ID != p.ID {
		t.Errorf("listado = %+v", ps)
	}

	// PUT parcial: solo cambia lo enviado.
	var upd models.PersonaResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/personas/%d", p.ID),
		map[string]any{"alias": "  Carlota ", "informacion": "prefiere café"}).Expect(t, http.StatusOK).JSON(t, &upd)
	want := p
	want.Alias, want.Informacion = "Carlota", "prefiere café"
	if upd != want {
		t.Errorf("PUT devolvió %+v, se esperaba %+v", upd, want)
	}
	if got := getPersona(t, api, ana, p.ID); got != want {
		t.Errorf("GET tras PUT = %+v, se esperaba %+v", got, want)
	}

	// Borrar: 204, luego 404 en GET/PUT y fuera del listado.
	path := apitest.Path("/api/personas/%d", p.ID)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "Zombi"}).Expect(t, http.StatusNotFound)
	if ps := listPersonas(t, api, ana); len(ps) != 1 || !ps[0].EsYo {
		t.Errorf("listado tras borrar = %+v", ps)
	}
}

func TestPersonaYoEnListado(t *testing.T) {
	api, ana, _ := setup(t)
	createPersona(t, api, ana, "Carla")
	createPersona(t, api, ana, "Diego")

	ps := listPersonas(t, api, ana)
	if len(ps) != 3 {
		t.Fatalf("se esperaban 3 personas, hay %d: %+v", len(ps), ps)
	}
	if !ps[0].EsYo || ps[0].Nombre != "ana" || ps[0].UserID != ana.ID {
		t.Errorf("la primera persona debería ser el yo de Ana: %+v", ps[0])
	}
	yos := 0
	for _, p := range ps {
		if p.EsYo {
			yos++
		}
	}
	if yos != 1 {
		t.Errorf("hay %d personas es_yo, se esperaba 1", yos)
	}
}

// La persona yo no se puede borrar con DELETE (hoy se rechaza, aunque con 500).
func TestPersonaYoNoSeBorraConDelete(t *testing.T) {
	api, ana, _ := setup(t)
	yo := yoDe(t, api, ana)
	expectNot2xx(t, api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", yo.ID), nil), "DELETE persona yo")
	if got := getPersona(t, api, ana, yo.ID); !got.EsYo || got.Eliminado {
		t.Errorf("la persona yo cambió: %+v", got)
	}
}

func TestPersonaYoDeleteDevuelve4xx(t *testing.T) {
	api, ana, _ := setup(t)
	yo := yoDe(t, api, ana)
	expect4xx(t, api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", yo.ID), nil), "DELETE persona yo")
}

// PUT no debe saltarse la protección de DELETE: {"eliminado": true} o {"es_yo": false}
// se ignoran (o se rechazan) y la persona yo queda intacta.
func TestPersonaYoNoSeBorraConPut(t *testing.T) {
	api, ana, _ := setup(t)
	yo := yoDe(t, api, ana)
	path := apitest.Path("/api/personas/%d", yo.ID)

	for _, body := range []map[string]any{{"eliminado": true}, {"es_yo": false}} {
		if res := api.Do(ana, http.MethodPut, path, body); res.Status >= 500 {
			t.Errorf("PUT %v en yo: código %d; cuerpo: %s", body, res.Status, res.Body)
		}
	}
	if got := getPersona(t, api, ana, yo.ID); !got.EsYo || got.Eliminado {
		t.Errorf("la persona yo cambió: %+v", got)
	}
}

// Solo debe existir una persona es_yo por usuario.
func TestPersonaNoSePuedeCrearOtroYo(t *testing.T) {
	api, ana, _ := setup(t)

	var p models.PersonaResponse
	res := api.Do(ana, http.MethodPost, "/api/personas", map[string]any{"nombre": "Impostor", "es_yo": true})
	if res.Status == http.StatusCreated {
		res.JSON(t, &p)
		if p.EsYo {
			t.Errorf("POST creó una segunda persona yo: %+v", p)
		}
	} else {
		expect4xx(t, res, "POST con es_yo=true")
	}

	otra := createPersona(t, api, ana, "Carla")
	res = api.Do(ana, http.MethodPut, apitest.Path("/api/personas/%d", otra.ID), map[string]any{"es_yo": true})
	if res.Status == http.StatusOK {
		res.JSON(t, &p)
		if p.EsYo {
			t.Errorf("PUT convirtió otra persona en yo: %+v", p)
		}
	} else {
		expect4xx(t, res, "PUT con es_yo=true")
	}

	yos := 0
	for _, p := range listPersonas(t, api, ana) {
		if p.EsYo {
			yos++
		}
	}
	if yos != 1 {
		t.Errorf("hay %d personas es_yo, se esperaba 1", yos)
	}
}

func TestPersonasValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := createPersona(t, api, ana, "Carla")
	path := apitest.Path("/api/personas/%d", p.ID)

	cases := []struct {
		name, method, path string
		body               any
		want               int
	}{
		{"POST JSON roto", http.MethodPost, "/api/personas", "{roto", http.StatusBadRequest},
		{"POST nombre vacío", http.MethodPost, "/api/personas", map[string]any{"nombre": ""}, http.StatusBadRequest},
		{"POST nombre solo espacios", http.MethodPost, "/api/personas", map[string]any{"nombre": "   "}, http.StatusBadRequest},
		{"POST sin nombre", http.MethodPost, "/api/personas", map[string]any{"alias": "x"}, http.StatusBadRequest},
		{"POST nombre de tipo incorrecto", http.MethodPost, "/api/personas", map[string]any{"nombre": 42}, http.StatusBadRequest},
		{"PUT JSON roto", http.MethodPut, path, "{roto", http.StatusBadRequest},
		{"PUT nombre vacío", http.MethodPut, path, map[string]any{"nombre": "  "}, http.StatusBadRequest},
		{"GET id no numérico", http.MethodGet, "/api/personas/abc", nil, http.StatusBadRequest},
		{"GET id cero", http.MethodGet, "/api/personas/0", nil, http.StatusBadRequest},
		{"GET id negativo", http.MethodGet, "/api/personas/-1", nil, http.StatusBadRequest},
		{"PUT id no numérico", http.MethodPut, "/api/personas/abc", map[string]any{"nombre": "x"}, http.StatusBadRequest},
		{"DELETE id no numérico", http.MethodDelete, "/api/personas/abc", nil, http.StatusBadRequest},
		{"GET inexistente", http.MethodGet, "/api/personas/999999", nil, http.StatusNotFound},
		{"PUT inexistente", http.MethodPut, "/api/personas/999999", map[string]any{"nombre": "x"}, http.StatusNotFound},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			api.Do(ana, c.method, c.path, c.body).Expect(t, c.want)
		})
	}
	if got := getPersona(t, api, ana, p.ID); got != p {
		t.Errorf("la persona cambió tras peticiones inválidas: %+v", got)
	}
}

func TestPersonaDeleteInexistenteDevuelve404(t *testing.T) {
	api, ana, beto := setup(t)
	p := createPersona(t, api, ana, "Carla")
	api.Do(ana, http.MethodDelete, "/api/personas/999999", nil).Expect(t, http.StatusNotFound)
	expectDenied(t, api.Do(beto, http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil), "DELETE persona ajena")
	api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil).Expect(t, http.StatusNotFound)
}

func TestPersonaCamposLargosDevuelven400(t *testing.T) {
	api, ana, _ := setup(t)
	largo := strings.Repeat("x", 101)
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/personas", map[string]any{"nombre": largo}), "POST nombre de 101 caracteres")
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/personas",
		map[string]any{"nombre": "Carla", "entorno": strings.Repeat("x", 201)}), "POST entorno de 201 caracteres")
	p := createPersona(t, api, ana, "Carla")
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/personas/%d", p.ID),
		map[string]any{"alias": largo}), "PUT alias de 101 caracteres")
}

func TestPersonaIDFueraDeRangoDevuelve4xx(t *testing.T) {
	api, ana, _ := setup(t)
	expect4xx(t, api.Do(ana, http.MethodGet, "/api/personas/99999999999", nil), "GET id > int4")
}

// Al borrar una persona (borrado lógico) sus interacciones NO se borran: siguen
// accesibles por id, en el listado general y en la ruta anidada. Este test documenta el
// comportamiento actual (ver reporte); crear nuevas sí debería impedirse (test aparte).
func TestBorrarPersonaConservaSusInteracciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := createPersona(t, api, ana, "Carla")
	i := createInteraccion(t, api, ana, p.ID, "café con Carla")

	api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil).Expect(t, http.StatusNoContent)

	if got := getInteraccion(t, api, ana, i.ID); got.Eliminado || got.PersonaID != p.ID {
		t.Errorf("interacción tras borrar la persona = %+v", got)
	}
	if is := listInteracciones(t, api, ana, "/api/interacciones"); len(is) != 1 {
		t.Errorf("listado general tras borrar la persona = %+v", is)
	}
	if is := listInteracciones(t, api, ana, apitest.Path("/api/personas/%d/interacciones", p.ID)); len(is) != 1 {
		t.Errorf("listado anidado tras borrar la persona = %+v", is)
	}
}

func TestNoSeCreanInteraccionesEnPersonaBorrada(t *testing.T) {
	api, ana, _ := setup(t)
	p := createPersona(t, api, ana, "Carla")
	api.Do(ana, http.MethodDelete, apitest.Path("/api/personas/%d", p.ID), nil).Expect(t, http.StatusNoContent)
	expect4xx(t, api.Do(ana, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", p.ID),
		map[string]any{"interaccion": "hablando con un fantasma"}), "POST interacción en persona borrada")
}
