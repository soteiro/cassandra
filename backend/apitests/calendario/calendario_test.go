// Package calendario prueba por HTTP el calendario: fechas de tareas y proyectos, el
// rango con deadlines, turnos con ciclo y excepciones, y actividades con cancelaciones.
package calendario

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func setup(t *testing.T) (*apitest.API, *apitest.User, *apitest.User) {
	t.Helper()
	api := apitest.New(t, "calendario")
	return api, api.User("ana@calendario.test"), api.User("beto@calendario.test")
}

func proyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string, extra map[string]any) int {
	t.Helper()
	body := map[string]any{"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q", "criterio_finalizacion": "c"}
	for k, v := range extra {
		body[k] = v
	}
	return api.Do(u, http.MethodPost, "/api/proyects", body).Expect(t, http.StatusCreated).ID(t)
}

func rango(t *testing.T, api *apitest.API, u *apitest.User, desde, hasta, hoy string) models.CalendarioRango {
	t.Helper()
	var res models.CalendarioRango
	api.Do(u, http.MethodGet, apitest.Path("/api/calendario?desde=%s&hasta=%s&hoy=%s", desde, hasta, hoy), nil).
		Expect(t, http.StatusOK).JSON(t, &res)
	return res
}

func TestFechasDeTareas(t *testing.T) {
	api, ana, _ := setup(t)
	p := proyecto(t, api, ana, "Casa", nil)

	var tarea models.TareaResponse
	api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "Comprar uniforme", "proyect_id": p,
		"fecha_inicio": "2026-11-10T00:00:00Z", "fecha_limite": "2026-11-17T00:00:00Z",
	}).Expect(t, http.StatusCreated).JSON(t, &tarea)
	if tarea.FechaInicio == nil || tarea.FechaLimite == nil {
		t.Fatalf("la tarea no devolvió sus fechas: %+v", tarea)
	}

	// Inicio después del límite: lo rechaza el CHECK.
	api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tarea.ID), map[string]any{
		"fecha_inicio": "2026-11-20T00:00:00Z"}).Expect(t, http.StatusBadRequest)

	// Quitar la fecha de inicio.
	var upd models.TareaUpdateResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/tareas/%d", tarea.ID), map[string]any{
		"clear_fecha_inicio": true}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.FechaInicio != nil || upd.FechaLimite == nil {
		t.Fatalf("debía quitar solo el inicio: %+v", upd)
	}
}

func TestRangoDeadlines(t *testing.T) {
	api, ana, beto := setup(t)
	p := proyecto(t, api, ana, "Mudanza", map[string]any{
		"fecha_inicio": "2026-12-01T00:00:00Z", "fecha_limite": "2026-12-12T00:00:00Z"})
	api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "Pagar contribuciones", "proyect_id": p,
		"fecha_inicio": "2026-11-05T00:00:00Z", "fecha_limite": "2026-11-12T00:00:00Z"}).Expect(t, http.StatusCreated)
	api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "Hecha", "proyect_id": p, "estado": "Terminado", "fecha_limite": "2026-11-20T00:00:00Z"}).Expect(t, http.StatusCreated)
	api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "Lejana", "proyect_id": p, "fecha_limite": "2027-03-01T00:00:00Z"}).Expect(t, http.StatusCreated)

	// Semana del 16 al 22: la tarea vencida el 12 sigue apareciendo (atrasada), la
	// terminada y la lejana no, y el proyecto aún no empieza.
	res := rango(t, api, ana, "2026-11-16", "2026-11-22", "2026-11-14")
	if len(res.Deadlines) != 1 || res.Deadlines[0].Titulo != "Pagar contribuciones" || res.Deadlines[0].Tipo != "tarea" {
		t.Fatalf("deadlines inesperados: %+v", res.Deadlines)
	}
	if res.Deadlines[0].FechaInicio == nil || *res.Deadlines[0].FechaInicio != "2026-11-05" || res.Deadlines[0].FechaLimite != "2026-11-12" {
		t.Fatalf("fechas del deadline: %+v", res.Deadlines[0])
	}

	res = rango(t, api, ana, "2026-11-30", "2026-12-06", "2026-11-14")
	if len(res.Deadlines) != 2 {
		t.Fatalf("se esperaban la tarea atrasada y el proyecto: %+v", res.Deadlines)
	}

	// Beto no ve nada de Ana.
	if res := rango(t, api, beto, "2026-11-01", "2026-12-31", "2026-11-14"); len(res.Deadlines) != 0 {
		t.Fatalf("fuga de deadlines: %+v", res.Deadlines)
	}
}

