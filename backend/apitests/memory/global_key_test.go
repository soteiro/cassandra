package memory_test

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/memorymcp"
	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var allScopes = []string{models.MemoryRead, models.MemoryWrite, models.TasksRead, models.TasksCreate, models.TasksManage, models.CalendarRead}

func globalKey(t *testing.T, a *apitest.API, u *apitest.User, scopes ...string) models.IssuedAPIKey {
	t.Helper()
	var k models.IssuedAPIKey
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "PM global", Scopes: scopes, TodosProyectos: true, TodosCalendarios: true}).
		Expect(t, http.StatusCreated).JSON(t, &k)
	if k.Token == "" || !k.TodosProyectos || !k.TodosCalendarios || len(k.ProyectoIDs) != 0 || k.ProyectoIDs == nil {
		t.Fatalf("emisión de la key global: %+v", k.APIKey)
	}
	return k
}

func listProjects(t *testing.T, a *apitest.API, u *apitest.User) models.IntegrationProjectList {
	t.Helper()
	var out models.IntegrationProjectList
	a.Do(u, http.MethodGet, "/api/integrations/projects", nil).Expect(t, http.StatusOK).JSON(t, &out)
	return out
}

func ids(l models.IntegrationProjectList) []int {
	out := []int{}
	for _, p := range l.Proyectos {
		out = append(out, p.ID)
	}
	slices.Sort(out)
	return out
}

func TestGlobalKeyValidation(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	bad := map[string]models.CreateAPIKeyRequest{
		"sin proyectos ni todos":            {Nombre: "x", Scopes: []string{models.MemoryRead}},
		"todos y lista de proyectos":        {Nombre: "x", Scopes: []string{models.MemoryRead}, TodosProyectos: true, ProyectoIDs: []int{p}},
		"todos los calendarios sin permiso": {Nombre: "x", Scopes: []string{models.MemoryRead}, TodosProyectos: true, TodosCalendarios: true},
		"todos y lista de calendarios":      {Nombre: "x", Scopes: []string{models.CalendarRead}, TodosProyectos: true, TodosCalendarios: true, CalendarioIDs: []int{1}},
	}
	for name, req := range bad {
		if res := a.Do(u, http.MethodPost, "/api/api-keys", req); res.Status != http.StatusBadRequest {
			t.Errorf("%s: %d %s", name, res.Status, res.Body)
		}
	}
	// Todos los calendarios con proyectos sueltos es válido: son alcances independientes.
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "x", Scopes: []string{models.CalendarRead}, ProyectoIDs: []int{p}, TodosCalendarios: true}).
		Expect(t, http.StatusCreated)
}

func TestGlobalKeyReachesAllOwnProjectsIncludingFutureOnes(t *testing.T) {
	a := apitest.New(t, "memory")
	u, v := a.User("ana@memory.test"), a.User("bob@memory.test")
	p := project(t, a, u, "A")
	other := project(t, a, v, "Ajeno")
	k := globalKey(t, a, u, allScopes...)
	agent := &apitest.User{Token: k.Token}
	later := project(t, a, u, "Creado después")

	for _, id := range []int{p, later} {
		a.Do(agent, http.MethodGet, path(id), nil).Expect(t, http.StatusOK)
		a.Do(agent, http.MethodPost, path(id)+"/advances", advance("global-op-"+time.Now().Format("150405.000000"), 0)).Expect(t, http.StatusOK)
		a.Do(agent, http.MethodPost, apitest.Path("/api/integrations/projects/%d/tasks", id), models.CreateIntegrationTaskRequest{OperacionID: "global-task-op", Nombre: "Tarea"}).
			Expect(t, http.StatusCreated)
	}
	// Alcance total sobre lo propio, nunca sobre lo ajeno ni sobre rutas de sesión.
	a.Do(agent, http.MethodGet, path(other), nil).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodGet, apitest.Path("/api/integrations/projects/%d/tasks", other), nil).Expect(t, http.StatusNotFound)
	for _, route := range []string{"/api/proyects", "/api/api-keys", "/api/finanzas/resumen", "/api/personas"} {
		a.Do(agent, http.MethodGet, route, nil).Expect(t, http.StatusUnauthorized)
	}

	if l := listProjects(t, a, agent); !l.TodosProyectos || !slices.Equal(ids(l), []int{p, later}) {
		t.Fatalf("listado de la key global: %+v", l)
	}

	// Al acotarla pierde el resto en la siguiente petición.
	var updated models.APIKey
	a.Do(u, http.MethodPut, apitest.Path("/api/api-keys/%d", k.ID), models.CreateAPIKeyRequest{Nombre: "PM acotado", Scopes: allScopes, ProyectoIDs: []int{p}}).
		Expect(t, http.StatusOK).JSON(t, &updated)
	if updated.TodosProyectos || updated.TodosCalendarios || !slices.Equal(updated.ProyectoIDs, []int{p}) {
		t.Fatalf("key acotada: %+v", updated)
	}
	a.Do(agent, http.MethodGet, path(later), nil).Expect(t, http.StatusNotFound)
	if l := listProjects(t, a, agent); l.TodosProyectos || !slices.Equal(ids(l), []int{p}) {
		t.Fatalf("listado de la key acotada: %+v", l)
	}
}

