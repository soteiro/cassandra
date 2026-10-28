package integrationtasks_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/memorymcp"
	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func project(t *testing.T, a *apitest.API, u *apitest.User, name string) int {
	t.Helper()
	return a.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": name, "por_que": "ordenar", "para_que": "trabajar", "criterio_finalizacion": "comprobado", "prioridad": "Media",
	}).Expect(t, http.StatusCreated).ID(t)
}

func key(t *testing.T, a *apitest.API, u *apitest.User, projects []int, scopes ...string) *apitest.User {
	t.Helper()
	var issued models.IssuedAPIKey
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{
		Nombre: "Asistente", ProyectoIDs: projects, Scopes: scopes,
	}).Expect(t, http.StatusCreated).JSON(t, &issued)
	return &apitest.User{ID: int(issued.ID), Token: issued.Token}
}

func path(projectID int) string {
	return apitest.Path("/api/integrations/projects/%d/tasks", projectID)
}

func body(op, name string) models.CreateIntegrationTaskRequest {
	return models.CreateIntegrationTaskRequest{OperacionID: op, Nombre: name}
}

func create(t *testing.T, a *apitest.API, agent *apitest.User, projectID int, req models.CreateIntegrationTaskRequest) models.IntegrationTask {
	t.Helper()
	var task models.IntegrationTask
	a.Do(agent, http.MethodPost, path(projectID), req).Expect(t, http.StatusCreated).JSON(t, &task)
	return task
}

func list(t *testing.T, a *apitest.API, agent *apitest.User, projectID int, query string) models.IntegrationTaskList {
	t.Helper()
	var result models.IntegrationTaskList
	a.Do(agent, http.MethodGet, path(projectID)+query, nil).Expect(t, http.StatusOK).JSON(t, &result)
	if result.Tareas == nil {
		t.Fatal("el listado debe devolver [] en lugar de null")
	}
	return result
}

func ids(tasks []models.IntegrationTask) []int {
	result := []int{}
	for _, task := range tasks {
		result = append(result, task.ID)
	}
	return result
}

func TestTasksCreateReadFiltersAndFlatHierarchy(t *testing.T) {
	a := apitest.New(t, "integration_tasks")
	u := a.User("ana@tasks.test")
	p := project(t, a, u, "Proyecto")
	agent := key(t, a, u, []int{p}, models.TasksRead, models.TasksCreate)
	if got := list(t, a, agent, p, ""); len(got.Tareas) != 0 || got.HayMas {
		t.Fatalf("proyecto nuevo: %+v", got)
	}
	parent := create(t, a, agent, p, body("create-parent", "  Padre  "))
	if parent.Nombre != "Padre" || parent.Estado != "Abierto" || parent.Prioridad != "normal" || parent.ProyectoID != p || parent.TareaPadreID != nil {
		t.Fatalf("valores iniciales: %+v", parent)
	}
	req := body("create-child-one", "Revisar 100%_literal")
	req.TareaPadreID, req.Prioridad, req.Descripcion, req.Comentario = &parent.ID, " ALTA ", " documento ", " revisar "
	child := create(t, a, agent, p, req)
	grandReq := body("create-grandchild", "Nieto")
	grandReq.TareaPadreID = &child.ID
	grandchild := create(t, a, agent, p, grandReq)
	if child.Descripcion != "documento" || child.Comentario != "revisar" || child.Prioridad != "alta" || child.TareaPadreID == nil || *child.TareaPadreID != parent.ID {
		t.Fatalf("subtarea: %+v", child)
	}
	page := list(t, a, agent, p, "?limit=1")
	if !reflect.DeepEqual(ids(page.Tareas), []int{grandchild.ID}) || !page.HayMas {
		t.Fatalf("primera página: %+v", page)
	}
	page = list(t, a, agent, p, "?limit=1&offset=1")
	if !reflect.DeepEqual(ids(page.Tareas), []int{child.ID}) || !page.HayMas {
		t.Fatalf("segunda página: %+v", page)
	}
	page = list(t, a, agent, p, "?limit=1&offset=2")
	if !reflect.DeepEqual(ids(page.Tareas), []int{parent.ID}) || page.HayMas {
		t.Fatalf("última página: %+v", page)
	}
	for query, expected := range map[string][]int{
		"":                  {grandchild.ID, child.ID, parent.ID},
		"?tarea_padre_id=0": {parent.ID},
		fmt.Sprintf("?tarea_padre_id=%d", parent.ID): {child.ID},
		fmt.Sprintf("?tarea_padre_id=%d", child.ID):  {grandchild.ID},
		"?q=" + url.QueryEscape("%_literal"):         {child.ID},
		"?q=documento&prioridad=alta&estado=Abierto": {child.ID},
		"?estado=Terminado":                          {},
		"?offset=10000":                              {},
	} {
		if got := ids(list(t, a, agent, p, query).Tareas); !reflect.DeepEqual(got, expected) {
			t.Errorf("%s: tareas=%v, esperadas=%v", query, got, expected)
		}
	}
	res := a.Do(agent, http.MethodGet, path(p)+fmt.Sprintf("/%d", child.ID), nil).Expect(t, http.StatusOK)
	var read models.IntegrationTask
	res.JSON(t, &read)
	if !reflect.DeepEqual(child, read) || strings.Contains(string(res.Body), "user_id") || strings.Contains(string(res.Body), "subtareas") {
		t.Fatalf("detalle inconsistente o con carga implícita: %s", res.Body)
	}
	if res.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("la respuesta de integración debe impedir caché")
	}
	// También se ven las tareas que el usuario creó desde la API habitual.
	legacyID := a.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Desde la app", "proyect_id": p}).Expect(t, http.StatusCreated).ID(t)
	a.Do(agent, http.MethodGet, path(p)+fmt.Sprintf("/%d", legacyID), nil).Expect(t, http.StatusOK)
}

