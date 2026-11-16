// Package planificacion prueba por HTTP y MCP la planificación: horario base, huecos
// libres según cómo cuenta cada calendario, bloques de trabajo y cambios de tareas.
package planificacion

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/memorymcp"
	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func proyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string) int {
	t.Helper()
	return api.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q", "criterio_finalizacion": "c",
	}).Expect(t, http.StatusCreated).ID(t)
}

func tarea(t *testing.T, api *apitest.API, u *apitest.User, p int, nombre, limite string) int {
	t.Helper()
	body := map[string]any{"nombre": nombre, "proyect_id": p}
	if limite != "" {
		body["fecha_limite"] = limite + "T00:00:00Z"
	}
	return api.Do(u, http.MethodPost, "/api/tareas", body).Expect(t, http.StatusCreated).ID(t)
}

func calendario(t *testing.T, api *apitest.API, u *apitest.User, nombre, tipo, disp string) models.Calendario {
	t.Helper()
	var c models.Calendario
	body := map[string]any{"nombre": nombre, "tipo": tipo}
	if disp != "" {
		body["disponibilidad"] = disp
	}
	api.Do(u, http.MethodPost, "/api/calendarios", body).Expect(t, http.StatusCreated).JSON(t, &c)
	return c
}

func actividad(t *testing.T, api *apitest.API, u *apitest.User, cal int, titulo, ini, fin string, dias []int) {
	t.Helper()
	api.Do(u, http.MethodPost, apitest.Path("/api/calendarios/%d/actividades", cal), map[string]any{
		"titulo": titulo, "fecha": "2026-11-02", "hora_inicio": ini, "hora_fin": fin, "dias_semana": dias,
	}).Expect(t, http.StatusCreated)
}

func key(t *testing.T, api *apitest.API, u *apitest.User, proyectos, calendarios []int, scopes ...string) *apitest.User {
	t.Helper()
	var issued models.IssuedAPIKey
	api.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{
		Nombre: "PM", ProyectoIDs: proyectos, CalendarioIDs: calendarios, Scopes: scopes,
	}).Expect(t, http.StatusCreated).JSON(t, &issued)
	if !reflect.DeepEqual(issued.CalendarioIDs, calendarios) && len(calendarios) > 0 {
		t.Fatalf("calendarios de la key: %v", issued.CalendarioIDs)
	}
	return &apitest.User{ID: int(issued.ID), Token: issued.Token}
}

func disponibilidad(t *testing.T, api *apitest.API, u *apitest.User, query string) models.Disponibilidad {
	t.Helper()
	var d models.Disponibilidad
	api.Do(u, http.MethodGet, "/api/integrations/calendar"+query, nil).Expect(t, http.StatusOK).JSON(t, &d)
	return d
}

func huecosDe(d models.Disponibilidad, fecha string) []string {
	out := []string{}
	for _, h := range d.Huecos {
		if h.Fecha == fecha {
			out = append(out, h.HoraInicio+"-"+h.HoraFin)
		}
	}
	return out
}

type escenario struct {
	api                      *apitest.API
	ana                      *apitest.User
	p, q                     int // p lo ve la key; q no
	tareaP, tareaQ           int
	colegio, terapias, turno models.Calendario
}

// Semana del lunes 16 de noviembre de 2026: colegio libera L–V 08–13, terapias ocupa
// el martes 15–16, los turnos de la mamá son contexto, y el horario base es L–V 14–18.
func preparar(t *testing.T) *escenario {
	t.Helper()
	api := apitest.New(t, "planificacion")
	e := &escenario{api: api, ana: api.User("ana@plan.test")}
	e.p, e.q = proyecto(t, api, e.ana, "Trabajo"), proyecto(t, api, e.ana, "Privado")
	e.tareaP = tarea(t, api, e.ana, e.p, "Informe", "2026-11-18")
	e.tareaQ = tarea(t, api, e.ana, e.q, "Trámite", "2026-11-19")
	e.colegio = calendario(t, api, e.ana, "Colegio", "actividades", "libera")
	e.terapias = calendario(t, api, e.ana, "Terapias", "actividades", "")
	e.turno = calendario(t, api, e.ana, "Turnos mamá", "turnos", "")
	if e.terapias.Disponibilidad != "ocupa" || e.turno.Disponibilidad != "contexto" || e.colegio.Disponibilidad != "libera" {
		t.Fatalf("disponibilidad por defecto: %+v %+v %+v", e.terapias, e.turno, e.colegio)
	}
	actividad(t, api, e.ana, e.colegio.ID, "Colegio", "08:00", "13:00", []int{0, 1, 2, 3, 4})
	actividad(t, api, e.ana, e.terapias.ID, "Fonoaudióloga", "15:00", "16:00", []int{1})
	api.Do(e.ana, http.MethodPut, apitest.Path("/api/calendarios/%d/ciclo", e.turno.ID), map[string]any{
		"primer_largo": "2026-11-16"}).Expect(t, http.StatusOK)
	franjas := []models.FranjaHorario{}
	for d := 0; d < 5; d++ {
		franjas = append(franjas, models.FranjaHorario{DiaSemana: d, HoraInicio: "14:00", HoraFin: "18:00"})
	}
	var guardadas []models.FranjaHorario
	api.Do(e.ana, http.MethodPut, "/api/calendario/horario-base", models.HorarioBaseRequest{Franjas: franjas}).
		Expect(t, http.StatusOK).JSON(t, &guardadas)
	if len(guardadas) != 5 {
		t.Fatalf("horario base: %+v", guardadas)
	}
	return e
}

