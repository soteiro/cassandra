package documentos

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

// --- Aislamiento entre usuarios ---

func TestAislamiento_LecturaYEdicionAjenas(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	pA := crearProyecto(t, api, ana, "Proyecto de Ana")
	doc := crearDoc(t, api, ana, pA, map[string]any{"titulo": "Secreto", "contenido": "solo Ana", "tipo": "decision"})

	expectAjeno(t, api.Do(beto, http.MethodGet, apitest.Path("/api/documentos/%d", doc.ID), nil), "GET doc ajeno")
	expectAjeno(t, api.Do(beto, http.MethodPut, apitest.Path("/api/documentos/%d", doc.ID),
		map[string]any{"titulo": "hackeado", "contenido": "x"}), "PUT doc ajeno")
	expectAjeno(t, api.Do(beto, http.MethodPut, apitest.Path("/api/documentos/%d", doc.ID),
		map[string]any{"eliminado": true}), "PUT eliminado=true en doc ajeno")

	// Listado anidado del proyecto de Ana: puede ser 403/404 o 200 vacío, pero sin datos.
	res := api.Do(beto, http.MethodGet, apitest.Path("/api/proyects/%d/documentos", pA), nil)
	switch res.Status {
	case http.StatusForbidden, http.StatusNotFound:
	case http.StatusOK:
		var ds []models.DocumentoResponse
		res.JSON(t, &ds)
		if len(ds) != 0 {
			t.Errorf("Beto ve %d documentos del proyecto de Ana: %s", len(ds), res.Body)
		}
	default:
		t.Errorf("listado ajeno: código %d; cuerpo: %s", res.Status, res.Body)
	}
	if strings.Contains(string(res.Body), "Secreto") {
		t.Errorf("el listado filtra el documento de Ana: %s", res.Body)
	}

	// El documento de Ana sigue intacto.
	got := getDoc(t, api, ana, doc.ID)
	if got.Titulo != "Secreto" || got.Contenido != "solo Ana" || got.Eliminado {
		t.Errorf("documento de Ana modificado: %+v", got)
	}
	if !got.FechaActualizacion.Equal(doc.FechaActualizacion) {
		t.Errorf("fecha_actualizacion cambió por un intento ajeno: %v -> %v", doc.FechaActualizacion, got.FechaActualizacion)
	}
}

func TestAislamiento_BorrarDocAjeno(t *testing.T) {
	bug(t, "DELETE /api/documentos/{id} ajeno o inexistente responde 500 en vez de 404")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	pA := crearProyecto(t, api, ana, "Proyecto de Ana")
	doc := crearDoc(t, api, ana, pA, map[string]any{"titulo": "Secreto", "contenido": "solo Ana"})

	expectAjeno(t, api.Do(beto, http.MethodDelete, apitest.Path("/api/documentos/%d", doc.ID), nil), "DELETE doc ajeno")
	if got := getDoc(t, api, ana, doc.ID); got.Eliminado || got.Titulo != "Secreto" {
		t.Errorf("documento de Ana modificado: %+v", got)
	}
}

func TestAislamiento_BorrarDocAjenoNoLoBorra(t *testing.T) {
	// Independiente del código devuelto (ver TestAislamiento_BorrarDocAjeno): no debe borrarse.
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	pA := crearProyecto(t, api, ana, "Proyecto de Ana")
	doc := crearDoc(t, api, ana, pA, map[string]any{"titulo": "Secreto", "contenido": "solo Ana"})

	res := api.Do(beto, http.MethodDelete, apitest.Path("/api/documentos/%d", doc.ID), nil)
	if res.Status < 400 {
		t.Errorf("DELETE ajeno respondió %d", res.Status)
	}
	if got := getDoc(t, api, ana, doc.ID); got.Eliminado {
		t.Errorf("Beto borró el documento de Ana")
	}
}

func TestAislamiento_CrearDocEnProyectoAjeno(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	pA := crearProyecto(t, api, ana, "Proyecto de Ana")
	pB := crearProyecto(t, api, beto, "Proyecto de Beto")

	expectAjeno(t, api.Do(beto, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", pA),
		map[string]any{"titulo": "intruso", "contenido": "x"}), "POST doc en proyecto ajeno")

	// El proyecto_id del cuerpo tampoco debe servir para colarse (la URL manda).
	var d models.DocumentoResponse
	api.Do(beto, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", pB),
		map[string]any{"titulo": "propio", "proyecto_id": pA}).Expect(t, http.StatusCreated).JSON(t, &d)
	if d.ProyectoID != pB {
		t.Errorf("proyecto_id del cuerpo prevaleció sobre la URL: %d", d.ProyectoID)
	}

	var n int
	if err := api.DB.QueryRow(t.Context(),
		`SELECT count(*) FROM documentos_proyecto WHERE proyecto_id = $1 AND user_id <> $2`, pA, ana.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("hay %d documentos de otro usuario dentro del proyecto de Ana", n)
	}
}