func TestTaskKeysAreScopedToOperationUserAndProject(t *testing.T) {
	a := apitest.New(t, "integration_tasks")
	u, v := a.User("ana@tasks.test"), a.User("bob@tasks.test")
	p, p2, other := project(t, a, u, "A"), project(t, a, u, "B"), project(t, a, v, "Ajeno")
	agent := key(t, a, u, []int{p}, models.TasksRead, models.TasksCreate)
	read := key(t, a, u, []int{p}, models.TasksRead)
	write := key(t, a, u, []int{p}, models.TasksCreate)
	memory := key(t, a, u, []int{p}, models.MemoryRead, models.MemoryWrite)
	task := create(t, a, agent, p, body("task-permissions", "Tarea"))
	for _, candidate := range []*apitest.User{read, memory} {
		a.Do(candidate, http.MethodPost, path(p), body("task-forbidden", "No crear")).Expect(t, http.StatusForbidden)
	}
	for _, candidate := range []*apitest.User{write, memory} {
		a.Do(candidate, http.MethodGet, path(p), nil).Expect(t, http.StatusForbidden)
		a.Do(candidate, http.MethodGet, fmt.Sprintf("%s/%d", path(p), task.ID), nil).Expect(t, http.StatusForbidden)
	}
	a.Do(agent, http.MethodGet, fmt.Sprintf("/api/memory/projects/%d", p), nil).Expect(t, http.StatusForbidden)
	a.Do(agent, http.MethodPost, fmt.Sprintf("/api/memory/projects/%d/advances", p), nil).Expect(t, http.StatusForbidden)
	for _, projectID := range []int{p2, other, 2147483647} {
		a.Do(agent, http.MethodGet, path(projectID), nil).Expect(t, http.StatusNotFound)
		a.Do(agent, http.MethodGet, fmt.Sprintf("%s/%d", path(projectID), task.ID), nil).Expect(t, http.StatusNotFound)
		a.Do(agent, http.MethodPost, path(projectID), body("other-project", "No crear")).Expect(t, http.StatusNotFound)
	}
	for _, route := range []string{"/api/tareas", "/api/proyects", "/api/api-keys", "/api/personas", "/api/finanzas/resumen"} {
		a.Do(agent, http.MethodGet, route, nil).Expect(t, http.StatusUnauthorized)
	}
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		a.Do(agent, method, fmt.Sprintf("/api/tareas/%d", task.ID), nil).Expect(t, http.StatusUnauthorized)
		a.Do(agent, method, fmt.Sprintf("%s/%d", path(p), task.ID), nil).Expect(t, http.StatusMethodNotAllowed)
	}
	a.Do(nil, http.MethodGet, path(p), nil).Expect(t, http.StatusUnauthorized)
	// Un padre del mismo usuario pero de otro proyecto también está fuera de alcance.
	parent2 := a.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Otro padre", "proyect_id": p2}).Expect(t, http.StatusCreated).ID(t)
	req := body("cross-project-parent", "Intrusa")
	req.TareaPadreID = &parent2
	a.Do(agent, http.MethodPost, path(p), req).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodGet, fmt.Sprintf("%s/%d", path(p), parent2), nil).Expect(t, http.StatusNotFound)
	a.Do(v, http.MethodGet, path(p), nil).Expect(t, http.StatusNotFound)
	// Las claves de sesión pueden usar el mismo contrato de integración.
	a.Do(u, http.MethodGet, path(p), nil).Expect(t, http.StatusOK)
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "Escalada", ProyectoIDs: []int{p}, Scopes: []string{"tasks:write"}}).Expect(t, http.StatusBadRequest)
	a.Do(u, http.MethodDelete, fmt.Sprintf("/api/api-keys/%d", agent.ID), nil).Expect(t, http.StatusNoContent)
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusUnauthorized)
	a.Do(agent, http.MethodPost, path(p), body("task-permissions", "Tarea")).Expect(t, http.StatusUnauthorized)
	if _, err := a.DB.Exec(context.Background(), `UPDATE api_keys SET expira_en=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1`, read.ID); err != nil {
		t.Fatal(err)
	}
	a.Do(read, http.MethodGet, path(p), nil).Expect(t, http.StatusUnauthorized)
	if _, err := a.DB.Exec(context.Background(), `UPDATE users SET eliminado=true WHERE id=$1`, u.ID); err != nil {
		t.Fatal(err)
	}
	a.Do(write, http.MethodPost, path(p), body("inactive-user", "No crear")).Expect(t, http.StatusUnauthorized)
}

