package memory_test

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/memorymcp"
	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Las notas las escribe el usuario desde la aplicación; las keys solo las leen.

func note(t *testing.T, a *apitest.API, u *apitest.User, route, text string) int {
	t.Helper()
	return a.Do(u, http.MethodPost, route, map[string]any{"nota": text}).Expect(t, http.StatusCreated).ID(t)
}

func projectNote(t *testing.T, a *apitest.API, u *apitest.User, projectID int, text string) int {
	t.Helper()
	return note(t, a, u, apitest.Path("/api/proyects/%d/notas", projectID), text)
}

func taskNote(t *testing.T, a *apitest.API, u *apitest.User, taskID int, text string) int {
	t.Helper()
	return note(t, a, u, apitest.Path("/api/tareas/%d/notas", taskID), text)
}

func task(t *testing.T, a *apitest.API, u *apitest.User, projectID int, name string) int {
	t.Helper()
	return a.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": name, "proyect_id": projectID}).Expect(t, http.StatusCreated).ID(t)
}

func notes(t *testing.T, a *apitest.API, agent *apitest.User, projectID int, query string) models.MemoryNoteList {
	t.Helper()
	var list models.MemoryNoteList
	a.Do(agent, http.MethodGet, path(projectID)+"/notes"+query, nil).Expect(t, http.StatusOK).JSON(t, &list)
	if list.Notas == nil {
		t.Fatal("el listado debe devolver [] en lugar de null")
	}
	return list
}

func noteIDs(list models.MemoryNoteList) []int {
	out := []int{}
	for _, n := range list.Notas {
		out = append(out, n.ID)
	}
	return out
}

func TestNotesSearchFiltersAndIsolation(t *testing.T) {
	a := apitest.New(t, "memory")
	u, v := a.User("ana@notes.test"), a.User("bob@notes.test")
	p, p2, other := project(t, a, u, "A"), project(t, a, u, "B"), project(t, a, v, "C")
	tk := task(t, a, u, p, "Conexiones caídas")
	business := projectNote(t, a, u, p, "Regla de negocio: descuento 10%_ a clientes antiguos")
	solved := taskNote(t, a, u, tk, "Se resolvió reiniciando el pool de conexiones")
	deleted := projectNote(t, a, u, p, "Nota borrada")
	a.Do(u, http.MethodDelete, apitest.Path("/api/notas/%d", deleted), nil).Expect(t, http.StatusNoContent)
	long := projectNote(t, a, u, p, strings.Repeat("á", 4001))
	projectNote(t, a, u, p2, "De otro proyecto")
	projectNote(t, a, v, other, "De otro usuario")

	agent := &apitest.User{Token: key(t, a, u, []int{p}, models.MemoryRead).Token}
	all := notes(t, a, agent, p, "")
	if !slices.Equal(noteIDs(all), []int{long, solved, business}) || all.HayMas {
		t.Fatalf("listado: %v hay_mas=%v", noteIDs(all), all.HayMas)
	}
	if n := all.Notas[0]; !n.TextoTruncado || len([]rune(n.Nota)) != 4000 || n.TareaID != nil {
		t.Fatalf("nota larga: truncado=%v largo=%d", n.TextoTruncado, len([]rune(n.Nota)))
	}
	if n := all.Notas[1]; n.TareaID == nil || *n.TareaID != tk || n.TareaNombre == nil || *n.TareaNombre != "Conexiones caídas" || n.ProyectoID != p {
		t.Fatalf("nota de tarea: %+v", n)
	}
	// La búsqueda es literal: '%' y '_' no actúan como comodines.
	if got := noteIDs(notes(t, a, agent, p, "?q=10%25_")); !slices.Equal(got, []int{business}) {
		t.Fatalf("búsqueda literal: %v", got)
	}
	if got := noteIDs(notes(t, a, agent, p, "?q=POOL")); !slices.Equal(got, []int{solved}) {
		t.Fatalf("búsqueda sin mayúsculas: %v", got)
	}
	if got := noteIDs(notes(t, a, agent, p, apitest.Path("?tarea_id=%d", tk))); !slices.Equal(got, []int{solved}) {
		t.Fatalf("filtro por tarea: %v", got)
	}
	if got := noteIDs(notes(t, a, agent, p, "?tarea_id=0")); !slices.Equal(got, []int{long, business}) {
		t.Fatalf("notas sin tarea: %v", got)
	}
	if page := notes(t, a, agent, p, "?limit=1"); !slices.Equal(noteIDs(page), []int{long}) || !page.HayMas {
		t.Fatalf("primera página: %+v", page)
	}
	if page := notes(t, a, agent, p, "?limit=1&offset=2"); !slices.Equal(noteIDs(page), []int{business}) || page.HayMas {
		t.Fatalf("última página: %+v", page)
	}
	for _, query := range []string{"?limit=0", "?limit=21", "?offset=10001", "?tarea_id=-1", "?tarea_id=x", "?q=" + strings.Repeat("a", 301)} {
		a.Do(agent, http.MethodGet, path(p)+"/notes"+query, nil).Expect(t, http.StatusBadRequest)
	}
	a.Do(agent, http.MethodGet, path(p2)+"/notes", nil).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodGet, path(other)+"/notes", nil).Expect(t, http.StatusNotFound)
	tasksOnly := &apitest.User{Token: key(t, a, u, []int{p}, models.TasksRead).Token}
	a.Do(tasksOnly, http.MethodGet, path(p)+"/notes", nil).Expect(t, http.StatusForbidden)

	var ctx models.MemoryContext
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusOK).JSON(t, &ctx)
	if ctx.NotasTotal != 3 {
		t.Fatalf("notas_total del contexto: %d", ctx.NotasTotal)
	}
	// Las notas no se pueden escribir con la key, ni por la API de la aplicación.
	a.Do(agent, http.MethodPost, apitest.Path("/api/proyects/%d/notas", p), map[string]any{"nota": "x"}).Expect(t, http.StatusUnauthorized)
	a.Do(agent, http.MethodPost, path(p)+"/notes", map[string]any{"nota": "x"}).Expect(t, http.StatusMethodNotAllowed)

	a.Do(u, http.MethodDelete, apitest.Path("/api/proyects/%d", p), nil).Expect(t, http.StatusNoContent)
	a.Do(agent, http.MethodGet, path(p)+"/notes", nil).Expect(t, http.StatusNotFound)
}