func TestAislamiento_ListadoSoloPropio(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	pA := crearProyecto(t, api, ana, "A")
	pB := crearProyecto(t, api, beto, "B")
	crearDoc(t, api, ana, pA, map[string]any{"titulo": "de Ana"})
	crearDoc(t, api, beto, pB, map[string]any{"titulo": "de Beto"})

	if ds := listDocs(t, api, ana, apitest.Path("/api/proyects/%d/documentos", pA)); len(ds) != 1 || ds[0].Titulo != "de Ana" {
		t.Errorf("listado de Ana = %+v", ds)
	}
	if ds := listDocs(t, api, ana, apitest.Path("/api/proyects/%d/documentos", pB)); len(ds) != 0 {
		t.Errorf("Ana ve documentos del proyecto de Beto: %+v", ds)
	}
}

func TestSinAutenticacion(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	pA := crearProyecto(t, api, ana, "A")
	doc := crearDoc(t, api, ana, pA, map[string]any{"titulo": "t"})

	for _, c := range []struct{ m, p string }{
		{http.MethodGet, apitest.Path("/api/proyects/%d/documentos", pA)},
		{http.MethodPost, apitest.Path("/api/proyects/%d/documentos", pA)},
		{http.MethodGet, apitest.Path("/api/documentos/%d", doc.ID)},
		{http.MethodPut, apitest.Path("/api/documentos/%d", doc.ID)},
		{http.MethodDelete, apitest.Path("/api/documentos/%d", doc.ID)},
	} {
		api.Do(nil, c.m, c.p, nil).Expect(t, http.StatusUnauthorized)
	}
}

// --- CRUD feliz ---

func TestCRUD(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")

	tags := "go,tests"
	creado := crearDoc(t, api, ana, p, map[string]any{
		"titulo": "  Arquitectura v1  ", "contenido": "Contenido inicial", "tipo": "arquitectura", "tags": tags,
	})
	if creado.ID == 0 || creado.ProyectoID != p || creado.UserID != ana.ID {
		t.Fatalf("creado = %+v", creado)
	}
	if creado.Titulo != "Arquitectura v1" {
		t.Errorf("titulo no recortado: %q", creado.Titulo)
	}
	if creado.Tipo != "arquitectura" || creado.Tags == nil || *creado.Tags != tags || creado.Eliminado {
		t.Errorf("creado = %+v", creado)
	}

	// Tipo por defecto.
	if d := crearDoc(t, api, ana, p, map[string]any{"titulo": "sin tipo"}); d.Tipo != "general" {
		t.Errorf("tipo por defecto = %q, se esperaba general", d.Tipo)
	}

	leido := getDoc(t, api, ana, creado.ID)
	if leido.Titulo != creado.Titulo || leido.Contenido != creado.Contenido || !leido.FechaCreacion.Equal(creado.FechaCreacion) {
		t.Errorf("GET = %+v, creado = %+v", leido, creado)
	}

	esperar()
	var upd models.DocumentoResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", creado.ID),
		map[string]any{"titulo": "Arquitectura v2", "tipo": "decision"}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Titulo != "Arquitectura v2" || upd.Tipo != "decision" {
		t.Errorf("PUT = %+v", upd)
	}
	if upd.Contenido != "Contenido inicial" || upd.Tags == nil || *upd.Tags != tags {
		t.Errorf("PUT parcial pisó campos no enviados: %+v", upd)
	}
	if !upd.FechaActualizacion.After(creado.FechaActualizacion) {
		t.Errorf("fecha_actualizacion no avanzó: %v -> %v", creado.FechaActualizacion, upd.FechaActualizacion)
	}
	if !upd.FechaCreacion.Equal(creado.FechaCreacion) {
		t.Errorf("fecha_creacion cambió en PUT")
	}

	tras := getDoc(t, api, ana, creado.ID)
	if tras.Titulo != "Arquitectura v2" || tras.Tipo != "decision" || !tras.FechaActualizacion.Equal(upd.FechaActualizacion) {
		t.Errorf("GET tras PUT = %+v", tras)
	}

	api.Do(ana, http.MethodDelete, apitest.Path("/api/documentos/%d", creado.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodGet, apitest.Path("/api/documentos/%d", creado.ID), nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", creado.ID),
		map[string]any{"titulo": "resucitado"}).Expect(t, http.StatusNotFound)
	for _, d := range listDocs(t, api, ana, apitest.Path("/api/proyects/%d/documentos", p)) {
		if d.ID == creado.ID {
			t.Errorf("documento borrado sigue en el listado")
		}
	}
}

func TestBorrarDosVeces(t *testing.T) {
	bug(t, "DELETE de un documento ya borrado/inexistente responde 500 en vez de 404")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "t"})

	api.Do(ana, http.MethodDelete, apitest.Path("/api/documentos/%d", d.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(ana, http.MethodDelete, apitest.Path("/api/documentos/%d", d.ID), nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodDelete, "/api/documentos/999999", nil).Expect(t, http.StatusNotFound)
}

// --- Validaciones ---

func TestValidaciones(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "original", "contenido": "c"})
	docPath := apitest.Path("/api/documentos/%d", d.ID)
	listPath := apitest.Path("/api/proyects/%d/documentos", p)

	api.Do(ana, http.MethodPost, listPath, "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, listPath, `{"titulo": 123}`).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, listPath, map[string]any{"titulo": ""}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, listPath, map[string]any{"titulo": "   \t\n"}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPost, listPath, map[string]any{"contenido": "sin título"}).Expect(t, http.StatusBadRequest)

	api.Do(ana, http.MethodPut, docPath, "{json roto").Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, docPath, map[string]any{"titulo": "  "}).Expect(t, http.StatusBadRequest)

	for _, id := range []string{"abc", "0", "-1", "1.5", "99999999999999999999"} {
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/documentos/"+id, nil), "GET id "+id)
		expect4xx(t, api.Do(ana, http.MethodPut, "/api/documentos/"+id, map[string]any{"titulo": "x"}), "PUT id "+id)
		expect4xx(t, api.Do(ana, http.MethodDelete, "/api/documentos/"+id, nil), "DELETE id "+id)
		expect4xx(t, api.Do(ana, http.MethodGet, "/api/proyects/"+id+"/documentos", nil), "GET listado proyecto "+id)
		expect4xx(t, api.Do(ana, http.MethodPost, "/api/proyects/"+id+"/documentos", map[string]any{"titulo": "x"}), "POST proyecto "+id)
	}
	api.Do(ana, http.MethodGet, "/api/documentos/999999", nil).Expect(t, http.StatusNotFound)
	api.Do(ana, http.MethodPut, "/api/documentos/999999", map[string]any{"titulo": "x"}).Expect(t, http.StatusNotFound)

	// Nada de lo anterior tocó el documento.
	if got := getDoc(t, api, ana, d.ID); got.Titulo != "original" || got.Contenido != "c" {
		t.Errorf("documento modificado por peticiones inválidas: %+v", got)
	}
}

