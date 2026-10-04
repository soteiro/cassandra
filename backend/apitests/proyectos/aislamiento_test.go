package proyectos

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
)

// ---------- proyectos ----------

func TestAislamientoProyectos(t *testing.T) {
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Secreto de Ana", nil)
	subA := crearProyecto(t, api, ana, "Subsecreto de Ana", map[string]any{"proyecto_padre_id": pA.ID})
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)

	expectIDs(t, "listado de Beto", proyectoIDs(listarProyectos(t, api, beto)), pB.ID)
	expectIDs(t, "listado de Ana", proyectoIDs(listarProyectos(t, api, ana)), pA.ID, subA.ID)

	pathA := apitest.Path("/api/proyects/%d", pA.ID)
	expectDenegado(t, api.Do(beto, http.MethodGet, pathA, nil), "GET proyecto ajeno", pA.Nombre, pA.PorQue)
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"nombre": "Hackeado", "estado": "Cancelado"}),
		"PUT proyecto ajeno", pA.Nombre)
	expectDenegado(t, api.Do(beto, http.MethodDelete, pathA, nil), "DELETE proyecto ajeno")

	// Subproyectos de un padre ajeno: vacío o error, nunca los de Ana.
	res := api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/subproyectos", pA.ID), nil)
	expectSinFuga(t, res, "GET subproyectos de proyecto ajeno", subA.Nombre)

	// El proyecto de Ana sigue intacto.
	got := getProyecto(t, api, ana, pA.ID)
	if got.Nombre != pA.Nombre || got.Estado != pA.Estado || got.SubproyectosCount != 1 {
		t.Errorf("el proyecto de Ana cambió: %+v", got)
	}
	getProyecto(t, api, ana, subA.ID)
}

func TestAislamientoSubproyectoConPadreAjeno(t *testing.T) {
	bug(t, "se puede crear un subproyecto colgando de un proyecto ajeno (proyecto_padre_id sin validar dueño)")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Padre de Ana", nil)

	body := proyectoBody("Intruso de Beto")
	body["proyecto_padre_id"] = pA.ID
	res := api.Do(beto, http.MethodPost, "/api/proyects", body)
	expect4xx(t, res, "POST subproyecto con padre ajeno")
	expectSinFuga(t, res, "POST subproyecto con padre ajeno", pA.Nombre)

	for _, p := range listarProyectos(t, api, beto) {
		if p.NombrePadre != nil {
			t.Errorf("Beto ve el nombre del proyecto padre ajeno: %q", *p.NombrePadre)
		}
	}
	if got := getProyecto(t, api, ana, pA.ID); got.SubproyectosCount != 0 {
		t.Errorf("subproyectos_count del proyecto de Ana = %d, se esperaba 0", got.SubproyectosCount)
	}
}

func TestAislamientoMoverProyectoBajoPadreAjeno(t *testing.T) {
	bug(t, "PUT de un proyecto propio acepta proyecto_padre_id de un proyecto ajeno")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Padre de Ana", nil)
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)

	res := api.Do(beto, http.MethodPut, apitest.Path("/api/proyects/%d", pB.ID), map[string]any{"proyecto_padre_id": pA.ID})
	expect4xx(t, res, "PUT proyecto_padre_id ajeno")

	got := getProyecto(t, api, beto, pB.ID)
	if got.ProyectoPadreID != nil || got.NombrePadre != nil {
		t.Errorf("el proyecto de Beto quedó colgando del de Ana: padre=%s nombre_padre=%s", idStr(got.ProyectoPadreID), str(got.NombrePadre))
	}
	if got := getProyecto(t, api, ana, pA.ID); got.SubproyectosCount != 0 {
		t.Errorf("subproyectos_count del proyecto de Ana = %d, se esperaba 0", got.SubproyectosCount)
	}
}

func TestAislamientoNombreDeProyectoNoColisionaEntreUsuarios(t *testing.T) {
	bug(t, "proyectos.nombre es UNIQUE global: otro usuario no puede usar el mismo nombre (500) y eso revela que existe")
	api, ana, beto := setup(t)
	crearProyecto(t, api, ana, "Mudanza", nil)
	api.Do(beto, http.MethodPost, "/api/proyects", proyectoBody("Mudanza")).Expect(t, http.StatusCreated)
}

// ---------- tareas ----------

