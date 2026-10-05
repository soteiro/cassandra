package proyectos

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestLogCRUD(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	otro := crearProyecto(t, api, ana, "Otro", nil)

	var l models.ProjectLog
	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/logs", p.ID),
		map[string]any{"titulo": "  Sesión 1  ", "contenido_raw": "hice cosas"}).Expect(t, http.StatusCreated).JSON(t, &l)
	if l.Titulo != "Sesión 1" || l.ContenidoRaw != "hice cosas" || l.ProyectoID != p.ID || l.UserID != ana.ID || l.Eliminado {
		t.Errorf("log creado: %+v", l)
	}
	// proyecto de la URL manda sobre el del cuerpo.
	var l2 models.ProjectLog
	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/logs", p.ID),
		map[string]any{"proyecto_id": otro.ID, "contenido_raw": "sin título"}).Expect(t, http.StatusCreated).JSON(t, &l2)
	if l2.ProyectoID != p.ID {
		t.Errorf("proyecto_id del log = %d, se esperaba el de la URL (%d)", l2.ProyectoID, p.ID)
	}

	if got := getLog(t, api, ana, l.ID); got.Titulo != "Sesión 1" || got.ContenidoRaw != "hice cosas" {
		t.Errorf("GET log: %+v", got)
	}
	expectIDs(t, "logs del proyecto", logIDs(listarLogs(t, api, ana, p.ID)), l.ID, l2.ID)
	expectIDs(t, "logs del otro proyecto", logIDs(listarLogs(t, api, ana, otro.ID)))

	path := apitest.Path("/api/logs/%d", l.ID)
	var upd models.ProjectLog
	api.Do(ana, http.MethodPut, path, map[string]any{"titulo": " Sesión 1 (rev) "}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Titulo != "Sesión 1 (rev)" || upd.ContenidoRaw != "hice cosas" {
		t.Errorf("respuesta del PUT: %+v", upd)
	}
	api.Do(ana, http.MethodPut, path, map[string]any{"contenido_raw": "hice más cosas"}).Expect(t, http.StatusOK)
	if got := getLog(t, api, ana, l.ID); got.Titulo != "Sesión 1 (rev)" || got.ContenidoRaw != "hice más cosas" {
		t.Errorf("GET tras PUT: %+v", got)
	}

	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusNotFound)
	// PUT tras DELETE: ver TestLogInexistenteOAjenoDevuelve404.
	expectIDs(t, "logs tras DELETE", logIDs(listarLogs(t, api, ana, p.ID)), l2.ID)

	// Listado vacío: [] y no null.
	res := api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/logs", otro.ID), nil).Expect(t, http.StatusOK)
	if string(res.Body) != "[]\n" && string(res.Body) != "[]" {
		t.Errorf("logs vacíos = %s, se esperaba []", res.Body)
	}
}

func TestLogValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	l := crearLog(t, api, ana, p.ID, "titulo", "contenido")
	path := apitest.Path("/api/logs/%d", l.ID)
	logsPath := apitest.Path("/api/proyects/%d/logs", p.ID)

	api.Do(ana, http.MethodPost, logsPath, "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, path, "{json roto").Expect(t, http.StatusBadRequest)

	for _, c := range []struct {
		path string
		body map[string]any
	}{
		{logsPath, map[string]any{"titulo": "x"}},
		{logsPath, map[string]any{"contenido_raw": ""}},
		{logsPath, map[string]any{"contenido_raw": "   \n "}},
		{"/api/proyects/abc/logs", map[string]any{"contenido_raw": "x"}},
		{"/api/proyects/0/logs", map[string]any{"contenido_raw": "x"}},
	} {
		if res := api.Do(ana, http.MethodPost, c.path, c.body); res.Status != http.StatusBadRequest {
			t.Errorf("POST %s %v: código %d, se esperaba 400; cuerpo: %s", c.path, c.body, res.Status, res.Body)
		}
	}

	for _, id := range []string{"abc", "0", "-1"} {
		base := "/api/logs/" + id
		expect4xx(t, api.Do(ana, http.MethodGet, base, nil), "GET "+base)
		expect4xx(t, api.Do(ana, http.MethodPut, base, map[string]any{"titulo": "x"}), "PUT "+base)
		expect4xx(t, api.Do(ana, http.MethodDelete, base, nil), "DELETE "+base)
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/proyects/"+id+"/logs", nil), "GET /api/proyects/"+id+"/logs")
	}
	api.Do(ana, http.MethodGet, apitest.Path("/api/logs/%d", inexistente), nil).Expect(t, http.StatusNotFound)

	if got := getLog(t, api, ana, l.ID); got.ContenidoRaw != "contenido" || got.Titulo != "titulo" {
		t.Errorf("log modificado por peticiones inválidas: %+v", got)
	}
	expectIDs(t, "logs del proyecto", logIDs(listarLogs(t, api, ana, p.ID)), l.ID)
}

func TestLogContenidoVacioEnUpdate(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	l := crearLog(t, api, ana, p.ID, "titulo", "contenido")
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/logs/%d", l.ID), map[string]any{"contenido_raw": "  "}),
		"PUT contenido_raw vacío")
	if got := getLog(t, api, ana, l.ID); got.ContenidoRaw != "contenido" {
		t.Errorf("contenido_raw = %q", got.ContenidoRaw)
	}
}

func TestLogInexistenteOAjenoDevuelve404(t *testing.T) {
	api, ana, beto := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	l := crearLog(t, api, ana, p.ID, "titulo", "contenido")
	borrado := crearLog(t, api, ana, p.ID, "borrado", "contenido")
	api.Do(ana, http.MethodDelete, apitest.Path("/api/logs/%d", borrado.ID), nil).Expect(t, http.StatusNoContent)
	for _, c := range []struct {
		u  *apitest.User
		id int
	}{{ana, inexistente}, {ana, borrado.ID}, {beto, l.ID}} {
		path := apitest.Path("/api/logs/%d", c.id)
		expectNoEncontrado(t, api.Do(c.u, http.MethodPut, path, map[string]any{"titulo": "x"}), "PUT "+path)
		expectNoEncontrado(t, api.Do(c.u, http.MethodDelete, path, nil), "DELETE "+path)
	}
}

func TestLogProyectoInexistente(t *testing.T) {
	api, ana, _ := setup(t)
	expect4xx(t, api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/logs", inexistente), map[string]any{"contenido_raw": "x"}),
		"POST log en proyecto inexistente")
}