func TestTaskDetailIncludesNotesOnlyWithMemoryRead(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@notes.test")
	p := project(t, a, u, "A")
	tk, empty := task(t, a, u, p, "Con notas"), task(t, a, u, p, "Sin notas")
	var created []int
	for i := range 6 {
		created = append(created, taskNote(t, a, u, tk, strings.Repeat("x", i+1)))
	}
	projectNote(t, a, u, p, "Sin tarea")
	taskPath := func(id int) string { return apitest.Path("/api/integrations/projects/%d/tasks/%d", p, id) }

	withMemory := &apitest.User{Token: key(t, a, u, []int{p}, models.TasksRead, models.MemoryRead).Token}
	var detail models.IntegrationTask
	a.Do(withMemory, http.MethodGet, taskPath(tk), nil).Expect(t, http.StatusOK).JSON(t, &detail)
	if detail.NotasTotal == nil || *detail.NotasTotal != 6 || len(detail.Notas) != 5 || detail.Notas[0].ID != created[5] || detail.Notas[4].ID != created[1] {
		t.Fatalf("notas de la tarea: total=%v %+v", detail.NotasTotal, detail.Notas)
	}
	var none models.IntegrationTask
	a.Do(withMemory, http.MethodGet, taskPath(empty), nil).Expect(t, http.StatusOK).JSON(t, &none)
	if none.NotasTotal == nil || *none.NotasTotal != 0 || len(none.Notas) != 0 {
		t.Fatalf("tarea sin notas: total=%v %+v", none.NotasTotal, none.Notas)
	}

	tasksOnly := &apitest.User{Token: key(t, a, u, []int{p}, models.TasksRead).Token}
	res := a.Do(tasksOnly, http.MethodGet, taskPath(tk), nil).Expect(t, http.StatusOK)
	if strings.Contains(string(res.Body), `"notas"`) || strings.Contains(string(res.Body), `"notas_total"`) {
		t.Fatalf("una key sin memory:read no debe ver notas: %s", res.Body)
	}
}

func TestSearchNotesThroughMCP(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@notes.test")
	p := project(t, a, u, "A")
	tk := task(t, a, u, p, "Caída")
	solved := taskNote(t, a, u, tk, "Se resolvió subiendo el timeout")
	projectNote(t, a, u, p, "Regla de negocio")
	backend, err := memorymcp.NewClient(a.Server.URL, key(t, a, u, []int{p}, models.MemoryRead, models.TasksRead).Token)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	st, ct := mcp.NewInMemoryTransports()
	ss, err := memorymcp.NewServer(backend).Connect(ctx, st, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "notes-test", Version: "1"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	tools, err := cs.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, tool := range tools.Tools {
		if strings.Contains(tool.Name, "nota") {
			if tool.Name != "buscar_notas" || !tool.Annotations.ReadOnlyHint {
				t.Fatalf("las notas solo se leen; herramienta inesperada: %s", tool.Name)
			}
			found = true
		}
	}
	if !found {
		t.Fatal("falta buscar_notas")
	}
	call := func(name string, args any, wantError bool, out any) {
		t.Helper()
		res, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil || res.IsError != wantError {
			t.Fatalf("%s: err=%v res=%+v", name, err, res)
		}
		if out != nil {
			if err := remarshal(res.StructuredContent, out); err != nil {
				t.Fatal(err)
			}
		}
	}
	var list models.MemoryNoteList
	call("buscar_notas", map[string]any{"proyecto_id": p, "consulta": "timeout"}, false, &list)
	if !slices.Equal(noteIDs(list), []int{solved}) {
		t.Fatalf("buscar_notas: %+v", list)
	}
	call("buscar_notas", map[string]any{"proyecto_id": p, "tarea_id": 0}, false, &list)
	if len(list.Notas) != 1 || list.Notas[0].TareaID != nil {
		t.Fatalf("buscar_notas sin tarea: %+v", list)
	}
	var detail models.IntegrationTask
	call("obtener_tarea", map[string]any{"proyecto_id": p, "tarea_id": tk}, false, &detail)
	if len(detail.Notas) != 1 || detail.Notas[0].ID != solved {
		t.Fatalf("obtener_tarea sin notas: %+v", detail)
	}
	var memory models.MemoryContext
	call("obtener_contexto", map[string]any{"proyecto_id": p}, false, &memory)
	if memory.NotasTotal != 2 {
		t.Fatalf("obtener_contexto notas_total: %d", memory.NotasTotal)
	}
	call("buscar_notas", map[string]any{"proyecto_id": p, "limit": 21}, true, nil)
	call("buscar_notas", map[string]any{"proyecto_id": 0}, true, nil)
}