func TestHorarioBaseValidaYReemplaza(t *testing.T) {
	e := preparar(t)
	for _, mal := range [][]models.FranjaHorario{
		{{DiaSemana: 7, HoraInicio: "09:00", HoraFin: "10:00"}},
		{{DiaSemana: 0, HoraInicio: "10:00", HoraFin: "09:00"}},
		{{DiaSemana: 0, HoraInicio: "09:00", HoraFin: "12:00"}, {DiaSemana: 0, HoraInicio: "11:00", HoraFin: "13:00"}},
		{{DiaSemana: 0, HoraInicio: "9:00", HoraFin: "12:00"}},
	} {
		e.api.Do(e.ana, http.MethodPut, "/api/calendario/horario-base", models.HorarioBaseRequest{Franjas: mal}).
			Expect(t, http.StatusBadRequest)
	}
	var franjas []models.FranjaHorario
	e.api.Do(e.ana, http.MethodPut, "/api/calendario/horario-base", models.HorarioBaseRequest{Franjas: []models.FranjaHorario{
		{DiaSemana: 5, HoraInicio: "20:00", HoraFin: "24:00"}}}).Expect(t, http.StatusOK).JSON(t, &franjas)
	if want := []models.FranjaHorario{{DiaSemana: 5, HoraInicio: "20:00", HoraFin: "24:00"}}; !reflect.DeepEqual(franjas, want) {
		t.Fatalf("reemplazo del horario: %+v", franjas)
	}
	// Otro usuario no ve el horario de Ana.
	beto := e.api.User("beto@plan.test")
	e.api.Do(beto, http.MethodGet, "/api/calendario/horario-base", nil).Expect(t, http.StatusOK).JSON(t, &franjas)
	if len(franjas) != 0 {
		t.Fatalf("horario ajeno: %+v", franjas)
	}
}