func TestValidacion_TipoFueraDelCheck(t *testing.T) {
	bug(t, "un tipo fuera del CHECK (p. ej. \"receta\") en POST/PUT de documentos llega a la BD y responde 500 en vez de 400")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "t", "tipo": "idea"})

	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", p),
		map[string]any{"titulo": "x", "tipo": "receta"}).Expect(t, http.StatusBadRequest)
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", d.ID),
		map[string]any{"tipo": "receta"}).Expect(t, http.StatusBadRequest)
	if got := getDoc(t, api, ana, d.ID); got.Tipo != "idea" {
		t.Errorf("tipo cambiado a %q", got.Tipo)
	}
}

func TestValidacion_ProyectoInexistente(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	api.Do(ana, http.MethodPost, "/api/proyects/999999/documentos",
		map[string]any{"titulo": "x"}).Expect(t, http.StatusNotFound)
}

func TestValidacion_IDFueraDeRangoInt4(t *testing.T) {
	bug(t, "ids que caben en int de Go pero no en INTEGER de Postgres (2147483648) responden 500 en vez de 400/404")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	expect4xx(t, api.Do(ana, http.MethodGet, "/api/documentos/2147483648", nil), "GET id 2^31")
	expect4xx(t, api.Do(ana, http.MethodPut, "/api/documentos/2147483648", map[string]any{"titulo": "x"}), "PUT id 2^31")
	expect4xx(t, api.Do(ana, http.MethodGet, "/api/proyects/2147483648/documentos", nil), "GET listado id 2^31")
}

func TestTodosLosTiposValidos(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	for _, tipo := range []string{"arquitectura", "investigacion", "decision", "guia", "idea", "pajas mentales", "general"} {
		if d := crearDoc(t, api, ana, p, map[string]any{"titulo": "doc " + tipo, "tipo": tipo}); d.Tipo != tipo {
			t.Errorf("tipo %q guardado como %q", tipo, d.Tipo)
		}
	}
}

// --- Filtro por tipo ---