func TestAislamientoTareas(t *testing.T) {
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	tA := crearTarea(t, api, ana, pA.ID, "Tarea secreta de Ana", nil)
	subA := crearTarea(t, api, ana, pA.ID, "Subtarea secreta de Ana", map[string]any{"tarea_padre_id": tA.ID})
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)
	tB := crearTarea(t, api, beto, pB.ID, "Tarea de Beto", nil)

	expectIDs(t, "GET /api/tareas de Beto", tareaIDs(listarTareas(t, api, beto, "")), tB.ID)
	expectIDs(t, "GET /api/tareas?estado=Abierto de Beto", tareaIDs(listarTareas(t, api, beto, "?estado=Abierto")), tB.ID)
	expectIDs(t, "GET /api/tareas de Ana", tareaIDs(listarTareas(t, api, ana, "")), tA.ID, subA.ID)

	pathA := apitest.Path("/api/tareas/%d", tA.ID)
	expectDenegado(t, api.Do(beto, http.MethodGet, pathA, nil), "GET tarea ajena", tA.Nombre, subA.Nombre)
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"nombre": "Hackeada", "estado": "Terminado"}),
		"PUT tarea ajena", tA.Nombre)
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"eliminado": true}), "PUT eliminado=true en tarea ajena")
	expectDenegado(t, api.Do(beto, http.MethodDelete, pathA, nil), "DELETE tarea ajena")
	expectDenegado(t, api.Do(beto, http.MethodDelete, apitest.Path("/api/tareas/%d", subA.ID), nil), "DELETE subtarea ajena")

	// Tareas por proyecto ajeno: vacío o error, nunca las de Ana.
	res := api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/tareas", pA.ID), nil)
	expectSinFuga(t, res, "GET tareas de proyecto ajeno", tA.Nombre, subA.Nombre)

	got := getTarea(t, api, ana, tA.ID)
	if got.Nombre != tA.Nombre || str(got.Estado) != "Abierto" || got.FechaTerminado != nil || len(got.Subtareas) != 1 {
		t.Errorf("la tarea de Ana cambió: %+v", got)
	}
	getTarea(t, api, ana, subA.ID)
}

func TestAislamientoCrearTareaEnProyectoAjeno(t *testing.T) {
	bug(t, "POST /api/tareas acepta proyect_id de un proyecto ajeno y luego filtra su nombre en proyecto_nombre")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto secreto de Ana", nil)

	res := api.Do(beto, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Intrusa", "proyect_id": pA.ID})
	expect4xx(t, res, "POST tarea en proyecto ajeno")

	expectSinFuga(t, api.Do(beto, http.MethodGet, "/api/tareas", nil), "GET /api/tareas de Beto", pA.Nombre)
	if n := len(listarTareas(t, api, beto, "")); n != 0 {
		t.Errorf("Beto tiene %d tareas, se esperaban 0", n)
	}
}

func TestAislamientoSubtareaConPadreAjeno(t *testing.T) {
	bug(t, "POST /api/tareas acepta tarea_padre_id de una tarea ajena")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	tA := crearTarea(t, api, ana, pA.ID, "Tarea de Ana", nil)
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)

	res := api.Do(beto, http.MethodPost, "/api/tareas",
		map[string]any{"nombre": "Subtarea intrusa", "proyect_id": pB.ID, "tarea_padre_id": tA.ID})
	expect4xx(t, res, "POST subtarea con padre ajeno")
}

func TestAislamientoReasignarTareaAPadreAjeno(t *testing.T) {
	bug(t, "PUT /api/tareas/{id} acepta tarea_padre_id de una tarea ajena")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	tA := crearTarea(t, api, ana, pA.ID, "Tarea de Ana", nil)
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)
	tB := crearTarea(t, api, beto, pB.ID, "Tarea de Beto", nil)

	res := api.Do(beto, http.MethodPut, apitest.Path("/api/tareas/%d", tB.ID), map[string]any{"tarea_padre_id": tA.ID})
	expect4xx(t, res, "PUT tarea_padre_id ajeno")
	if got := getTarea(t, api, beto, tB.ID); got.TareaPadreID != nil {
		t.Errorf("la tarea de Beto quedó como subtarea de la de Ana (tarea_padre_id=%d)", *got.TareaPadreID)
	}
}

// ---------- notas ----------

