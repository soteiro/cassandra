package proyectos

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestTareaCRUD(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)

	var tr models.TareaResponse
	api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "  Comprar pintura  ", "descripcion": " blanca ", "comentario": " 2 litros ", "proyect_id": p.ID,
	}).Expect(t, http.StatusCreated).JSON(t, &tr)
	if tr.Nombre != "Comprar pintura" || tr.Descripcion != "blanca" || tr.Comentario != "2 litros" {
		t.Errorf("create no recorta espacios: %+v", tr)
	}
	if str(tr.Estado) != "Abierto" || tr.Prioridad != "normal" || tr.ProyectID != p.ID || tr.UserID != ana.ID ||
		tr.FechaTerminado != nil || tr.TareaPadreID != nil {
		t.Errorf("defaults inesperados: %+v (estado=%s)", tr, str(tr.Estado))
	}
	otra := crearTarea(t, api, ana, p.ID, "Otra", map[string]any{"prioridad": " URGENTE ", "estado": "Bloqueado"})
	if otra.Prioridad != "urgente" || str(otra.Estado) != "Bloqueado" {
		t.Errorf("prioridad/estado explícitos: prioridad=%q estado=%s", otra.Prioridad, str(otra.Estado))
	}

	got := getTarea(t, api, ana, tr.ID)
	if got.Nombre != "Comprar pintura" || got.ProyectID != p.ID || len(got.Subtareas) != 0 {
		t.Errorf("GET tras crear: %+v", got)
	}
	expectIDs(t, "GET /api/tareas", tareaIDs(listarTareas(t, api, ana, "")), tr.ID, otra.ID)
	for _, x := range listarTareas(t, api, ana, "") {
		if str(x.ProyectoNombre) != "Proyecto" {
			t.Errorf("GET /api/tareas: proyecto_nombre=%s", str(x.ProyectoNombre))
		}
	}
	expectIDs(t, "tareas del proyecto", tareaIDs(tareasDeProyecto(t, api, ana, p.ID)), tr.ID, otra.ID)

	var upd models.TareaUpdateResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tr.ID), map[string]any{
		"nombre": " Comprar pintura azul ", "prioridad": "ALTA", "estado": "En Curso",
	}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Nombre != "Comprar pintura azul" || upd.Prioridad != "alta" || str(upd.Estado) != "En Curso" {
		t.Errorf("respuesta del PUT: %+v", upd)
	}
	got = getTarea(t, api, ana, tr.ID)
	if got.Nombre != "Comprar pintura azul" || got.Prioridad != "alta" || str(got.Estado) != "En Curso" ||
		got.Descripcion != "blanca" || got.Comentario != "2 litros" {
		t.Errorf("GET tras PUT no refleja lo persistido: %+v", got)
	}

	api.Do(ana, http.MethodDelete, apitest.Path("/api/tareas/%d", tr.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, apitest.Path("/api/tareas/%d", tr.ID), nil).Expect(t, http.StatusNotFound)
	expectIDs(t, "GET /api/tareas tras DELETE", tareaIDs(listarTareas(t, api, ana, "")), otra.ID)
	expectIDs(t, "tareas del proyecto tras DELETE", tareaIDs(tareasDeProyecto(t, api, ana, p.ID)), otra.ID)
}

func TestTareaValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "Valida", nil)
	path := apitest.Path("/api/tareas/%d", tr.ID)

	api.Do(ana, http.MethodPost, "/api/tareas", "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, path, "{json roto").Expect(t, http.StatusBadRequest)

	casos := []map[string]any{
		{"nombre": "", "proyect_id": p.ID},
		{"nombre": "   ", "proyect_id": p.ID},
		{"proyect_id": p.ID},
		{"nombre": "Sin proyecto"},
		{"nombre": "Proyecto cero", "proyect_id": 0},
		{"nombre": "Prioridad mala", "proyect_id": p.ID, "prioridad": "altisima"},
	}
	for _, body := range casos {
		if res := api.Do(ana, http.MethodPost, "/api/tareas", body); res.Status != http.StatusBadRequest {
			t.Errorf("POST %v: código %d, se esperaba 400; cuerpo: %s", body, res.Status, res.Body)
		}
	}

	api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "  "}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, path, map[string]any{"prioridad": "altisima"}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, path, map[string]any{"prioridad": ""}).Expect(t, http.StatusBadRequest)

	for _, id := range []string{"abc", "0", "-1"} {
		base := "/api/tareas/" + id
		expect4xx(t, api.Do(ana, http.MethodGet, base, nil), "GET "+base)
		expect4xx(t, api.Do(ana, http.MethodPut, base, map[string]any{"nombre": "x"}), "PUT "+base)
		expect4xx(t, api.Do(ana, http.MethodDelete, base, nil), "DELETE "+base)
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/proyects/"+id+"/tareas", nil), "GET /api/proyects/"+id+"/tareas")
	}
	api.Do(ana, http.MethodGet, apitest.Path("/api/tareas/%d", inexistente), nil).Expect(t, http.StatusNotFound)

	if got := getTarea(t, api, ana, tr.ID); got.Nombre != "Valida" || got.Prioridad != "normal" {
		t.Errorf("tarea modificada por peticiones inválidas: %+v", got)
	}
	expectIDs(t, "GET /api/tareas", tareaIDs(listarTareas(t, api, ana, "")), tr.ID)
}