func TestFiltroPorTipo(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	otro := crearProyecto(t, api, ana, "Otro")

	crearDoc(t, api, ana, p, map[string]any{"titulo": "d1", "tipo": "decision"})
	crearDoc(t, api, ana, p, map[string]any{"titulo": "d2", "tipo": "decision"})
	crearDoc(t, api, ana, p, map[string]any{"titulo": "i1", "tipo": "idea"})
	crearDoc(t, api, ana, p, map[string]any{"titulo": "pm", "tipo": "pajas mentales"})
	crearDoc(t, api, ana, otro, map[string]any{"titulo": "d-otro", "tipo": "decision"})
	borrado := crearDoc(t, api, ana, p, map[string]any{"titulo": "d-borrado", "tipo": "decision"})
	api.Do(ana, http.MethodDelete, apitest.Path("/api/documentos/%d", borrado.ID), nil).Expect(t, http.StatusNoContent)

	base := apitest.Path("/api/proyects/%d/documentos", p)
	cuenta := func(q string) []models.DocumentoResponse { return listDocs(t, api, ana, base+q) }

	if ds := cuenta("?tipo=decision"); len(ds) != 2 {
		t.Errorf("tipo=decision: %d docs, se esperaban 2: %+v", len(ds), ds)
	} else {
		for _, d := range ds {
			if d.Tipo != "decision" || d.ProyectoID != p {
				t.Errorf("filtro devolvió %+v", d)
			}
		}
	}
	if ds := cuenta("?tipo=pajas%20mentales"); len(ds) != 1 || ds[0].Titulo != "pm" {
		t.Errorf("tipo=pajas mentales: %+v", ds)
	}
	for _, q := range []string{"", "?tipo=", "?tipo=todos", "?tipo=todas"} {
		if ds := cuenta(q); len(ds) != 4 {
			t.Errorf("listado %q: %d docs, se esperaban 4", q, len(ds))
		}
	}
	if ds := cuenta("?tipo=inexistente"); len(ds) != 0 {
		t.Errorf("tipo=inexistente devolvió %d docs", len(ds))
	}
	// Inyección en el filtro: parametrizado, no debe romper ni devolver de más.
	if ds := cuenta("?tipo=" + "decision'%20OR%20'1'='1"); len(ds) != 0 {
		t.Errorf("filtro con comillas devolvió %d docs", len(ds))
	}
}

// --- Contenido íntegro ---

func TestContenidoMarkdownLargoYEspecial(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")

	especial := "# Título con ñ, tildes áéíóú y emoji 🚀\n\n" +
		"```go\nfunc main() {\n\tfmt.Println(\"hola \\\"mundo\\\"\")\n}\n```\n\n" +
		"| a | b |\n|---|---|\n| <script>alert(1)</script> | 'comillas' \"dobles\" |\n\n" +
		"Barra invertida \\ y \\n literal, %s %d, $1, ${x}, `backticks`, NUL-free     中文 العربية\n" +
		"- [ ] tarea\n  - anidada\n\n> cita\n"
	largo := especial + strings.Repeat("Lorem ipsum dolor sit amet, línea larga ñ. ", 25000) + "\nFIN"
	if len(largo) < 1_000_000 {
		t.Fatalf("contenido de prueba demasiado corto: %d", len(largo))
	}

	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "Título <b>raro</b> & 'x' \"y\" 🚀", "contenido": largo, "tipo": "guia"})
	got := getDoc(t, api, ana, d.ID)
	if got.Contenido != largo {
		t.Errorf("contenido alterado al crear: len %d vs %d", len(got.Contenido), len(largo))
	}
	if got.Titulo != "Título <b>raro</b> & 'x' \"y\" 🚀" {
		t.Errorf("título alterado: %q", got.Titulo)
	}

	// Por PUT también.
	nuevo := especial + "\nversión 2"
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", d.ID), map[string]any{"contenido": nuevo}).Expect(t, http.StatusOK)
	if got := getDoc(t, api, ana, d.ID); got.Contenido != nuevo {
		t.Errorf("contenido alterado al actualizar:\n%q\n%q", got.Contenido, nuevo)
	}

	// Y en el listado.
	ds := listDocs(t, api, ana, apitest.Path("/api/proyects/%d/documentos", p))
	if len(ds) != 1 || ds[0].Contenido != nuevo {
		t.Errorf("contenido alterado en el listado")
	}
}

func TestContenidoVacioPermitido(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "solo título"})
	if d.Contenido != "" {
		t.Errorf("contenido = %q", d.Contenido)
	}
	// Vaciar el contenido por PUT.
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", d.ID), map[string]any{"contenido": "algo"}).Expect(t, http.StatusOK)
	var upd models.DocumentoResponse
	api.Do(ana, http.MethodPut, apitest.Path("/api/documentos/%d", d.ID), map[string]any{"contenido": ""}).Expect(t, http.StatusOK).JSON(t, &upd)
	if upd.Contenido != "" {
		t.Errorf("no se pudo vaciar el contenido: %q", upd.Contenido)
	}
}