func TestRangoValidacion(t *testing.T) {
	api, ana, _ := setup(t)
	api.Do(ana, http.MethodGet, "/api/calendario?desde=2026-11-30&hasta=2026-11-01", nil).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodGet, "/api/calendario?desde=2026-01-01&hasta=2026-12-31", nil).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodGet, "/api/calendario?desde=14-11-2026&hasta=2026-11-30", nil).Expect(t, http.StatusBadRequest)
}

func TestTurnos(t *testing.T) {
	api, ana, beto := setup(t)
	var cal models.Calendario
	api.Do(ana, http.MethodPost, "/api/calendarios", map[string]any{
		"nombre": "Turnos mamá", "tipo": "turnos", "color": "#c297ff"}).Expect(t, http.StatusCreated).JSON(t, &cal)

	// Sin ciclo no hay días.
	if res := rango(t, api, ana, "2026-11-14", "2026-11-17", "2026-11-14"); len(res.Turnos) != 0 {
		t.Fatalf("sin ciclo no debía haber turnos: %+v", res.Turnos)
	}

	api.Do(ana, http.MethodPut, apitest.Path("/api/calendarios/%d/ciclo", cal.ID), map[string]any{
		"primer_largo": "2026-11-02"}).Expect(t, http.StatusOK).JSON(t, &cal)
	if cal.PrimerLargo == nil || *cal.PrimerLargo != "2026-11-02" {
		t.Fatalf("ciclo no guardado: %+v", cal)
	}
	api.Do(ana, http.MethodPut, apitest.Path("/api/calendarios/%d/excepciones/2026-11-15", cal.ID), map[string]any{
		"codigo": "V"}).Expect(t, http.StatusNoContent)

	res := rango(t, api, ana, "2026-11-14", "2026-11-17", "2026-11-14")
	// Incluye el día anterior al rango, por la noche que cruza la medianoche.
	got := map[string]models.TurnoDia{}
	for _, d := range res.Turnos {
		got[d.Fecha] = d
	}
	want := map[string]string{"2026-11-13": "F", "2026-11-14": "L", "2026-11-15": "V", "2026-11-16": "S", "2026-11-17": "F"}
	for f, cod := range want {
		if got[f].Codigo != cod {
			t.Errorf("%s: %q, se esperaba %q", f, got[f].Codigo, cod)
		}
	}
	if !got["2026-11-15"].Cambio || got["2026-11-15"].Base != "N" {
		t.Errorf("la excepción debía marcar cambio sobre N: %+v", got["2026-11-15"])
	}

	// Ajustar el ciclo desde el 16: lo anterior queda como estaba.
	api.Do(ana, http.MethodPut, apitest.Path("/api/calendarios/%d/ciclo", cal.ID), map[string]any{
		"primer_largo": "2026-11-16"}).Expect(t, http.StatusOK)
	res = rango(t, api, ana, "2026-11-14", "2026-11-17", "2026-11-14")
	got = map[string]models.TurnoDia{}
	for _, d := range res.Turnos {
		got[d.Fecha] = d
	}
	if got["2026-11-14"].Codigo != "L" || got["2026-11-16"].Codigo != "L" || got["2026-11-17"].Codigo != "N" {
		t.Errorf("ciclo ajustado inesperado: %+v", got)
	}

	// Volver al ciclo y validaciones.
	api.Do(ana, http.MethodDelete, apitest.Path("/api/calendarios/%d/excepciones/2026-11-15", cal.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodPut, apitest.Path("/api/calendarios/%d/excepciones/2026-11-15", cal.ID), map[string]any{
		"codigo": "X"}).Expect(t, http.StatusBadRequest)
	api.Do(beto, http.MethodPut, apitest.Path("/api/calendarios/%d/ciclo", cal.ID), map[string]any{
		"primer_largo": "2026-11-16"}).Expect(t, http.StatusNotFound)
}

func TestActividades(t *testing.T) {
	api, ana, beto := setup(t)
	var hijo models.Calendario
	api.Do(ana, http.MethodPost, "/api/calendarios", map[string]any{"nombre": "Hijo", "tipo": "actividades"}).
		Expect(t, http.StatusCreated).JSON(t, &hijo)

	colegio := api.Do(ana, http.MethodPost, apitest.Path("/api/calendarios/%d/actividades", hijo.ID), map[string]any{
		"titulo": "Colegio", "fecha": "2026-03-02", "hora_inicio": "08:00", "hora_fin": "13:00",
		"dias_semana": []int{4, 0, 1, 2, 3, 0}, "hasta": "2026-12-18"}).Expect(t, http.StatusCreated).ID(t)
	api.Do(ana, http.MethodPost, apitest.Path("/api/calendarios/%d/actividades", hijo.ID), map[string]any{
		"titulo": "Pediatra", "fecha": "2026-11-19", "hora_inicio": "15:00", "hora_fin": "16:00"}).Expect(t, http.StatusCreated)
	api.Do(ana, http.MethodPut, apitest.Path("/api/calendario/actividades/%d/cancelaciones/2026-11-20", colegio), nil).
		Expect(t, http.StatusNoContent)

	res := rango(t, api, ana, "2026-11-16", "2026-11-22", "2026-11-14")
	var colegios, canceladas, pediatra int
	for _, o := range res.Ocurrencias {
		switch o.Titulo {
		case "Colegio":
			colegios++
			if o.Cancelada {
				canceladas++
			}
		case "Pediatra":
			pediatra++
			if o.Semanal || o.HoraInicio != "15:00" {
				t.Errorf("pediatra inesperado: %+v", o)
			}
		}
	}
	if colegios != 5 || canceladas != 1 || pediatra != 1 {
		t.Fatalf("ocurrencias: colegio %d (canceladas %d), pediatra %d", colegios, canceladas, pediatra)
	}

	// Validaciones y aislamiento.
	api.Do(ana, http.MethodPost, apitest.Path("/api/calendarios/%d/actividades", hijo.ID), map[string]any{
		"titulo": "Mal", "fecha": "2026-11-19", "hora_inicio": "16:00", "hora_fin": "15:00"}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, apitest.Path("/api/calendarios/%d/actividades", hijo.ID), map[string]any{
		"titulo": "Mal", "fecha": "2026-11-19", "hora_inicio": "15:00", "hora_fin": "16:00", "dias_semana": []int{7}}).Expect(t, http.StatusBadRequest)
	api.Do(beto, http.MethodPut, apitest.Path("/api/calendario/actividades/%d/cancelaciones/2026-11-18", colegio), nil).
		Expect(t, http.StatusNotFound)
	api.Do(beto, http.MethodDelete, apitest.Path("/api/calendario/actividades/%d", colegio), nil).Expect(t, http.StatusNotFound)
	if res := rango(t, api, beto, "2026-11-16", "2026-11-22", "2026-11-14"); len(res.Ocurrencias) != 0 || len(res.Calendarios) != 0 {
		t.Fatalf("fuga de calendarios: %+v", res)
	}

	// Ocultar y eliminar.
	var upd models.Calendario
	api.Do(ana, http.MethodPut, apitest.Path("/api/calendarios/%d", hijo.ID), map[string]any{"oculto": true}).
		Expect(t, http.StatusOK).JSON(t, &upd)
	if !upd.Oculto || upd.Nombre != "Hijo" {
		t.Fatalf("ocultar: %+v", upd)
	}
	api.Do(ana, http.MethodDelete, apitest.Path("/api/calendario/actividades/%d", colegio), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodDelete, apitest.Path("/api/calendarios/%d", hijo.ID), nil).Expect(t, http.StatusNoContent)
	if res := rango(t, api, ana, "2026-11-16", "2026-11-22", "2026-11-14"); len(res.Ocurrencias) != 0 {
		t.Fatalf("calendario eliminado sigue con ocurrencias: %+v", res.Ocurrencias)
	}
}

func TestPreferenciaDeadlines(t *testing.T) {
	api, ana, _ := setup(t)
	var pref models.Preferencias
	api.Do(ana, http.MethodPut, "/api/preferencias", map[string]any{"ocultar_deadlines": true}).
		Expect(t, http.StatusOK).JSON(t, &pref)
	if !pref.OcultarDeadlines {
		t.Fatalf("preferencia no guardada: %+v", pref)
	}
	if res := rango(t, api, ana, "2026-11-16", "2026-11-22", "2026-11-14"); !res.OcultarDeadlines {
		t.Fatal("el rango debía informar la capa oculta")
	}
}