func TestAislamientoNotas(t *testing.T) {
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	tA := crearTarea(t, api, ana, pA.ID, "Tarea de Ana", nil)
	var nA struct{ ID int }
	api.Do(ana, http.MethodPost, apitest.Path("/api/tareas/%d/notas", tA.ID), map[string]any{"nota": "nota secreta de Ana"}).
		Expect(t, http.StatusCreated).JSON(t, &nA)
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)
	nB := crearNota(t, api, beto, pB.ID, "nota de Beto")

	expectIDs(t, "GET /api/notas de Beto", notaIDs(listarNotas(t, api, beto, "/api/notas")), nB.ID)
	expectIDs(t, "GET /api/notas de Ana", notaIDs(listarNotas(t, api, ana, "/api/notas")), nA.ID)

	pathA := apitest.Path("/api/notas/%d", nA.ID)
	expectDenegado(t, api.Do(beto, http.MethodGet, pathA, nil), "GET nota ajena", "nota secreta de Ana")
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"nota": "hackeada"}), "PUT nota ajena", "nota secreta de Ana")
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"clear_tarea_id": true}), "PUT desvincular nota ajena")
	expectDenegado(t, api.Do(beto, http.MethodDelete, pathA, nil), "DELETE nota ajena")

	expectSinFuga(t, api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/notas", pA.ID), nil),
		"GET notas de proyecto ajeno", "nota secreta de Ana")
	expectSinFuga(t, api.Do(beto, http.MethodGet, apitest.Path("/api/tareas/%d/notas", tA.ID), nil),
		"GET notas de tarea ajena", "nota secreta de Ana")

	// Crear por la tarea ajena sin proyecto: no se resuelve el proyecto de Ana.
	res := api.Do(beto, http.MethodPost, apitest.Path("/api/tareas/%d/notas", tA.ID), map[string]any{"nota": "intrusa"})
	expectDenegado(t, res, "POST nota en tarea ajena (sin proyecto_id)", tA.Nombre)

	got := getNota(t, api, ana, nA.ID)
	if got.Nota != "nota secreta de Ana" || got.TareaID == nil || *got.TareaID != tA.ID {
		t.Errorf("la nota de Ana cambió: %+v", got)
	}
	expectIDs(t, "notas de la tarea de Ana", notaIDs(listarNotas(t, api, ana, apitest.Path("/api/tareas/%d/notas", tA.ID))), nA.ID)
}

func TestAislamientoCrearNotaEnProyectoAjeno(t *testing.T) {
	bug(t, "POST de notas acepta un proyecto ajeno (por URL o por proyecto_id en el cuerpo)")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)

	expect4xx(t, api.Do(beto, http.MethodPost, apitest.Path("/api/proyects/%d/notas", pA.ID), map[string]any{"nota": "intrusa 1"}),
		"POST /api/proyects/{ajeno}/notas")
	expect4xx(t, api.Do(beto, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": pA.ID, "nota": "intrusa 2"}),
		"POST /api/notas con proyecto_id ajeno")
}

func TestAislamientoNotaVinculadaATareaAjena(t *testing.T) {
	bug(t, "las notas aceptan tarea_id de una tarea ajena (creación y PUT) y devuelven su tarea_nombre")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	tA := crearTarea(t, api, ana, pA.ID, "Tarea secreta de Ana", nil)
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)
	nB := crearNota(t, api, beto, pB.ID, "nota de Beto")

	res := api.Do(beto, http.MethodPost, "/api/notas", map[string]any{"proyecto_id": pB.ID, "tarea_id": tA.ID, "nota": "x"})
	expect4xx(t, res, "POST nota con tarea_id ajeno")
	expectSinFuga(t, res, "POST nota con tarea_id ajeno", tA.Nombre)

	res = api.Do(beto, http.MethodPost, apitest.Path("/api/tareas/%d/notas", tA.ID), map[string]any{"proyecto_id": pB.ID, "nota": "y"})
	expect4xx(t, res, "POST /api/tareas/{ajena}/notas con proyecto_id propio")
	expectSinFuga(t, res, "POST /api/tareas/{ajena}/notas con proyecto_id propio", tA.Nombre)

	res = api.Do(beto, http.MethodPut, apitest.Path("/api/notas/%d", nB.ID), map[string]any{"tarea_id": tA.ID})
	expect4xx(t, res, "PUT nota con tarea_id ajeno")
	expectSinFuga(t, res, "PUT nota con tarea_id ajeno", tA.Nombre)

	expectSinFuga(t, api.Do(beto, http.MethodGet, "/api/notas", nil), "GET /api/notas de Beto", tA.Nombre)
}

// ---------- logs ----------

func TestAislamientoLogs(t *testing.T) {
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	lA := crearLog(t, api, ana, pA.ID, "Log de Ana", "contenido secreto de Ana")
	pB := crearProyecto(t, api, beto, "Proyecto de Beto", nil)
	lB := crearLog(t, api, beto, pB.ID, "Log de Beto", "contenido de Beto")

	expectIDs(t, "logs del proyecto de Beto", logIDs(listarLogs(t, api, beto, pB.ID)), lB.ID)

	pathA := apitest.Path("/api/logs/%d", lA.ID)
	expectDenegado(t, api.Do(beto, http.MethodGet, pathA, nil), "GET log ajeno", "contenido secreto de Ana")
	expectDenegado(t, api.Do(beto, http.MethodPut, pathA, map[string]any{"contenido_raw": "hackeado"}), "PUT log ajeno", "contenido secreto de Ana")
	expectDenegado(t, api.Do(beto, http.MethodDelete, pathA, nil), "DELETE log ajeno")
	expectSinFuga(t, api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/logs", pA.ID), nil),
		"GET logs de proyecto ajeno", "contenido secreto de Ana")

	got := getLog(t, api, ana, lA.ID)
	if got.ContenidoRaw != "contenido secreto de Ana" || got.Titulo != "Log de Ana" {
		t.Errorf("el log de Ana cambió: %+v", got)
	}
	expectIDs(t, "logs del proyecto de Ana", logIDs(listarLogs(t, api, ana, pA.ID)), lA.ID)
}