func TestIntegrationProjectsListing(t *testing.T) {
	a := apitest.New(t, "memory")
	u, v := a.User("ana@memory.test"), a.User("bob@memory.test")
	p, q := project(t, a, u, "A"), project(t, a, u, "B")
	project(t, a, v, "Ajeno")
	scoped := &apitest.User{Token: key(t, a, u, []int{q}, models.TasksRead).Token}
	if l := listProjects(t, a, scoped); l.TodosProyectos || !slices.Equal(ids(l), []int{q}) || l.Proyectos[0].Nombre != "B" {
		t.Fatalf("key acotada: %+v", l)
	}
	if l := listProjects(t, a, u); !l.TodosProyectos || !slices.Equal(ids(l), []int{p, q}) {
		t.Fatalf("sesión: %+v", l)
	}
	writeOnly := &apitest.User{Token: key(t, a, u, []int{p}, models.MemoryWrite).Token}
	a.Do(writeOnly, http.MethodGet, "/api/integrations/projects", nil).Expect(t, http.StatusForbidden)
	a.Do(&apitest.User{}, http.MethodGet, "/api/integrations/projects", nil).Expect(t, http.StatusUnauthorized)
	// Los eliminados no aparecen.
	a.Do(u, http.MethodDelete, apitest.Path("/api/proyects/%d", p), nil)
	if l := listProjects(t, a, u); !slices.Equal(ids(l), []int{q}) {
		t.Fatalf("listado con un proyecto eliminado: %+v", l)
	}
}

func TestMCPGlobalKeyListsAndUsesProjects(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p, q := project(t, a, u, "A"), project(t, a, u, "B")
	backend, err := memorymcp.NewClient(a.Server.URL, globalKey(t, a, u, allScopes...).Token)
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
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "pm-test", Version: "1"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	res, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: "listar_proyectos", Arguments: map[string]any{}})
	if err != nil || res.IsError {
		t.Fatalf("listar_proyectos: err=%v res=%+v", err, res)
	}
	var list models.IntegrationProjectList
	if err := remarshal(res.StructuredContent, &list); err != nil {
		t.Fatal(err)
	}
	if !list.TodosProyectos || !slices.Equal(ids(list), []int{p, q}) {
		t.Fatalf("listar_proyectos: %+v", list)
	}
	for _, id := range ids(list) {
		res, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: "obtener_contexto", Arguments: memorymcp.ContextInput{ProyectoID: id}})
		if err != nil || res.IsError {
			t.Fatalf("obtener_contexto %d: err=%v res=%+v", id, err, res)
		}
	}
}

func remarshal(from, to any) error {
	data, err := json.Marshal(from)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, to)
}
