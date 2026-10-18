package memory_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
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
	return a.Do(u, http.MethodPost, "/api/proyects", map[string]any{"nombre": name, "por_que": "recordar", "para_que": "retomar", "criterio_finalizacion": "flujo comprobado", "prioridad": "Media"}).Expect(t, http.StatusCreated).ID(t)
}

func key(t *testing.T, a *apitest.API, u *apitest.User, projects []int, scopes ...string) models.IssuedAPIKey {
	t.Helper()
	var k models.IssuedAPIKey
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "Agente de prueba", Scopes: scopes, ProyectoIDs: projects}).Expect(t, http.StatusCreated).JSON(t, &k)
	if k.Token == "" {
		t.Fatal("la emisión no entregó el secreto")
	}
	return k
}

func sources() []models.MemorySource {
	return []models.MemorySource{{Tipo: "conversacion", Referencia: "sesion-de-prueba-2026-10-18"}}
}

func advance(op string, revision int64) models.MemoryWriteRequest {
	return models.MemoryWriteRequest{OperacionID: op, RevisionEsperada: &revision, Memoria: &models.ProjectMemory{
		DeQueTrata: "Conservar el contexto del proyecto.", EnQueQuede: "Implementación comprobada en pruebas locales.", PorQueAsi: "Se eligió una memoria breve para poder retomar.", QueSigue: []string{"Revisar los resultados de integración."}, Fuentes: sources(),
	}}
}

func entry(title string) models.MemoryEntryInput {
	return models.MemoryEntryInput{Titulo: title, Contenido: "Se eligió esta alternativa porque reduce el trabajo de retomar el proyecto.", Tipo: "decision", Estado: "elegida", Fuentes: sources()}
}

func path(id int) string { return apitest.Path("/api/memory/projects/%d", id) }

func TestMemoryKeyLifecycleAndIsolation(t *testing.T) {
	a := apitest.New(t, "memory")
	u, v := a.User("ana@memory.test"), a.User("bob@memory.test")
	p, p2, other := project(t, a, u, "A"), project(t, a, u, "B"), project(t, a, v, "C")
	k := key(t, a, u, []int{p}, models.MemoryRead, models.MemoryWrite)
	agent := &apitest.User{Token: k.Token}
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusOK)
	a.Do(agent, http.MethodGet, path(p2), nil).Expect(t, http.StatusNotFound)
	a.Do(agent, http.MethodGet, path(other), nil).Expect(t, http.StatusNotFound)
	for _, route := range []string{"/api/proyects", "/api/api-keys", "/api/finanzas/resumen", "/api/personas"} {
		a.Do(agent, http.MethodGet, route, nil).Expect(t, http.StatusUnauthorized)
	}
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "Ajena", Scopes: []string{models.MemoryRead}, ProyectoIDs: []int{other}}).Expect(t, http.StatusNotFound)
	listed := a.Do(u, http.MethodGet, "/api/api-keys", nil).Expect(t, http.StatusOK)
	if strings.Contains(string(listed.Body), k.Token) || strings.Contains(string(listed.Body), "token_hash") {
		t.Fatal("el listado expone el secreto o su hash")
	}
	var storedHash string
	if err := a.DB.QueryRow(context.Background(), `SELECT token_hash FROM api_keys WHERE id=$1`, k.ID).Scan(&storedHash); err != nil {
		t.Fatal(err)
	}
	if len(storedHash) != 64 || strings.Contains(storedHash, k.Token) {
		t.Fatal("la key no está guardada como huella")
	}
	a.Do(v, http.MethodDelete, apitest.Path("/api/api-keys/%d", k.ID), nil).Expect(t, http.StatusNotFound)
	a.Do(u, http.MethodDelete, apitest.Path("/api/api-keys/%d", k.ID), nil).Expect(t, http.StatusNoContent)
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusUnauthorized)
	// Un header inválido debe prevalecer frente a una sesión válida en cookie.
	req, _ := http.NewRequest(http.MethodGet, a.Server.URL+path(p), nil)
	req.Header.Set("Authorization", "Bearer "+k.Token)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: u.Token})
	res, err := a.Server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("key revocada con cookie válida: %d", res.StatusCode)
	}
}