func TestTareaEstadoFueraDeCheck(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "Tarea", nil)

	expect4xx(t, api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{"nombre": "x", "proyect_id": p.ID, "estado": "Inventado"}),
		"POST estado inválido")
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tr.ID), map[string]any{"estado": "Inventado"}),
		"PUT estado inválido")
	if got := getTarea(t, api, ana, tr.ID); str(got.Estado) != "Abierto" {
		t.Errorf("estado modificado: %s", str(got.Estado))
	}
}

func TestTareaProyectoInexistente(t *testing.T) {
	api, ana, _ := setup(t)
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{"nombre": "x", "proyect_id": inexistente}),
		"POST proyect_id inexistente")
}

func TestTareaPadreInexistente(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{"nombre": "x", "proyect_id": p.ID, "tarea_padre_id": inexistente}),
		"POST tarea_padre_id inexistente")
	tr := crearTarea(t, api, ana, p.ID, "Tarea", nil)
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tr.ID), map[string]any{"tarea_padre_id": inexistente}),
		"PUT tarea_padre_id inexistente")
}

func TestTareaInexistenteOAjenaDevuelve404(t *testing.T) {
	api, ana, beto := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "De Ana", nil)

	for _, c := range []struct {
		u  *apitest.User
		id int
	}{{ana, inexistente}, {beto, tr.ID}} {
		path := apitest.Path("/api/tareas/%d", c.id)
		expectNoEncontrado(t, api.Do(c.u, http.MethodPut, path, map[string]any{"nombre": "x"}), "PUT "+path)
		expectNoEncontrado(t, api.Do(c.u, http.MethodDelete, path, nil), "DELETE "+path)
	}
}

func TestTareaBorradaNoSeEdita(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	tr := crearTarea(t, api, ana, p.ID, "Borrada", nil)
	path := apitest.Path("/api/tareas/%d", tr.ID)
	api.Do(ana, http.MethodDelete, path, nil).Expect(t, http.StatusNoContent)

	expectNoEncontrado(t, api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "zombi"}), "PUT tras DELETE")
	expectNoEncontrado(t, api.Do(ana, http.MethodDelete, path, nil), "DELETE repetido")
}

func TestTareaSubtareas(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	padre := crearTarea(t, api, ana, p.ID, "Padre", nil)
	s1 := crearTarea(t, api, ana, p.ID, "Sub 1", map[string]any{"tarea_padre_id": padre.ID})
	s2 := crearTarea(t, api, ana, p.ID, "Sub 2", map[string]any{"tarea_padre_id": padre.ID})
	suelta := crearTarea(t, api, ana, p.ID, "Suelta", nil)

	if s1.TareaPadreID == nil || *s1.TareaPadreID != padre.ID {
		t.Errorf("POST subtarea: tarea_padre_id = %s", idStr(s1.TareaPadreID))
	}

	got := getTarea(t, api, ana, padre.ID)
	if len(got.Subtareas) != 2 || got.Subtareas[0].ID != s1.ID || got.Subtareas[1].ID != s2.ID {
		t.Fatalf("subtareas del padre = %v, se esperaban [%d %d]", tareaIDs(got.Subtareas), s1.ID, s2.ID)
	}
	if gotS1 := getTarea(t, api, ana, s1.ID); gotS1.TareaPadreID == nil || *gotS1.TareaPadreID != padre.ID {
		t.Errorf("GET subtarea: tarea_padre_id = %s", idStr(gotS1.TareaPadreID))
	}

	// Por proyecto: jerarquía, las subtareas cuelgan del padre y no aparecen sueltas.
	top := tareasDeProyecto(t, api, ana, p.ID)
	expectIDs(t, "tareas principales del proyecto", tareaIDs(top), padre.ID, suelta.ID)
	for _, x := range top {
		if x.ID == padre.ID {
			expectIDs(t, "subtareas en el listado por proyecto", tareaIDs(x.Subtareas), s1.ID, s2.ID)
		}
	}
	// El listado plano incluye todas.
	expectIDs(t, "GET /api/tareas", tareaIDs(listarTareas(t, api, ana, "")), padre.ID, s1.ID, s2.ID, suelta.ID)

	// Borrar una subtarea la saca del padre.
	api.Do(ana, http.MethodDelete, apitest.Path("/api/tareas/%d", s2.ID), nil).Expect(t, http.StatusNoContent)
	expectIDs(t, "subtareas tras borrar", tareaIDs(getTarea(t, api, ana, padre.ID).Subtareas), s1.ID)

	// Convertir la suelta en subtarea por PUT.
	var upd models.TareaUpdateResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", suelta.ID), map[string]any{"tarea_padre_id": padre.ID}).
		Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.TareaPadreID == nil || *upd.TareaPadreID != padre.ID {
		t.Errorf("PUT tarea_padre_id: %s", idStr(upd.TareaPadreID))
	}
	expectIDs(t, "subtareas tras mover", tareaIDs(getTarea(t, api, ana, padre.ID).Subtareas), s1.ID, suelta.ID)
}

