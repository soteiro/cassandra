package proyectos

import (
	"net/http"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestProyectoCRUD(t *testing.T) {
	api, ana, _ := setup(t)
	limite := time.Date(2027, 1, 15, 12, 0, 0, 0, time.UTC)

	p := crearProyecto(t, api, ana, "Huerto", nil)

	// Create recorta espacios y aplica defaults.
	var c models.ProyectResponse
	api.Do(ana, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": "  Cocina  ", "por_que": " p ", "para_que": " q ", "criterio_finalizacion": " c ", "comentario": " ojo ",
		"fecha_limite": limite,
	}).Expect(t, http.StatusCreated).JSON(t, &c)
	if c.Nombre != "Cocina" || c.PorQue != "p" || c.ParaQue != "q" || c.CriterioFinalizacion != "c" || c.Comentario != "ojo" {
		t.Errorf("create no recorta espacios: %+v", c)
	}
	if c.Estado != "No Listado" || c.Prioridad != "Media" || c.FechaTerminado != nil || c.ProyectoPadreID != nil {
		t.Errorf("defaults inesperados: estado=%q prioridad=%q fecha_terminado=%v padre=%s", c.Estado, c.Prioridad, c.FechaTerminado, idStr(c.ProyectoPadreID))
	}
	if c.FechaLimite == nil || !c.FechaLimite.Equal(limite) {
		t.Errorf("fecha_limite = %v, se esperaba %v", c.FechaLimite, limite)
	}

	got := getProyecto(t, api, ana, c.ID)
	if got.Nombre != "Cocina" || got.Comentario != "ojo" || got.SubproyectosCount != 0 || got.NombrePadre != nil {
		t.Errorf("GET tras crear: %+v", got)
	}
	expectIDs(t, "listado", proyectoIDs(listarProyectos(t, api, ana)), p.ID, c.ID)

	// PUT parcial: solo cambia lo enviado.
	var upd models.ProyectUpdateResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", c.ID), map[string]any{
		"nombre": " Cocina nueva ", "descripcion": "otra", "estado": "En Proceso", "prioridad": "Alta",
	}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Nombre != "Cocina nueva" || upd.Estado != "En Proceso" || upd.Prioridad != "Alta" {
		t.Errorf("respuesta del PUT: %+v", upd)
	}
	got = getProyecto(t, api, ana, c.ID)
	if got.Nombre != "Cocina nueva" || got.Descripcion != "otra" || got.Estado != "En Proceso" || got.Prioridad != "Alta" ||
		got.PorQue != "p" || got.Comentario != "ojo" || got.FechaLimite == nil {
		t.Errorf("GET tras PUT no refleja lo persistido: %+v", got)
	}

	// DELETE (borrado lógico).
	api.Do(ana, http.MethodDelete, apitest.Path("/api/proyects/%d", c.ID), nil).Expect(t, http.StatusNoContent)
	expect4xx(t, api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d", c.ID), nil), "GET tras DELETE")
	expectIDs(t, "listado tras DELETE", proyectoIDs(listarProyectos(t, api, ana)), p.ID)
	// PUT tras DELETE: ver TestProyectoInexistenteDevuelve404.
}

func TestProyectoInexistenteDevuelve404(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Borrable", nil)
	api.Do(ana, http.MethodDelete, apitest.Path("/api/proyects/%d", p.ID), nil).Expect(t, http.StatusNoContent)

	for _, id := range []int{inexistente, p.ID} {
		path := apitest.Path("/api/proyects/%d", id)
		expectNoEncontrado(t, api.Do(ana, http.MethodGet, path, nil), "GET "+path)
		expectNoEncontrado(t, api.Do(ana, http.MethodPut, path, map[string]any{"nombre": "x"}), "PUT "+path)
	}
	expectNoEncontrado(t, api.Do(ana, http.MethodDelete, apitest.Path("/api/proyects/%d", inexistente), nil), "DELETE inexistente")
}

func TestProyectoAjenoDevuelve404(t *testing.T) {
	api, ana, beto := setup(t)
	pA := crearProyecto(t, api, ana, "De Ana", nil)
	path := apitest.Path("/api/proyects/%d", pA.ID)
	expectNoEncontrado(t, api.Do(beto, http.MethodGet, path, nil), "GET ajeno")
	expectNoEncontrado(t, api.Do(beto, http.MethodPut, path, map[string]any{"nombre": "x"}), "PUT ajeno")
	expectNoEncontrado(t, api.Do(beto, http.MethodDelete, path, nil), "DELETE ajeno")
}