func TestMemoryScopesExpiryAndInactiveUsers(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	read := key(t, a, u, []int{p}, models.MemoryRead)
	write := key(t, a, u, []int{p}, models.MemoryWrite)
	a.Do(&apitest.User{Token: read.Token}, http.MethodPost, path(p)+"/advances", advance("read-only-operation", 0)).Expect(t, http.StatusForbidden)
	a.Do(&apitest.User{Token: write.Token}, http.MethodGet, path(p), nil).Expect(t, http.StatusForbidden)
	if _, err := a.DB.Exec(context.Background(), `UPDATE api_keys SET expira_en=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1`, read.ID); err != nil {
		t.Fatal(err)
	}
	a.Do(&apitest.User{Token: read.Token}, http.MethodGet, path(p), nil).Expect(t, http.StatusUnauthorized)
	if _, err := a.DB.Exec(context.Background(), `UPDATE users SET eliminado=true WHERE id=$1`, u.ID); err != nil {
		t.Fatal(err)
	}
	a.Do(&apitest.User{Token: write.Token}, http.MethodPost, path(p)+"/advances", advance("inactive-operation", 0)).Expect(t, http.StatusUnauthorized)
}

func TestContextMarksPartialProjectText(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	if _, err := a.DB.Exec(context.Background(), `UPDATE proyectos SET por_que='',para_que=$1 WHERE id=$2`, strings.Repeat("á", 1201), p); err != nil {
		t.Fatal(err)
	}
	var result models.MemoryContext
	a.Do(u, http.MethodGet, path(p), nil).Expect(t, http.StatusOK).JSON(t, &result)
	if !result.Proyecto.TextoTruncado || len([]rune(result.Proyecto.ParaQue)) != 1200 || result.Proyecto.PorQue != "" {
		t.Fatalf("contexto parcial sin identificar: %+v", result.Proyecto)
	}
}

func TestMemoryWritesAreAtomicIdempotentAndVersioned(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p, p2 := project(t, a, u, "A"), project(t, a, u, "B")
	k := key(t, a, u, []int{p}, models.MemoryRead, models.MemoryWrite)
	agent := &apitest.User{Token: k.Token}
	body := advance("first-operation", 0)
	body.Fichas = []models.MemoryEntryInput{entry("Elegir memoria breve")}
	var first models.MemoryWriteResult
	a.Do(agent, http.MethodPost, path(p)+"/advances", body).Expect(t, http.StatusOK).JSON(t, &first)
	if first.Revision != 1 || first.LogID == nil || first.DocumentoID != nil || len(first.FichaIDs) != 1 {
		t.Fatalf("resultado: %+v", first)
	}
	var replay models.MemoryWriteResult
	a.Do(agent, http.MethodPost, path(p)+"/advances", body).Expect(t, http.StatusOK).JSON(t, &replay)
	if replay.Revision != first.Revision || *replay.LogID != *first.LogID || replay.FichaIDs[0] != first.FichaIDs[0] {
		t.Fatal("el reintento no devolvió el resultado original")
	}
	changed := advance("first-operation", 0)
	changed.Memoria.EnQueQuede = "Otro contenido"
	a.Do(agent, http.MethodPost, path(p)+"/advances", changed).Expect(t, http.StatusConflict)
	a.Do(agent, http.MethodPost, path(p)+"/advances", advance("stale-operation", 0)).Expect(t, http.StatusConflict)
	// Si la segunda ficha referencia otro proyecto, tampoco se guarda la primera
	// ficha ni la actualización del documento de memoria.
	var other models.MemoryWriteResult
	otherBody := advance("other-operation", 0)
	otherBody.Fichas = []models.MemoryEntryInput{entry("Otra ficha")}
	a.Do(u, http.MethodPost, path(p2)+"/advances", otherBody).Expect(t, http.StatusOK).JSON(t, &other)
	bad := advance("rollback-operation", 1)
	bad.Memoria.EnQueQuede = "Este texto debe revertirse"
	badEntry := entry("Reemplazo inválido")
	badEntry.SustituyeID = &other.FichaIDs[0]
	bad.Fichas = []models.MemoryEntryInput{entry("Tampoco se guarda"), badEntry}
	a.Do(agent, http.MethodPost, path(p)+"/advances", bad).Expect(t, http.StatusNotFound)
	var current models.MemoryContext
	a.Do(agent, http.MethodGet, path(p), nil).Expect(t, http.StatusOK).JSON(t, &current)
	if current.Revision != 1 || current.Memoria.EnQueQuede != body.Memoria.EnQueQuede || current.FichasVigentesTotal != 1 {
		t.Fatalf("guardado parcial: %+v", current)
	}
	var log models.ProjectLog
	a.Do(u, http.MethodGet, apitest.Path("/api/logs/%d", *first.LogID), nil).Expect(t, http.StatusOK).JSON(t, &log)
	if !strings.Contains(log.ContenidoRaw, body.Memoria.EnQueQuede) || strings.Contains(log.ContenidoRaw, "debe revertirse") {
		t.Fatal("la bitácora no refleja la transacción")
	}
	if !log.Gestionado {
		t.Fatal("la memoria no está marcada como log gestionado")
	}
	a.Do(u, http.MethodPut, apitest.Path("/api/logs/%d", *first.LogID), map[string]any{"contenido_raw": "evitar revisión"}).Expect(t, http.StatusConflict)
	a.Do(u, http.MethodDelete, apitest.Path("/api/logs/%d", *first.LogID), nil).Expect(t, http.StatusConflict)
	// Actualizar reutiliza la síntesis en la bitácora.
	update := advance("second-operation", 1)
	update.Memoria.EnQueQuede = "Segunda sesión comprobada"
	var next models.MemoryWriteResult
	a.Do(agent, http.MethodPost, path(p)+"/advances", update).Expect(t, http.StatusOK).JSON(t, &next)
	if next.Revision != 2 || *next.LogID != *first.LogID {
		t.Fatalf("actualización: %+v", next)
	}
	var count int
	if err := a.DB.QueryRow(context.Background(), `SELECT count(*) FROM documentos_proyecto WHERE proyecto_id=$1`, p).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("la memoria creó documentos: %d", count)
	}
	if err := a.DB.QueryRow(context.Background(), `SELECT count(*) FROM project_logs WHERE proyecto_id=$1`, p).Scan(&count); err != nil || count != 2 {
		t.Fatalf("logs duplicados o parciales: %d, %v", count, err)
	}
}