func TestAislamientoCrearLogEnProyectoAjeno(t *testing.T) {
	bug(t, "POST /api/proyects/{id}/logs acepta un proyecto ajeno")
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "Proyecto de Ana", nil)
	expect4xx(t, api.Do(beto, http.MethodPost, apitest.Path("/api/proyects/%d/logs", pA.ID), map[string]any{"contenido_raw": "intruso"}),
		"POST log en proyecto ajeno")
}

// ---------- autenticación ----------

func TestSinToken401(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "Tarea", nil)
	n := crearNota(t, api, ana, p.ID, "nota")
	l := crearLog(t, api, ana, p.ID, "log", "contenido")

	rutas := []struct {
		method, path string
		body         any
	}{
		{http.MethodPost, "/api/proyects", proyectoBody("Sin token")},
		{http.MethodGet, "/api/proyects", nil},
		{http.MethodGet, apitest.Path("/api/proyects/%d", p.ID), nil},
		{http.MethodPut, apitest.Path("/api/proyects/%d", p.ID), map[string]any{"nombre": "x"}},
		{http.MethodDelete, apitest.Path("/api/proyects/%d", p.ID), nil},
		{http.MethodGet, apitest.Path("/api/proyects/%d/subproyectos", p.ID), nil},
		{http.MethodPost, "/api/tareas", map[string]any{"nombre": "x", "proyect_id": p.ID}},
		{http.MethodGet, "/api/tareas", nil},
		{http.MethodGet, apitest.Path("/api/tareas/%d", tr.ID), nil},
		{http.MethodPut, apitest.Path("/api/tareas/%d", tr.ID), map[string]any{"nombre": "x"}},
		{http.MethodDelete, apitest.Path("/api/tareas/%d", tr.ID), nil},
		{http.MethodGet, apitest.Path("/api/proyects/%d/tareas", p.ID), nil},
		{http.MethodPost, apitest.Path("/api/proyects/%d/notas", p.ID), map[string]any{"nota": "x"}},
		{http.MethodGet, apitest.Path("/api/proyects/%d/notas", p.ID), nil},
		{http.MethodPost, apitest.Path("/api/tareas/%d/notas", tr.ID), map[string]any{"nota": "x"}},
		{http.MethodGet, apitest.Path("/api/tareas/%d/notas", tr.ID), nil},
		{http.MethodPost, "/api/notas", map[string]any{"nota": "x", "proyecto_id": p.ID}},
		{http.MethodGet, "/api/notas", nil},
		{http.MethodGet, apitest.Path("/api/notas/%d", n.ID), nil},
		{http.MethodPut, apitest.Path("/api/notas/%d", n.ID), map[string]any{"nota": "x"}},
		{http.MethodDelete, apitest.Path("/api/notas/%d", n.ID), nil},
		{http.MethodPost, apitest.Path("/api/proyects/%d/logs", p.ID), map[string]any{"contenido_raw": "x"}},
		{http.MethodGet, apitest.Path("/api/proyects/%d/logs", p.ID), nil},
		{http.MethodGet, apitest.Path("/api/logs/%d", l.ID), nil},
		{http.MethodPut, apitest.Path("/api/logs/%d", l.ID), map[string]any{"titulo": "x"}},
		{http.MethodDelete, apitest.Path("/api/logs/%d", l.ID), nil},
	}
	for _, r := range rutas {
		if res := api.Do(nil, r.method, r.path, r.body); res.Status != http.StatusUnauthorized {
			t.Errorf("%s %s sin token: código %d, se esperaba 401", r.method, r.path, res.Status)
		}
	}

	// Nada cambió.
	if got := getProyecto(t, api, ana, p.ID); got.Nombre != "Proyecto" {
		t.Errorf("proyecto modificado sin token: %+v", got)
	}
	getTarea(t, api, ana, tr.ID)
	getNota(t, api, ana, n.ID)
	getLog(t, api, ana, l.ID)
	if n := len(listarProyectos(t, api, ana)); n != 1 {
		t.Errorf("Ana tiene %d proyectos, se esperaba 1", n)
	}
}