func TestTareaFechaTerminado(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)

	nacida := crearTarea(t, api, ana, p.ID, "Nacida terminada", map[string]any{"estado": "Terminado"})
	if nacida.FechaTerminado == nil {
		t.Error("POST estado=Terminado: fecha_terminado vacía")
	}
	if got := getTarea(t, api, ana, nacida.ID); got.FechaTerminado == nil {
		t.Error("GET de tarea creada terminada: fecha_terminado vacía")
	}

	tr := crearTarea(t, api, ana, p.ID, "Normal", nil)
	path := apitest.Path("/api/tareas/%d", tr.ID)

	var upd models.TareaUpdateResponse
	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "Terminado"}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.FechaTerminado == nil {
		t.Fatal("PUT estado=Terminado: fecha_terminado vacía")
	}
	primera := *upd.FechaTerminado
	if got := getTarea(t, api, ana, tr.ID); got.FechaTerminado == nil || !got.FechaTerminado.Equal(primera) || str(got.Estado) != "Terminado" {
		t.Errorf("GET tras terminar: estado=%s fecha=%v", str(got.Estado), got.FechaTerminado)
	}

	api.Do(ana, http.MethodPut, path, map[string]any{"comentario": "x"}).Expect(t, http.StatusOK)
	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "Terminado"}).Expect(t, http.StatusOK)
	if got := getTarea(t, api, ana, tr.ID); got.FechaTerminado == nil || !got.FechaTerminado.Equal(primera) {
		t.Errorf("fecha_terminado cambió: %v (era %v)", got.FechaTerminado, primera)
	}

	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "En Curso"}).Expect(t, http.StatusOK)
	if got := getTarea(t, api, ana, tr.ID); got.FechaTerminado != nil || str(got.Estado) != "En Curso" {
		t.Errorf("tras reabrir: estado=%s fecha_terminado=%v", str(got.Estado), got.FechaTerminado)
	}
}

func TestTareaFiltroEstado(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)
	abierta := crearTarea(t, api, ana, p.ID, "Abierta", nil)
	terminada := crearTarea(t, api, ana, p.ID, "Terminada", map[string]any{"estado": "Terminado"})
	bloqueada := crearTarea(t, api, ana, p.ID, "Bloqueada", map[string]any{"estado": "Bloqueado"})
	enCurso := crearTarea(t, api, ana, p.ID, "En curso", map[string]any{"estado": "En Curso"})
	borrada := crearTarea(t, api, ana, p.ID, "Borrada", map[string]any{"estado": "Terminado"})
	api.Do(ana, http.MethodDelete, apitest.Path("/api/tareas/%d", borrada.ID), nil).Expect(t, http.StatusNoContent)

	expectIDs(t, "?estado=Terminado", tareaIDs(listarTareas(t, api, ana, "?estado=Terminado")), terminada.ID)
	expectIDs(t, "?estado=terminado (sin distinguir mayúsculas)", tareaIDs(listarTareas(t, api, ana, "?estado=terminado")), terminada.ID)
	expectIDs(t, "?estado=Bloqueado", tareaIDs(listarTareas(t, api, ana, "?estado=Bloqueado")), bloqueada.ID)
	expectIDs(t, "?estado=En%20Curso", tareaIDs(listarTareas(t, api, ana, "?estado=En%20Curso")), enCurso.ID)
	expectIDs(t, "?estado=Abierto", tareaIDs(listarTareas(t, api, ana, "?estado=Abierto")), abierta.ID)
	expectIDs(t, "?estado=Pendiente", tareaIDs(listarTareas(t, api, ana, "?estado=Pendiente")))
	expectIDs(t, "?estado= (vacío = sin filtro)", tareaIDs(listarTareas(t, api, ana, "?estado=")),
		abierta.ID, terminada.ID, bloqueada.ID, enCurso.ID)

	// Sin resultados devuelve [] y no null.
	res := api.Do(ana, http.MethodGet, "/api/tareas?estado=Pendiente", nil).Expect(t, http.StatusOK)
	if string(res.Body) != "[]\n" && string(res.Body) != "[]" {
		t.Errorf("filtro sin resultados = %s, se esperaba []", res.Body)
	}
}