func TestDisponibilidadCuentaCadaCalendarioYOcultaLoNoExpuesto(t *testing.T) {
	e := preparar(t)
	pm := key(t, e.api, e.ana, []int{e.p}, []int{e.colegio.ID, e.turno.ID}, models.CalendarRead, models.TasksManage)

	d := disponibilidad(t, e.api, pm, "?desde=2026-11-16&hasta=2026-11-20&ahora=2026-11-16T09:30")
	if got := huecosDe(d, "2026-11-16"); !reflect.DeepEqual(got, []string{"09:30-13:00", "14:00-18:00"}) {
		t.Errorf("lunes: %v", got)
	}
	if got := huecosDe(d, "2026-11-17"); !reflect.DeepEqual(got, []string{"08:00-13:00", "14:00-15:00", "16:00-18:00"}) {
		t.Errorf("martes (la terapia ocupa): %v", got)
	}
	if d.MinutosLibres == 0 || len(d.Avisos) != 0 || len(d.HorarioBase) != 5 {
		t.Errorf("resumen: libres=%d avisos=%v base=%d", d.MinutosLibres, d.Avisos, len(d.HorarioBase))
	}
	// Solo se nombran los calendarios expuestos; la terapia aparece como "Ocupado".
	if len(d.Calendarios) != 2 {
		t.Errorf("calendarios expuestos: %+v", d.Calendarios)
	}
	var ocupado, largo, noche bool
	for _, ev := range d.Eventos {
		if ev.Titulo == "Fonoaudióloga" {
			t.Fatal("la key no debía ver el título de la terapia")
		}
		if ev.Fecha == "2026-11-17" && ev.Titulo == "Ocupado" && ev.CalendarioID == nil && ev.HoraInicio == "15:00" {
			ocupado = true
		}
		if ev.Fecha == "2026-11-16" && ev.Titulo == "Largo" && ev.HoraInicio == "08:00" && ev.HoraFin == "20:00" {
			largo = true
		}
		if ev.Fecha == "2026-11-17" && ev.Titulo == "Noche" && ev.TerminaDiaSig && ev.HoraFin == "08:00" {
			noche = true
		}
	}
	if !ocupado || !largo || !noche {
		t.Errorf("eventos: ocupado=%v largo=%v noche=%v\n%+v", ocupado, largo, noche, d.Eventos)
	}
	// Deadlines solo de los proyectos de la key.
	if len(d.Deadlines) != 1 || d.Deadlines[0].ID != e.tareaP {
		t.Errorf("deadlines: %+v", d.Deadlines)
	}

	// Si los turnos pasan a ocupar, la Noche del martes quita la tarde y la mañana siguiente.
	e.api.Do(e.ana, http.MethodPut, apitest.Path("/api/calendarios/%d", e.turno.ID), map[string]any{
		"disponibilidad": "ocupa"}).Expect(t, http.StatusOK)
	e.api.Do(e.ana, http.MethodPut, apitest.Path("/api/calendarios/%d", e.turno.ID), map[string]any{
		"disponibilidad": "a veces"}).Expect(t, http.StatusBadRequest)
	d = disponibilidad(t, e.api, pm, "?desde=2026-11-16&hasta=2026-11-20&ahora=2026-11-16T00:00")
	if got := huecosDe(d, "2026-11-16"); len(got) != 0 {
		t.Errorf("lunes con Largo 08–20 ocupando: %v", got)
	}

	// Sin horario base se avisa.
	e.api.Do(e.ana, http.MethodPut, "/api/calendario/horario-base", models.HorarioBaseRequest{Franjas: nil}).Expect(t, http.StatusOK)
	if d = disponibilidad(t, e.api, pm, "?desde=2026-11-16&hasta=2026-11-16"); len(d.Avisos) != 1 {
		t.Errorf("aviso sin horario base: %v", d.Avisos)
	}

	// Rango y parámetros.
	e.api.Do(pm, http.MethodGet, "/api/integrations/calendar?desde=2026-11-16&hasta=2026-12-31", nil).Expect(t, http.StatusBadRequest)
	e.api.Do(pm, http.MethodGet, "/api/integrations/calendar?desde=2026-11-16&hasta=2026-11-15", nil).Expect(t, http.StatusBadRequest)
	e.api.Do(pm, http.MethodGet, "/api/integrations/calendar?ahora=mañana", nil).Expect(t, http.StatusBadRequest)
}

func TestPermisosDeKeysDeCalendario(t *testing.T) {
	e := preparar(t)
	soloTareas := key(t, e.api, e.ana, []int{e.p}, nil, models.TasksRead)
	e.api.Do(soloTareas, http.MethodGet, "/api/integrations/calendar", nil).Expect(t, http.StatusForbidden)
	e.api.Do(soloTareas, http.MethodPatch, apitest.Path("/api/integrations/projects/%d/tasks/%d", e.p, e.tareaP),
		map[string]any{"estado": "Terminado"}).Expect(t, http.StatusForbidden)

	// Calendarios sin calendar:read, o ajenos, se rechazan.
	e.api.Do(e.ana, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{
		Nombre: "x", ProyectoIDs: []int{e.p}, CalendarioIDs: []int{e.colegio.ID}, Scopes: []string{models.TasksRead},
	}).Expect(t, http.StatusBadRequest)
	beto := e.api.User("beto@plan.test")
	pb := proyecto(t, e.api, beto, "Beto")
	e.api.Do(beto, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{
		Nombre: "x", ProyectoIDs: []int{pb}, CalendarioIDs: []int{e.colegio.ID}, Scopes: []string{models.CalendarRead},
	}).Expect(t, http.StatusNotFound)

	// Una key sin calendarios elegidos ve solo huecos y "Ocupado".
	ciega := key(t, e.api, e.ana, []int{e.p}, nil, models.CalendarRead)
	d := disponibilidad(t, e.api, ciega, "?desde=2026-11-17&hasta=2026-11-17&ahora=2026-11-17T00:00")
	if len(d.Calendarios) != 0 || len(d.Huecos) == 0 {
		t.Fatalf("key sin calendarios: %+v", d)
	}
	for _, ev := range d.Eventos {
		if ev.Titulo != "Ocupado" {
			t.Fatalf("la key sin calendarios vio %+v", ev)
		}
	}

	// La lista de keys devuelve los calendarios elegidos.
	key(t, e.api, e.ana, []int{e.p}, []int{e.turno.ID}, models.CalendarRead)
	var keys []models.APIKey
	e.api.Do(e.ana, http.MethodGet, "/api/api-keys", nil).Expect(t, http.StatusOK).JSON(t, &keys)
	if !reflect.DeepEqual(keys[0].CalendarioIDs, []int{e.turno.ID}) {
		t.Fatalf("calendarios en el listado: %+v", keys[0])
	}
}

