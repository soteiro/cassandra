package proyectos

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestNotaCRUD(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	otro := crearProyecto(t, api, ana, "Otro", nil)

	n1 := crearNota(t, api, ana, p.ID, "primera nota")
	if n1.UserID != ana.ID || n1.TareaID != nil || n1.Eliminado {
		t.Errorf("nota creada: %+v", n1)
	}
	var n2 models.NotasProyectoResponse
	api.Do(ana, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": otro.ID, "nota": "  segunda nota  "}).
		Expect(t, http.StatusCreated).JSON(t, &n2)
	if n2.Nota != "segunda nota" || n2.ProyectoID != otro.ID {
		t.Errorf("POST /api/notas: %+v", n2)
	}

	if got := getNota(t, api, ana, n1.ID); got.Nota != "primera nota" || got.ProyectoID != p.ID {
		t.Errorf("GET nota: %+v", got)
	}
	expectIDs(t, "GET /api/notas", notaIDs(listarNotas(t, api, ana, "/api/notas")), n1.ID, n2.ID)
	expectIDs(t, "notas del proyecto", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/proyects/%d/notas", p.ID))), n1.ID)
	expectIDs(t, "notas del otro proyecto", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/proyects/%d/notas", otro.ID))), n2.ID)

	var upd models.NotasProyectoResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n1.ID), map[string]any{"nota": "  editada  "}).
		Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Nota != "editada" {
		t.Errorf("respuesta del PUT: %+v", upd)
	}
	if got := getNota(t, api, ana, n1.ID); got.Nota != "editada" || got.ProyectoID != p.ID {
		t.Errorf("GET tras PUT: %+v", got)
	}
	// PUT vacío no cambia nada.
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n1.ID), map[string]any{}).Expect(t, http.StatusOK)
	if got := getNota(t, api, ana, n1.ID); got.Nota != "editada" {
		t.Errorf("PUT vacío cambió la nota: %+v", got)
	}

	path := apitest.Path("/api/notas/%d", n1.ID)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, path, nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, path, map[string]any{"nota": "zombi"}).Expect(t, http.StatusNotFound)
	expectIDs(t, "GET /api/notas tras DELETE", notaIDs(listarNotas(t, api, ana, "/api/notas")), n2.ID)
	expectIDs(t, "notas del proyecto tras DELETE", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/proyects/%d/notas", p.ID))))

	// Borrado lógico también vía PUT eliminado=true.
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n2.ID), map[string]any{"eliminado": true}).Expect(t, http.StatusOK)
	api.Do(ana, http.MethodGet, apitest.Path("/api/notas/%d", n2.ID), nil).Expect(t, http.StatusNotFound)

	// Listados vacíos devuelven [] y no null.
	res := api.Do(ana, http.MethodGet, "/api/notas", nil).Expect(t, http.StatusOK)
	if string(res.Body) != "[]\n" && string(res.Body) != "[]" {
		t.Errorf("GET /api/notas vacío = %s, se esperaba []", res.Body)
	}
}

func TestNotaValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	n := crearNota(t, api, ana, p.ID, "valida")
	path := apitest.Path("/api/notas/%d", n.ID)

	api.Do(ana, http.MethodPost, "/api/notas", "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/notas", p.ID), "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, path, "{json roto").Expect(t, http.StatusBadRequest)

	for _, c := range []struct {
		path string
		body map[string]any
	}{
		{apitest.Path("/api/proyects/%d/notas", p.ID), map[string]any{"nota": ""}},
		{apitest.Path("/api/proyects/%d/notas", p.ID), map[string]any{"nota": "   "}},
		{apitest.Path("/api/proyects/%d/notas", p.ID), map[string]any{}},
		{"/api/notas", map[string]any{"nota": "sin proyecto"}},
		{"/api/notas", map[string]any{"nota": "proyecto cero", "proyecto_id": 0}},
		{"/api/proyects/abc/notas", map[string]any{"nota": "proyecto no numérico"}},
		{"/api/tareas/abc/notas", map[string]any{"nota": "tarea no numérica"}},
		{apitest.Path("/api/tareas/%d/notas", inexistente), map[string]any{"nota": "tarea inexistente"}},
	} {
		if res := api.Do(ana, http.MethodPost, c.path, c.body); res.Status != http.StatusBadRequest {
			t.Errorf("POST %s %v: código %d, se esperaba 400; cuerpo: %s", c.path, c.body, res.Status, res.Body)
		}
	}

	api.Do(ana, http.MethodPut, path, map[string]any{"nota": "   "}).Expect(t, http.StatusBadRequest)

	for _, id := range []string{"abc", "0", "-1"} {
		base := "/api/notas/" + id
		expect4xx(t, api.Do(ana, http.MethodGet, base, nil), "GET "+base)
		expect4xx(t, api.Do(ana, http.MethodPut, base, map[string]any{"nota": "x"}), "PUT "+base)
		expect4xx(t, api.Do(ana, http.MethodDelete, base, nil), "DELETE "+base)
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/proyects/"+id+"/notas", nil), "GET /api/proyects/"+id+"/notas")
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/tareas/"+id+"/notas", nil), "GET /api/tareas/"+id+"/notas")
	}
	api.Do(ana, http.MethodGet, apitest.Path("/api/notas/%d", inexistente), nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", inexistente), map[string]any{"nota": "x"}).Expect(t, http.StatusNotFound)

	if got := getNota(t, api, ana, n.ID); got.Nota != "valida" {
		t.Errorf("nota modificada por peticiones inválidas: %+v", got)
	}
	expectIDs(t, "GET /api/notas", notaIDs(listarNotas(t, api, ana, "/api/notas")), n.ID)
}

func TestNotaInexistenteOAjenaDeleteDevuelve404(t *testing.T) {
	bug(t, "DELETE /api/notas/{id} inexistente o ajena devuelve 500 en vez de 404")
	api, ana, beto := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	n := crearNota(t, api, ana, p.ID, "de Ana")
	expectNoEncontrado(t, api.Do(ana, http.MethodDelete, apitest.Path("/api/notas/%d", inexistente), nil), "DELETE inexistente")
	expectNoEncontrado(t, api.Do(beto, http.MethodDelete, apitest.Path("/api/notas/%d", n.ID), nil), "DELETE ajena")
}

func TestNotaProyectoInexistente(t *testing.T) {
	bug(t, "POST de nota con proyecto inexistente produce 500 (violación de FK) en vez de 4xx")
	api, ana, _ := setup(t)
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": inexistente, "nota": "x"}),
		"POST /api/notas proyecto inexistente")
	expect4xx(t, api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/notas", inexistente), map[string]any{"nota": "x"}),
		"POST /api/proyects/{inexistente}/notas")
}