func TestProyectoValidaciones(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Valido", nil)

	api.Do(ana, http.MethodPost, "/api/proyects", "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", p.ID), "{json roto").Expect(t, http.StatusBadRequest)

	for _, campo := range []string{"nombre", "por_que", "para_que", "criterio_finalizacion"} {
		for _, valor := range []any{"", "   ", nil} {
			body := proyectoBody("Campo " + campo)
			if valor == nil {
				delete(body, campo)
			} else {
				body[campo] = valor
			}
			res := api.Do(ana, http.MethodPost, "/api/proyects", body)
			if res.Status != http.StatusBadRequest {
				t.Errorf("POST con %s=%v: código %d, se esperaba 400; cuerpo: %s", campo, valor, res.Status, res.Body)
			}
		}
	}

	api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", p.ID), map[string]any{"nombre": "   "}).Expect(t, http.StatusBadRequest)

	for _, id := range []string{"abc", "0", "-1", "1.5"} {
		base := "/api/proyects/" + id
		expect4xx(t, api.Do(ana, http.MethodGet, base, nil), "GET "+base)
		expect4xx(t, api.Do(ana, http.MethodPut, base, map[string]any{"nombre": "x"}), "PUT "+base)
		expect4xx(t, api.Do(ana, http.MethodDelete, base, nil), "DELETE "+base)
		expect4xx(t, api.Do(ana, http.MethodGet, base+"/subproyectos", nil), "GET "+base+"/subproyectos")
	}

	// Nada de lo anterior tocó el proyecto ni creó otros.
	if got := getProyecto(t, api, ana, p.ID); got.Nombre != "Valido" {
		t.Errorf("proyecto modificado por peticiones inválidas: %+v", got)
	}
	expectIDs(t, "listado", proyectoIDs(listarProyectos(t, api, ana)), p.ID)
}

func TestProyectoValoresFueraDeCheck(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Check", nil)

	body := proyectoBody("Prioridad mala")
	body["prioridad"] = "Urgentisima"
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/proyects", body), "POST prioridad inválida")

	path := apitest.Path("/api/proyects/%d", p.ID)
	expect4xx(t, api.Do(ana, http.MethodPut, path, map[string]any{"estado": "Inventado"}), "PUT estado inválido")
	expect4xx(t, api.Do(ana, http.MethodPut, path, map[string]any{"prioridad": "Inventada"}), "PUT prioridad inválida")
	if got := getProyecto(t, api, ana, p.ID); got.Estado != "No Listado" || got.Prioridad != "Media" {
		t.Errorf("proyecto modificado: %+v", got)
	}
}

func TestProyectoPadreInexistente(t *testing.T) {
	api, ana, _ := setup(t)
	body := proyectoBody("Huerfano")
	body["proyecto_padre_id"] = inexistente
	expect4xx(t, api.Do(ana, http.MethodPost, "/api/proyects", body), "POST padre inexistente")

	p := crearProyecto(t, api, ana, "Normal", nil)
	expect4xx(t, api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", p.ID), map[string]any{"proyecto_padre_id": inexistente}),
		"PUT padre inexistente")
}