func TestPlanificarBloquesYActualizarTarea(t *testing.T) {
	e := preparar(t)
	pm := key(t, e.api, e.ana, []int{e.p}, []int{e.colegio.ID}, models.CalendarRead, models.TasksManage, models.TasksRead)
	ruta := apitest.Path("/api/integrations/projects/%d/tasks/%d/bloques", e.p, e.tareaP)
	plan := models.PlanificarRequest{OperacionID: "plan-informe-1", Bloques: []models.BloqueInput{
		{Fecha: "2026-11-17", HoraInicio: "16:00", HoraFin: "17:30"},
		{Fecha: "2026-11-18", HoraInicio: "06:00", HoraFin: "07:00"}, // antes del colegio: fuera de hueco
	}}
	var res, replay models.PlanificacionResult
	e.api.Do(pm, http.MethodPost, ruta, plan).Expect(t, http.StatusCreated).JSON(t, &res)
	if len(res.Bloques) != 2 || res.Bloques[0].Origen != "mcp" || res.Bloques[0].Tarea != "Informe" || len(res.Avisos) != 1 {
		t.Fatalf("planificación: %+v", res)
	}
	e.api.Do(pm, http.MethodPost, ruta, plan).Expect(t, http.StatusCreated).JSON(t, &replay)
	if !reflect.DeepEqual(res, replay) {
		t.Fatalf("el reintento debía devolver lo mismo: %+v", replay)
	}
	otro := plan
	otro.Bloques = plan.Bloques[:1]
	e.api.Do(pm, http.MethodPost, ruta, otro).Expect(t, http.StatusConflict)
	// Solape con un bloque existente, y bloques inválidos.
	e.api.Do(pm, http.MethodPost, ruta, models.PlanificarRequest{OperacionID: "plan-informe-2", Bloques: []models.BloqueInput{
		{Fecha: "2026-11-17", HoraInicio: "17:00", HoraFin: "18:00"}}}).Expect(t, http.StatusConflict)
	e.api.Do(pm, http.MethodPost, ruta, models.PlanificarRequest{OperacionID: "plan-informe-3", Bloques: []models.BloqueInput{
		{Fecha: "2026-11-17", HoraInicio: "18:00", HoraFin: "17:00"}}}).Expect(t, http.StatusBadRequest)
	// La tarea de otro proyecto no se planifica con esta key.
	e.api.Do(pm, http.MethodPost, apitest.Path("/api/integrations/projects/%d/tasks/%d/bloques", e.q, e.tareaQ), models.PlanificarRequest{
		OperacionID: "plan-ajeno", Bloques: []models.BloqueInput{{Fecha: "2026-11-19", HoraInicio: "14:00", HoraFin: "15:00"}}}).Expect(t, http.StatusNotFound)
	// …ni con la tarea en la ruta de otro proyecto.
	e.api.Do(pm, http.MethodPost, apitest.Path("/api/integrations/projects/%d/tasks/%d/bloques", e.p, e.tareaQ), models.PlanificarRequest{
		OperacionID: "plan-cruzado", Bloques: []models.BloqueInput{{Fecha: "2026-11-19", HoraInicio: "14:00", HoraFin: "15:00"}}}).Expect(t, http.StatusNotFound)

	// Con sesión sí se planifica la tarea privada; la key la ve como "Ocupado".
	var privado models.PlanificacionResult
	e.api.Do(e.ana, http.MethodPost, apitest.Path("/api/integrations/projects/%d/tasks/%d/bloques", e.q, e.tareaQ), models.PlanificarRequest{
		OperacionID: "plan-privado", Bloques: []models.BloqueInput{{Fecha: "2026-11-19", HoraInicio: "14:00", HoraFin: "15:00"}}}).
		Expect(t, http.StatusCreated).JSON(t, &privado)
	if privado.Bloques[0].Origen != "app" {
		t.Fatalf("origen con sesión: %+v", privado.Bloques[0])
	}
	d := disponibilidad(t, e.api, pm, "?desde=2026-11-17&hasta=2026-11-19&ahora=2026-11-17T00:00")
	if got := huecosDe(d, "2026-11-17"); !reflect.DeepEqual(got, []string{"08:00-13:00", "14:00-15:00", "17:30-18:00"}) {
		t.Errorf("martes con el bloque: %v", got)
	}
	if got := huecosDe(d, "2026-11-19"); !reflect.DeepEqual(got, []string{"08:00-13:00", "15:00-18:00"}) {
		t.Errorf("jueves con el bloque privado: %v", got)
	}
	if len(d.Bloques) != 2 {
		t.Errorf("la key solo debía ver sus 2 bloques: %+v", d.Bloques)
	}
	var rango models.CalendarioRango
	e.api.Do(e.ana, http.MethodGet, "/api/calendario?desde=2026-11-16&hasta=2026-11-22", nil).Expect(t, http.StatusOK).JSON(t, &rango)
	if len(rango.Bloques) != 3 {
		t.Errorf("el calendario de la app debía mostrar los 3 bloques: %+v", rango.Bloques)
	}

	// Actualizar la tarea: estimación, fechas y cierre.
	tarea := apitest.Path("/api/integrations/projects/%d/tasks/%d", e.p, e.tareaP)
	var task models.IntegrationTask
	e.api.Do(pm, http.MethodPatch, tarea, map[string]any{"estimacion_min": 180, "fecha_inicio": "2026-11-16", "prioridad": "ALTA"}).
		Expect(t, http.StatusOK).JSON(t, &task)
	if task.EstimacionMin == nil || *task.EstimacionMin != 180 || task.FechaInicio == nil || *task.FechaInicio != "2026-11-16" ||
		task.FechaLimite == nil || *task.FechaLimite != "2026-11-18" || task.Prioridad != "alta" || task.MinutosPlanificados != 150 {
		t.Fatalf("tarea actualizada: %+v", task)
	}
	for _, mal := range []map[string]any{
		{},
		{"estado": "Hecho"},
		{"estimacion_min": 0},
		{"fecha_inicio": "2026-11-20"}, // posterior al límite: lo rechaza la base
		{"fecha_limite": "18-11-2026"},
		{"estimacion_min": 30, "quitar_estimacion": true},
		{"nombre": "Otro"},
	} {
		e.api.Do(pm, http.MethodPatch, tarea, mal).Expect(t, http.StatusBadRequest)
	}
	sub := e.api.Do(e.ana, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Anexo", "proyect_id": e.p, "tarea_padre_id": e.tareaP}).
		Expect(t, http.StatusCreated).ID(t)
	e.api.Do(pm, http.MethodPatch, tarea, map[string]any{"estado": "Terminado", "quitar_estimacion": true}).
		Expect(t, http.StatusOK).JSON(t, &task)
	if task.Estado != "Terminado" || task.FechaTerminado == nil || task.EstimacionMin != nil {
		t.Fatalf("cierre: %+v", task)
	}
	var subtarea models.IntegrationTask
	e.api.Do(pm, http.MethodGet, apitest.Path("/api/integrations/projects/%d/tasks/%d", e.p, sub), nil).Expect(t, http.StatusOK).JSON(t, &subtarea)
	if subtarea.Estado != "Terminado" {
		t.Fatalf("la subtarea debía cerrarse: %+v", subtarea)
	}
	var cambiosMCP int
	if err := e.api.DB.QueryRow(context.Background(), `SELECT count(*) FROM eventos
		WHERE entidad='tarea' AND entidad_id=$1 AND origen='mcp'`, e.tareaP).Scan(&cambiosMCP); err != nil || cambiosMCP != 2 {
		t.Fatalf("los cambios por MCP debían quedar en el historial: %d, %v", cambiosMCP, err)
	}

	// Quitar bloques: solo los de los proyectos de la key.
	e.api.Do(pm, http.MethodDelete, apitest.Path("/api/integrations/projects/%d/bloques/%d", e.p, privado.Bloques[0].ID), nil).Expect(t, http.StatusNotFound)
	e.api.Do(pm, http.MethodDelete, apitest.Path("/api/integrations/projects/%d/bloques/%d", e.p, res.Bloques[0].ID), nil).Expect(t, http.StatusOK)
	e.api.Do(pm, http.MethodDelete, apitest.Path("/api/integrations/projects/%d/bloques/%d", e.p, res.Bloques[0].ID), nil).Expect(t, http.StatusNotFound)
	e.api.Do(e.ana, http.MethodDelete, apitest.Path("/api/calendario/bloques/%d", privado.Bloques[0].ID), nil).Expect(t, http.StatusNoContent)
	beto := e.api.User("beto@plan.test")
	e.api.Do(beto, http.MethodDelete, apitest.Path("/api/calendario/bloques/%d", res.Bloques[1].ID), nil).Expect(t, http.StatusNotFound)
}

func TestHerramientasDePMPorMCP(t *testing.T) {
	e := preparar(t)
	pm := key(t, e.api, e.ana, []int{e.p}, []int{e.colegio.ID}, models.CalendarRead, models.TasksManage, models.TasksRead)
	backend, err := memorymcp.NewClient(e.api.Server.URL, pm.Token)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	st, ct := mcp.NewInMemoryTransports()
	ss, err := memorymcp.NewServer(backend).Connect(ctx, st, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "pm-test", Version: "1"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	tools, err := cs.ListTools(ctx, nil)
	if err != nil || len(tools.Tools) != 11 {
		t.Fatalf("herramientas: %+v, err=%v", tools, err)
	}
	for _, tool := range tools.Tools {
		if tool.Name == "ver_disponibilidad" && !tool.Annotations.ReadOnlyHint {
			t.Fatal("ver_disponibilidad debe ser solo lectura")
		}
	}
	call := func(name string, args any, wantError bool, out any) {
		t.Helper()
		result, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil || result.IsError != wantError {
			data, _ := json.Marshal(result)
			t.Fatalf("%s: err=%v result=%s", name, err, data)
		}
		if out != nil {
			data, _ := json.Marshal(result.StructuredContent)
			if err := json.Unmarshal(data, out); err != nil {
				t.Fatal(err)
			}
		}
	}
	var d models.Disponibilidad
	call("ver_disponibilidad", map[string]any{"desde": "2026-11-16", "hasta": "2026-11-20"}, false, &d)
	if d.Desde != "2026-11-16" || len(d.Calendarios) != 1 || d.Ahora == "" {
		t.Fatalf("disponibilidad MCP: %+v", d)
	}
	call("ver_disponibilidad", map[string]any{"desde": "16/11"}, true, nil)

	var plan models.PlanificacionResult
	args := map[string]any{"proyecto_id": e.p, "tarea_id": e.tareaP, "operacion_id": "mcp-plan-1",
		"bloques": []map[string]string{{"fecha": "2026-11-17", "hora_inicio": "09:00", "hora_fin": "10:30"}}}
	call("planificar_tarea", args, false, &plan)
	if len(plan.Bloques) != 1 || plan.Bloques[0].TareaID != e.tareaP {
		t.Fatalf("plan MCP: %+v", plan)
	}
	args["operacion_id"] = "mcp-plan-2"
	call("planificar_tarea", args, true, nil) // solapa con el anterior

	var task models.IntegrationTask
	call("actualizar_tarea", map[string]any{"proyecto_id": e.p, "tarea_id": e.tareaP, "estimacion_min": 90, "estado": "En Curso"}, false, &task)
	if task.Estado != "En Curso" || task.MinutosPlanificados != 90 {
		t.Fatalf("tarea MCP: %+v", task)
	}
	call("actualizar_tarea", map[string]any{"proyecto_id": e.p, "tarea_id": e.tareaP}, true, nil)

	var quitado struct {
		Eliminado bool `json:"eliminado"`
	}
	call("quitar_bloque", map[string]any{"proyecto_id": e.p, "bloque_id": plan.Bloques[0].ID}, false, &quitado)
	if !quitado.Eliminado {
		t.Fatal("quitar_bloque")
	}
	call("quitar_bloque", map[string]any{"proyecto_id": e.p, "bloque_id": plan.Bloques[0].ID}, true, nil)
}