func TestNotaTareaInexistente(t *testing.T) {
	bug(t, "nota con tarea_id inexistente (POST o PUT) produce 500 (violación de FK) en vez de 4xx")
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	n := crearNota(t, api, ana, p.ID, "nota")
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": p.ID, "tarea_id": inexistente, "nota": "x"}),
		"POST tarea_id inexistente")
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n.ID), map[string]any{"tarea_id": inexistente}),
		"PUT tarea_id inexistente")
}

func TestNotasLigadasATarea(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "Arreglar grifo", nil)
	otra := crearTarea(t, api, ana, p.ID, "Pintar", nil)
	tareaNotas := apitest.Path("/api/tareas/%d/notas", tr.ID)

	// Crear por la ruta de la tarea resuelve el proyecto.
	var n1 models.NotasProyectoResponse
	api.Do(ana, http.MethodPost, tareaNotas, map[string]any{"nota": "cambiar empaquetadura"}).Expect(t, http.StatusCreated).JSON(t, &n1)
	if n1.ProyectoID != p.ID || n1.TareaID == nil || *n1.TareaID != tr.ID || str(n1.TareaNombre) != "Arreglar grifo" {
		t.Errorf("POST /api/tareas/{id}/notas: %+v (tarea_nombre=%s)", n1, str(n1.TareaNombre))
	}
	// Crear con tarea_id en el cuerpo.
	var n2 models.NotasProyectoResponse
	api.Do(ana, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": p.ID, "tarea_id": tr.ID, "nota": "comprar llave"}).
		Expect(t, http.StatusCreated).JSON(t, &n2)
	if n2.TareaID == nil || *n2.TareaID != tr.ID {
		t.Errorf("POST /api/notas con tarea_id: %+v", n2)
	}
	suelta := crearNota(t, api, ana, p.ID, "nota suelta")

	expectIDs(t, "notas de la tarea", notaIDs(listarNotas(t, api, ana, tareaNotas)), n1.ID, n2.ID)
	expectIDs(t, "notas del proyecto", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/proyects/%d/notas", p.ID))), n1.ID, n2.ID, suelta.ID)
	if got := getNota(t, api, ana, n1.ID); got.TareaID == nil || *got.TareaID != tr.ID || str(got.TareaNombre) != "Arreglar grifo" {
		t.Errorf("GET nota ligada: %+v", got)
	}

	// Vincular la suelta por PUT.
	var upd models.NotasProyectoResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", suelta.ID), map[string]any{"tarea_id": otra.ID}).
		Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.TareaID == nil || *upd.TareaID != otra.ID || str(upd.TareaNombre) != "Pintar" {
		t.Errorf("PUT tarea_id: %+v", upd)
	}
	expectIDs(t, "notas de la otra tarea", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/tareas/%d/notas", otra.ID))), suelta.ID)

	// Desvincular con clear_tarea_id: la nota sigue existiendo en el proyecto.
	upd = models.NotasProyectoResponse{}
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n1.ID), map[string]any{"clear_tarea_id": true}).
		Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.TareaID != nil || upd.TareaNombre != nil {
		t.Errorf("PUT clear_tarea_id: tarea_id=%s tarea_nombre=%s", idStr(upd.TareaID), str(upd.TareaNombre))
	}
	if got := getNota(t, api, ana, n1.ID); got.TareaID != nil || got.Nota != "cambiar empaquetadura" {
		t.Errorf("GET tras desvincular: %+v", got)
	}
	expectIDs(t, "notas de la tarea tras desvincular", notaIDs(listarNotas(t, api, ana, tareaNotas)), n2.ID)
	expectIDs(t, "notas del proyecto tras desvincular", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/proyects/%d/notas", p.ID))),
		n1.ID, n2.ID, suelta.ID)

	// Un PUT sin tarea_id ni clear_tarea_id conserva el vínculo.
	api.Do(ana, http.MethodPut, apitest.Path("/api/notas/%d", n2.ID), map[string]any{"nota": "comprar llave inglesa"}).Expect(t, http.StatusOK)
	if got := getNota(t, api, ana, n2.ID); got.TareaID == nil || *got.TareaID != tr.ID {
		t.Errorf("PUT de texto perdió el vínculo: %+v", got)
	}
}