func TestTaskCreationIsAtomicAndConcurrentRetriesAreIdempotent(t *testing.T) {
	a := apitest.New(t, "integration_tasks")
	u := a.User("ana@tasks.test")
	p := project(t, a, u, "A")
	agent := key(t, a, u, []int{p}, models.TasksRead, models.TasksCreate, models.MemoryRead, models.MemoryWrite)
	req := body("concurrent-creation", "Una sola tarea")
	start := make(chan struct{})
	results := make(chan models.IntegrationTask, 8)
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results <- create(t, a, agent, p, req)
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	var first models.IntegrationTask
	for task := range results {
		if first.ID == 0 {
			first = task
		}
		if !reflect.DeepEqual(first, task) {
			t.Fatalf("reintentos distintos: %+v, %+v", first, task)
		}
	}
	var tasks, operations, events int
	if err := a.DB.QueryRow(context.Background(), `SELECT
		(SELECT count(*) FROM tareas_proyectos), (SELECT count(*) FROM tareas_operaciones WHERE api_key_id=$1),
		(SELECT count(*) FROM eventos WHERE entidad='tarea' AND origen='mcp')`, agent.ID).Scan(&tasks, &operations, &events); err != nil {
		t.Fatal(err)
	}
	if tasks != 1 || operations != 1 || events != 1 {
		t.Fatalf("tareas=%d operaciones=%d eventos=%d", tasks, operations, events)
	}
	changed := req
	changed.Nombre = "Otra cosa"
	a.Do(agent, http.MethodPost, path(p), changed).Expect(t, http.StatusConflict)
	a.Do(u, http.MethodPut, fmt.Sprintf("/api/tareas/%d", first.ID), map[string]any{"nombre": "Editada"}).Expect(t, http.StatusOK)
	a.Do(u, http.MethodDelete, fmt.Sprintf("/api/tareas/%d", first.ID), nil).Expect(t, http.StatusNoContent)
	if replay := create(t, a, agent, p, req); !reflect.DeepEqual(replay, first) {
		t.Fatalf("se perdió la respuesta original: %+v", replay)
	}
	a.Do(agent, http.MethodGet, fmt.Sprintf("%s/%d", path(p), first.ID), nil).Expect(t, http.StatusNotFound)
	// El registro de operaciones de memoria tiene un espacio independiente.
	revision := int64(0)
	a.Do(agent, http.MethodPost, fmt.Sprintf("/api/memory/projects/%d/advances", p), models.MemoryWriteRequest{
		OperacionID: req.OperacionID, RevisionEsperada: &revision,
		Fichas: []models.MemoryEntryInput{{Titulo: "Revisión", Contenido: "Crear tareas bajo solicitud del usuario.", Tipo: "decision", Estado: "elegida", Fuentes: []models.MemorySource{{Tipo: "nota", Referencia: "Prueba"}}}},
	}).Expect(t, http.StatusOK)
	// Forzar un fallo al guardar el resultado comprueba que el INSERT y su evento
	// también se revierten, y que se puede reintentar tras corregir el fallo.
	if _, err := a.DB.Exec(context.Background(), `ALTER TABLE tareas_operaciones ADD CONSTRAINT test_operation_failure CHECK (operacion_id <> 'rollback-operation')`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := a.DB.Exec(context.Background(), `ALTER TABLE tareas_operaciones DROP CONSTRAINT IF EXISTS test_operation_failure`); err != nil {
			t.Error(err)
		}
	})
	failure := body("rollback-operation", "No debe quedar")
	a.Do(agent, http.MethodPost, path(p), failure).Expect(t, http.StatusBadRequest)
	var remaining int
	if err := a.DB.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM tareas_proyectos WHERE nombre='No debe quedar') + (SELECT count(*) FROM eventos WHERE entidad='tarea' AND cambios->'nombre'->>'despues'='No debe quedar')`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatal("el fallo dejó una tarea o evento parcial")
	}
	if _, err := a.DB.Exec(context.Background(), `ALTER TABLE tareas_operaciones DROP CONSTRAINT test_operation_failure`); err != nil {
		t.Fatal(err)
	}
	create(t, a, agent, p, failure)
}

func TestTaskValidationAndBoundedLegacyReads(t *testing.T) {
	a := apitest.New(t, "integration_tasks")
	u := a.User("ana@tasks.test")
	p := project(t, a, u, "A")
	agent := key(t, a, u, []int{p}, models.TasksRead, models.TasksCreate)
	for _, invalid := range []any{
		body("short", "Nombre"), body("valid-operation", "  "), body("valid-operation", strings.Repeat("ñ", 501)),
		models.CreateIntegrationTaskRequest{OperacionID: "valid-operation", Nombre: "Tarea", Prioridad: "Inventada"},
		models.CreateIntegrationTaskRequest{OperacionID: "valid-operation", Nombre: "Tarea", Descripcion: strings.Repeat("ñ", 4001)},
		models.CreateIntegrationTaskRequest{OperacionID: "valid-operation", Nombre: "Tarea", Comentario: "nul\x00"},
		`{"operacion_id":"valid-operation","nombre":"Tarea","user_id":1}`,
		`{"operacion_id":"valid-operation","nombre":"Tarea","estado":"Terminado"}`,
		`{"operacion_id":"valid-operation","nombre":"Tarea","proyecto_id":1}`,
		`{"operacion_id":"valid-operation","nombre":"Tarea","tarea_padre_id":0}`,
		`{"operacion_id":"valid-operation","nombre":"Tarea","tarea_padre_id":-1}`,
		`{"operacion_id":"valid-operation","nombre":"Tarea","tarea_padre_id":2147483648}`,
		`{} {}`, "{",
	} {
		a.Do(agent, http.MethodPost, path(p), invalid).Expect(t, http.StatusBadRequest)
	}
	a.Do(agent, http.MethodPost, path(p), strings.Repeat(" ", 65537)+"{}").Expect(t, http.StatusRequestEntityTooLarge)
	for _, query := range []string{
		"?limit=0", "?limit=21", "?limit=-1", "?limit=x", "?limit=", "?offset=-1", "?offset=10001", "?offset=x",
		"?estado=Inventado", "?prioridad=Inventada", "?tarea_padre_id=-1", "?tarea_padre_id=2147483648", "?tarea_padre_id=x",
		"?q=" + url.QueryEscape(strings.Repeat("ñ", 151)), "?q=%00",
	} {
		a.Do(agent, http.MethodGet, path(p)+query, nil).Expect(t, http.StatusBadRequest)
	}
	for _, id := range []string{"0", "-1", "2147483648", "x"} {
		a.Do(agent, http.MethodGet, path(p)+"/"+id, nil).Expect(t, http.StatusBadRequest)
		a.Do(agent, http.MethodGet, "/api/integrations/projects/"+id+"/tasks", nil).Expect(t, http.StatusBadRequest)
	}
	// Texto antiguo creado fuera del MCP, incluidos NULL permitidos por el esquema.
	taskID := a.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Antigua", "descripcion": strings.Repeat("ñ", 5000), "proyect_id": p}).Expect(t, http.StatusCreated).ID(t)
	if _, err := a.DB.Exec(context.Background(), `UPDATE tareas_proyectos SET comentario=NULL,estado=NULL WHERE id=$1`, taskID); err != nil {
		t.Fatal(err)
	}
	var task models.IntegrationTask
	a.Do(agent, http.MethodGet, fmt.Sprintf("%s/%d", path(p), taskID), nil).Expect(t, http.StatusOK).JSON(t, &task)
	if !task.TextoTruncado || len([]rune(task.Descripcion)) != 4000 || task.Comentario != "" {
		t.Fatalf("lectura heredada sin acotar: %+v", task)
	}
	if got := list(t, a, agent, p, "?estado=Abierto"); len(got.Tareas) != 1 || !got.Tareas[0].TextoTruncado || got.Tareas[0].Estado != "Abierto" {
		t.Fatal("el listado también debe acotar textos heredados")
	}
	a.Do(u, http.MethodDelete, fmt.Sprintf("/api/proyects/%d", p), nil).Expect(t, http.StatusNoContent)
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodGet, fmt.Sprintf("%s/%d", path(p), taskID), nil).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodPost, path(p), body("deleted-project", "No crear")).Expect(t, http.StatusNotFound)
}

func TestTaskToolsThroughMCPHTTPAndPostgres(t *testing.T) {
	a := apitest.New(t, "integration_tasks")
	u := a.User("ana@tasks.test")
	p := project(t, a, u, "A")
	agent := key(t, a, u, []int{p}, models.TasksRead, models.TasksCreate)
	backend, err := memorymcp.NewClient(a.Server.URL, agent.Token)
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
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "task-test", Version: "1"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	available, err := cs.ListTools(ctx, nil)
	if err != nil || len(available.Tools) != 7 {
		t.Fatalf("herramientas: %+v, err=%v", available, err)
	}
	for _, tool := range available.Tools {
		if tool.Name == "crear_tarea" && (tool.Annotations.ReadOnlyHint || !tool.Annotations.IdempotentHint || *tool.Annotations.DestructiveHint) {
			t.Fatal("anotaciones de creación incorrectas")
		}
		if (tool.Name == "listar_tareas" || tool.Name == "obtener_tarea") && !tool.Annotations.ReadOnlyHint {
			t.Fatal("las consultas deben anunciarse como solo lectura")
		}
	}
	call := func(name string, args any, wantError bool, out any) *mcp.CallToolResult {
		t.Helper()
		result, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil || result.IsError != wantError {
			t.Fatalf("%s: err=%v result=%+v", name, err, result)
		}
		if out != nil {
			data, err := json.Marshal(result.StructuredContent)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(data, out); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	args := map[string]any{"proyecto_id": p, "operacion_id": "mcp-create-task", "nombre": "Desde MCP", "descripcion": "Texto literal 100%_"}
	var task, replay, detail models.IntegrationTask
	call("crear_tarea", args, false, &task)
	call("crear_tarea", args, false, &replay)
	call("obtener_tarea", map[string]any{"proyecto_id": p, "tarea_id": task.ID}, false, &detail)
	if task.ID == 0 || !reflect.DeepEqual(task, replay) || !reflect.DeepEqual(task, detail) {
		t.Fatalf("creación/lectura MCP: %+v %+v %+v", task, replay, detail)
	}
	var page models.IntegrationTaskList
	call("listar_tareas", map[string]any{"proyecto_id": p, "consulta": "100%_", "limit": 1}, false, &page)
	if len(page.Tareas) != 1 || page.Tareas[0].ID != task.ID || page.HayMas {
		t.Fatalf("listado MCP: %+v", page)
	}
	args["nombre"] = "Cambio"
	conflict := call("crear_tarea", args, true, nil)
	data, _ := json.Marshal(conflict)
	if strings.Contains(string(data), "obtener_contexto") || strings.Contains(string(data), agent.Token) || !strings.Contains(string(data), "operacion_id") {
		t.Fatalf("error de tarea incorrecto: %s", data)
	}
	call("crear_tarea", map[string]any{"proyecto_id": p, "operacion_id": "mcp-invalid-task", "nombre": ""}, true, nil)
	call("listar_tareas", map[string]any{"proyecto_id": p, "limit": 21}, true, nil)
	call("obtener_tarea", map[string]any{"proyecto_id": p, "tarea_id": 0}, true, nil)
	call("obtener_contexto", map[string]any{"proyecto_id": p}, true, nil)
}