func TestMemoryRejectsInvalidAndOversizedInput(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	cases := map[string]func(*models.MemoryWriteRequest){
		"memoria larga":       func(r *models.MemoryWriteRequest) { r.Memoria.EnQueQuede = strings.Repeat("palabra ", 401) },
		"palabra gigante":     func(r *models.MemoryWriteRequest) { r.Memoria.EnQueQuede = strings.Repeat("a", 24001) },
		"sin revision":        func(r *models.MemoryWriteRequest) { r.RevisionEsperada = nil },
		"NUL":                 func(r *models.MemoryWriteRequest) { r.Memoria.EnQueQuede = "texto\x00inválido" },
		"sin fuentes":         func(r *models.MemoryWriteRequest) { r.Memoria.Fuentes = nil },
		"sin accion":          func(r *models.MemoryWriteRequest) { r.Memoria.QueSigue = nil },
		"demasiadas acciones": func(r *models.MemoryWriteRequest) { r.Memoria.QueSigue = []string{"a", "b", "c", "d"} },
		"ficha larga": func(r *models.MemoryWriteRequest) {
			e := entry("larga")
			e.Contenido = strings.Repeat("palabra ", 151)
			r.Fichas = []models.MemoryEntryInput{e}
		},
		"estado inventado": func(r *models.MemoryWriteRequest) {
			e := entry("estado")
			e.Estado = "completada"
			r.Fichas = []models.MemoryEntryInput{e}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			body := advance("invalid-operation", 0)
			mutate(&body)
			a.Do(u, http.MethodPost, path(p)+"/advances", body).Expect(t, http.StatusBadRequest)
		})
	}
	a.Do(u, http.MethodPost, path(p)+"/advances", `{"user_id":123}`).Expect(t, http.StatusBadRequest)
	a.Do(u, http.MethodPost, path(p)+"/advances", strings.Repeat(" ", 65536)+"{}").Expect(t, http.StatusRequestEntityTooLarge)
	past := time.Now().Add(-time.Hour)
	a.Do(u, http.MethodPost, "/api/api-keys", models.CreateAPIKeyRequest{Nombre: "Vencida", Scopes: []string{models.MemoryRead}, ProyectoIDs: []int{p}, ExpiraEn: &past}).Expect(t, http.StatusBadRequest)
}