func TestProyectoSubproyectos(t *testing.T) {
	api, ana, _ := setup(t)
	padre := crearProyecto(t, api, ana, "Casa", nil)
	h1 := crearProyecto(t, api, ana, "Cocina", map[string]any{"proyecto_padre_id": padre.ID})
	h2 := crearProyecto(t, api, ana, "Baño", map[string]any{"proyecto_padre_id": padre.ID})
	nieto := crearProyecto(t, api, ana, "Azulejos", map[string]any{"proyecto_padre_id": h1.ID})
	suelto := crearProyecto(t, api, ana, "Suelto", nil)

	if h1.ProyectoPadreID == nil || *h1.ProyectoPadreID != padre.ID {
		t.Errorf("POST subproyecto: proyecto_padre_id = %s", idStr(h1.ProyectoPadreID))
	}

	got := getProyecto(t, api, ana, padre.ID)
	if got.SubproyectosCount != 2 || got.NombrePadre != nil || got.ProyectoPadreID != nil {
		t.Errorf("padre: subproyectos_count=%d nombre_padre=%s", got.SubproyectosCount, str(got.NombrePadre))
	}
	gotH1 := getProyecto(t, api, ana, h1.ID)
	if gotH1.SubproyectosCount != 1 || str(gotH1.NombrePadre) != "Casa" || gotH1.ProyectoPadreID == nil || *gotH1.ProyectoPadreID != padre.ID {
		t.Errorf("hijo: %+v (nombre_padre=%s)", gotH1, str(gotH1.NombrePadre))
	}

	var subs []models.ProyectResponse
	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/subproyectos", padre.ID), nil).Expect(t, http.StatusOK).JSON(t, &subs)
	if len(subs) != 2 || subs[0].ID != h1.ID || subs[1].ID != h2.ID {
		t.Fatalf("subproyectos = %v, se esperaban [%d %d] en orden", proyectoIDs(subs), h1.ID, h2.ID)
	}
	for _, s := range subs {
		if str(s.NombrePadre) != "Casa" {
			t.Errorf("subproyecto %d: nombre_padre=%s", s.ID, str(s.NombrePadre))
		}
	}
	if subs[0].SubproyectosCount != 1 {
		t.Errorf("subproyectos_count de Cocina = %d, se esperaba 1", subs[0].SubproyectosCount)
	}

	// Sin hijos: lista vacía (no null).
	res := api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/subproyectos", suelto.ID), nil).Expect(t, http.StatusOK)
	if string(res.Body) != "[]\n" && string(res.Body) != "[]" {
		t.Errorf("subproyectos de un proyecto sin hijos = %s, se esperaba []", res.Body)
	}

	// El listado general incluye todos con sus contadores.
	for _, p := range listarProyectos(t, api, ana) {
		want := map[int]int{padre.ID: 2, h1.ID: 1, h2.ID: 0, nieto.ID: 0, suelto.ID: 0}[p.ID]
		if p.SubproyectosCount != want {
			t.Errorf("listado: proyecto %q subproyectos_count=%d, se esperaba %d", p.Nombre, p.SubproyectosCount, want)
		}
	}

	// Borrar un hijo descuenta y lo saca de la lista.
	api.Do(ana, http.MethodDelete, apitest.Path("/api/proyects/%d", h2.ID), nil).Expect(t, http.StatusNoContent)
	if got := getProyecto(t, api, ana, padre.ID); got.SubproyectosCount != 1 {
		t.Errorf("subproyectos_count tras borrar un hijo = %d, se esperaba 1", got.SubproyectosCount)
	}
	subs = nil
	api.Do(ana, http.MethodGet, apitest.Path("/api/proyects/%d/subproyectos", padre.ID), nil).Expect(t, http.StatusOK).JSON(t, &subs)
	expectIDs(t, "subproyectos tras borrar", proyectoIDs(subs), h1.ID)

	// Mover un proyecto suelto bajo el padre.
	api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", suelto.ID), map[string]any{"proyecto_padre_id": padre.ID}).
		Expect(t, http.StatusOK)
	if got := getProyecto(t, api, ana, suelto.ID); str(got.NombrePadre) != "Casa" {
		t.Errorf("tras mover: nombre_padre=%s", str(got.NombrePadre))
	}
	if got := getProyecto(t, api, ana, padre.ID); got.SubproyectosCount != 2 {
		t.Errorf("subproyectos_count tras mover = %d, se esperaba 2", got.SubproyectosCount)
	}
}

func TestProyectoFechaTerminado(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Terminable", nil)
	path := apitest.Path("/api/proyects/%d", p.ID)

	var upd models.ProyectUpdateResponse
	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "Completado"}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.FechaTerminado == nil {
		t.Fatal("PUT estado=Completado: fecha_terminado vacía")
	}
	primera := *upd.FechaTerminado
	got := getProyecto(t, api, ana, p.ID)
	if got.Estado != "Completado" || got.FechaTerminado == nil || !got.FechaTerminado.Equal(primera) {
		t.Errorf("GET tras completar: estado=%q fecha_terminado=%v", got.Estado, got.FechaTerminado)
	}

	// Otro PUT sin estado no toca la fecha; volver a completar tampoco la reescribe.
	api.Do(ana, http.MethodPut, path, map[string]any{"descripcion": "x"}).Expect(t, http.StatusOK)
	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "Completado"}).Expect(t, http.StatusOK)
	if got := getProyecto(t, api, ana, p.ID); got.FechaTerminado == nil || !got.FechaTerminado.Equal(primera) {
		t.Errorf("fecha_terminado cambió: %v (era %v)", got.FechaTerminado, primera)
	}

	// Reabrir la limpia.
	api.Do(ana, http.MethodPut, path, map[string]any{"estado": "En Proceso"}).Expect(t, http.StatusOK)
	if got := getProyecto(t, api, ana, p.ID); got.Estado != "En Proceso" || got.FechaTerminado != nil {
		t.Errorf("tras reabrir: estado=%q fecha_terminado=%v", got.Estado, got.FechaTerminado)
	}
}
