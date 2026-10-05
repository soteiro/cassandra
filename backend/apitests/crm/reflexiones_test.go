package crm

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestReflexionesCRUD(t *testing.T) {
	api, ana, _ := setup(t)

	// Tipo por defecto "reflexion"; el tipo se normaliza a minúsculas.
	r1 := createReflexion(t, api, ana, "  hoy aprendí algo  ", "")
	if r1.UserID != ana.ID || r1.Reflexion != "hoy aprendí algo" || r1.Tipo != "reflexion" ||
		r1.Eliminado || r1.FechaCreacion.IsZero() || r1.FechaActualizacion != nil {
		t.Errorf("reflexión creada = %+v", r1)
	}
	r2 := createReflexion(t, api, ana, "cumpleaños de Carla", " EVENTO ")
	if r2.Tipo != "evento" {
		t.Errorf("tipo = %q, se esperaba evento", r2.Tipo)
	}
	r3 := createReflexion(t, api, ana, "la playa de niño", "memoria")

	if got := getReflexion(t, api, ana, r1.ID); got.Reflexion != r1.Reflexion || got.Tipo != r1.Tipo || !got.FechaCreacion.Equal(r1.FechaCreacion) {
		t.Errorf("GET = %+v, se esperaba %+v", got, r1)
	}

	// Listado: más recientes primero.
	all := listReflexiones(t, api, ana, "")
	if len(all) != 3 || all[0].ID != r3.ID || all[2].ID != r1.ID {
		t.Errorf("listado = %+v", all)
	}

	// PUT: cambia texto y tipo, fija fecha_actualizacion.
	var upd models.ReflexionResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/reflexiones/%d", r1.ID),
		map[string]any{"reflexion": " aprendí mucho ", "tipo": "Memoria"}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Reflexion != "aprendí mucho" || upd.Tipo != "memoria" || upd.FechaActualizacion == nil ||
		upd.FechaActualizacion.Before(r1.FechaCreacion) {
		t.Errorf("PUT devolvió %+v", upd)
	}
	got := getReflexion(t, api, ana, r1.ID)
	if got.Reflexion != "aprendí mucho" || got.Tipo != "memoria" || got.FechaActualizacion == nil {
		t.Errorf("GET tras PUT = %+v", got)
	}
	// PUT parcial: solo el tipo.
	api.Do(ana, http.MethodPut, apitest.Path("/api/reflexiones/%d", r1.ID),
		map[string]any{"tipo": "evento"}).Expect(t, http.StatusOK)
	if got := getReflexion(t, api, ana, r1.ID); got.Reflexion != "aprendí mucho" || got.Tipo != "evento" {
		t.Errorf("PUT parcial = %+v", got)
	}

	// DELETE: 204, luego 404 y fuera del listado.
	path := apitest.Path("/api/reflexiones/%d", r2.ID)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, path, map[string]any{"reflexion": "zombi"}).Expect(t, http.StatusNotFound)
	if all := listReflexiones(t, api, ana, ""); len(all) != 2 {
		t.Errorf("listado tras borrar = %+v", all)
	}
}

func TestReflexionesFiltroTipo(t *testing.T) {
	api, ana, beto := setup(t)
	createReflexion(t, api, ana, "r1", "reflexion")
	createReflexion(t, api, ana, "r2", "reflexion")
	createReflexion(t, api, ana, "e1", "evento")
	createReflexion(t, api, ana, "m1", "memoria")
	borrada := createReflexion(t, api, ana, "e2", "evento")
	api.Do(ana, http.MethodDelete, apitest.Path("/api/reflexiones/%d", borrada.ID), nil).Expect(t, http.StatusNoContent)
	createReflexion(t, api, beto, "evento de Beto", "evento")

	cases := map[string]int{
		"":                  4,
		"?tipo=reflexion":   2,
		"?tipo=evento":      1,
		"?tipo=memoria":     1,
		"?tipo=EVENTO":      1, // se normaliza
		"?tipo=%20memoria":  1, // se recortan espacios
		"?tipo=":            4, // vacío = sin filtro
		"?tipo=inexistente": 0,
	}
	for q, want := range cases {
		t.Run(q, func(t *testing.T) {
			rs := listReflexiones(t, api, ana, q)
			if len(rs) != want {
				t.Errorf("GET /api/reflexiones%s: %d resultados, se esperaban %d: %+v", q, len(rs), want, rs)
			}
			for _, r := range rs {
				if r.UserID != ana.ID || r.Eliminado {
					t.Errorf("resultado inesperado: %+v", r)
				}
			}
		})
	}
}

func TestReflexionesValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	r := createReflexion(t, api, ana, "original", "memoria")
	path := apitest.Path("/api/reflexiones/%d", r.ID)

	cases := []struct {
		name, method, path string
		body               any
		want               int
	}{
		{"POST JSON roto", http.MethodPost, "/api/reflexiones", "{roto", http.StatusBadRequest},
		{"POST texto vacío", http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "  "}, http.StatusBadRequest},
		{"POST sin texto", http.MethodPost, "/api/reflexiones", map[string]any{"tipo": "evento"}, http.StatusBadRequest},
		{"POST tipo fuera del CHECK", http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "x", "tipo": "sueño"}, http.StatusBadRequest},
		{"POST tipo de tipo incorrecto", http.MethodPost, "/api/reflexiones", map[string]any{"reflexion": "x", "tipo": 3}, http.StatusBadRequest},
		{"PUT JSON roto", http.MethodPut, path, "{roto", http.StatusBadRequest},
		{"PUT texto vacío", http.MethodPut, path, map[string]any{"reflexion": " "}, http.StatusBadRequest},
		{"PUT tipo fuera del CHECK", http.MethodPut, path, map[string]any{"tipo": "sueño"}, http.StatusBadRequest},
		{"PUT tipo vacío", http.MethodPut, path, map[string]any{"tipo": ""}, http.StatusBadRequest},
		{"GET id no numérico", http.MethodGet, "/api/reflexiones/abc", nil, http.StatusBadRequest},
		{"PUT id no numérico", http.MethodPut, "/api/reflexiones/abc", map[string]any{"tipo": "evento"}, http.StatusBadRequest},
		{"DELETE id no numérico", http.MethodDelete, "/api/reflexiones/abc", nil, http.StatusBadRequest},
		{"GET id negativo", http.MethodGet, "/api/reflexiones/-5", nil, http.StatusBadRequest},
		{"GET inexistente", http.MethodGet, "/api/reflexiones/999999", nil, http.StatusNotFound},
		{"PUT inexistente", http.MethodPut, "/api/reflexiones/999999", map[string]any{"tipo": "evento"}, http.StatusNotFound},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			api.Do(ana, c.method, c.path, c.body).Expect(t, c.want)
		})
	}
	if got := getReflexion(t, api, ana, r.ID); got.Reflexion != "original" || got.Tipo != "memoria" || got.FechaActualizacion != nil {
		t.Errorf("la reflexión cambió tras peticiones inválidas: %+v", got)
	}
	if rs := listReflexiones(t, api, ana, ""); len(rs) != 1 {
		t.Errorf("las peticiones inválidas crearon reflexiones: %+v", rs)
	}
}

func TestReflexionDeleteInexistenteDevuelve404(t *testing.T) {
	bug(t, "DELETE de reflexión inexistente, ajena o ya borrada responde 500 en vez de 404")
	api, ana, beto := setup(t)
	r := createReflexion(t, api, ana, "x", "")
	path := apitest.Path("/api/reflexiones/%d", r.ID)
	api.Do(ana, http.MethodDelete, "/api/reflexiones/999999", nil).Expect(t, http.StatusNotFound)
	expectDenied(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE reflexión ajena")
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNotFound)
}