func TestMemorySearchAndSupersededDecisions(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	body := advance("first-operation", 0)
	body.Fichas = []models.MemoryEntryInput{entry("Alternativa anterior"), entry("100% literal"), entry("Otra idea")}
	var first models.MemoryWriteResult
	a.Do(u, http.MethodPost, path(p)+"/advances", body).Expect(t, http.StatusOK).JSON(t, &first)
	replacement := advance("replace-operation", 1)
	e := entry("Decisión vigente")
	e.SustituyeID = &first.FichaIDs[0]
	replacement.Fichas = []models.MemoryEntryInput{e}
	a.Do(u, http.MethodPost, path(p)+"/advances", replacement).Expect(t, http.StatusOK)
	var found models.MemorySearchResult
	a.Do(u, http.MethodGet, path(p)+"/entries?q=anterior", nil).Expect(t, http.StatusOK).JSON(t, &found)
	if len(found.Fichas) != 0 {
		t.Fatal("una decisión sustituida aparece vigente")
	}
	a.Do(u, http.MethodGet, path(p)+"/entries?q=anterior&historico=true", nil).Expect(t, http.StatusOK).JSON(t, &found)
	if len(found.Fichas) != 1 || found.Fichas[0].Estado != "sustituida" {
		t.Fatalf("historial: %+v", found)
	}
	if found.Fichas[0].LogID == nil {
		t.Fatal("ficha histórica sin referencia a la bitácora")
	}
	var historicalLog models.ProjectLog
	a.Do(u, http.MethodGet, apitest.Path("/api/logs/%d", *found.Fichas[0].LogID), nil).Expect(t, http.StatusOK).JSON(t, &historicalLog)
	if !strings.Contains(historicalLog.ContenidoRaw, "Estado: **sustituida**") || !strings.Contains(historicalLog.ContenidoRaw, body.Fichas[0].Contenido) {
		t.Fatal("la bitácora debe conservar el contenido anterior e indicar que fue sustituido")
	}
	a.Do(u, http.MethodGet, path(p)+"/entries?q=%25", nil).Expect(t, http.StatusOK).JSON(t, &found)
	if len(found.Fichas) != 1 || found.Fichas[0].Titulo != "100% literal" {
		t.Fatal("la búsqueda no trató % como literal")
	}
	a.Do(u, http.MethodGet, path(p)+"/entries?limit=2", nil).Expect(t, http.StatusOK).JSON(t, &found)
	if len(found.Fichas) != 2 || !found.HayMas {
		t.Fatal("paginación incorrecta")
	}
	var oldLog models.ProjectLog
	if found.Fichas[0].LogID == nil {
		t.Fatal("ficha sin referencia a la bitácora")
	}
	a.Do(u, http.MethodGet, apitest.Path("/api/logs/%d", *found.Fichas[0].LogID), nil).Expect(t, http.StatusOK).JSON(t, &oldLog)
	if !strings.Contains(oldLog.ContenidoRaw, "Estado:") {
		t.Fatal("ficha sin estado legible")
	}
}

func TestConcurrentMemoryWritesDoNotOverwrite(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	start := make(chan struct{})
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for _, op := range []string{"concurrent-one", "concurrent-two"} {
		wg.Add(1)
		go func(op string) {
			defer wg.Done()
			data, _ := json.Marshal(advance(op, 0))
			req, _ := http.NewRequest(http.MethodPost, a.Server.URL+path(p)+"/advances", bytes.NewReader(data))
			req.Header.Set("Authorization", "Bearer "+u.Token)
			<-start
			res, err := a.Server.Client().Do(req)
			if err != nil {
				codes <- 0
				return
			}
			res.Body.Close()
			codes <- res.StatusCode
		}(op)
	}
	close(start)
	wg.Wait()
	first, second := <-codes, <-codes
	if !((first == 200 && second == 409) || (first == 409 && second == 200)) {
		t.Fatalf("escrituras concurrentes: %d, %d", first, second)
	}
}

func TestRealMCPClientThroughHTTPToPostgres(t *testing.T) {
	a := apitest.New(t, "memory")
	u := a.User("ana@memory.test")
	p := project(t, a, u, "A")
	k := key(t, a, u, []int{p}, models.MemoryRead, models.MemoryWrite)
	backend, err := memorymcp.NewClient(a.Server.URL, k.Token)
	if err != nil {
		t.Fatal(err)
	}
	server := memorymcp.NewServer(backend)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	st, ct := mcp.NewInMemoryTransports()
	ss, err := server.Connect(ctx, st, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "integration-test", Version: "1"}, nil)
	cs, err := client.Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	tools, err := cs.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools.Tools) != 4 {
		t.Fatalf("herramientas expuestas: %d", len(tools.Tools))
	}
	call := func(name string, args any) *mcp.CallToolResult {
		t.Helper()
		result, err := cs.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil || result.IsError {
			t.Fatalf("%s: err=%v result=%+v", name, err, result)
		}
		return result
	}
	call("obtener_contexto", memorymcp.ContextInput{ProyectoID: p})
	call("guardar_avance", memorymcp.AdvanceInput{ProyectoID: p, MemoryWriteRequest: advance("mcp-operation-one", 0)})
	revision := int64(1)
	call("registrar_decision", memorymcp.DecisionInput{ProyectoID: p, OperacionID: "mcp-operation-two", RevisionEsperada: &revision, Ficha: entry("Guardar contexto breve")})
	call("buscar_memoria", memorymcp.SearchInput{ProyectoID: p, Consulta: "breve"})
	var current models.MemoryContext
	a.Do(u, http.MethodGet, path(p), nil).Expect(t, http.StatusOK).JSON(t, &current)
	if current.Revision != 2 || current.Memoria == nil || current.FichasVigentesTotal != 1 {
		t.Fatalf("flujo incompleto: %+v", current)
	}
}
