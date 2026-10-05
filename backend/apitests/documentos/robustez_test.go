package documentos

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"cassandra/config"
	"cassandra/internal/apitest"
	"cassandra/server"
)

const indexHTML = "<!doctype html><html><body>SPA-INDEX</body></html>"

// conFrontend levanta el router real con un frontend embebido falso, para comprobar
// que /api/... inexistente no cae al fallback de la SPA.
func conFrontend(t *testing.T, api *apitest.API) *httptest.Server {
	t.Helper()
	cfg := &config.Config{JwtSecret: apitest.JWTSecret, RateLimitPerMin: 1_000_000, AllowedOrigins: config.DefaultAllowedOrigins}
	dist := fstest.MapFS{
		"index.html": {Data: []byte(indexHTML)},
		"main.js":    {Data: []byte("console.log('main')")},
	}
	srv := httptest.NewServer(server.NewRouter(server.Options{Config: cfg, DB: api.DB, Frontend: dist, Version: "vtest"}))
	t.Cleanup(srv.Close)
	return srv
}

func get(t *testing.T, srv *httptest.Server, method, path string, headers ...string) (int, http.Header, string) {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, res.Header, string(b)
}

func TestRutasAPIInexistentes404SinIndex(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	srv := conFrontend(t, api)

	for _, p := range []string{
		"/api/no-existe", "/api/documentos", "/api/documentos/1/extra", "/api/proyects/1/documentos/2",
		"/api/auth", "/api/auth/no-existe", "/api/v2/proyects", "/api/no-existe.js", "/api/main.js",
	} {
		for _, auth := range []string{"", "Bearer " + ana.Token} {
			var status int
			var body string
			if auth == "" {
				status, _, body = get(t, srv, http.MethodGet, p)
			} else {
				status, _, body = get(t, srv, http.MethodGet, p, "Authorization", auth)
			}
			if status != http.StatusNotFound {
				t.Errorf("GET %s (auth=%v): código %d, se esperaba 404", p, auth != "", status)
			}
			if strings.Contains(body, "SPA-INDEX") || strings.Contains(strings.ToLower(body), "<html") {
				t.Errorf("GET %s devolvió el index.html de la SPA", p)
			}
		}
	}

	// Control: las rutas no-API sí caen a la SPA y los estáticos se sirven.
	if status, _, body := get(t, srv, http.MethodGet, "/proyectos/1/documentos"); status != http.StatusOK || !strings.Contains(body, "SPA-INDEX") {
		t.Errorf("ruta SPA: %d %q", status, body)
	}
	if status, _, body := get(t, srv, http.MethodGet, "/main.js"); status != http.StatusOK || !strings.Contains(body, "main") {
		t.Errorf("estático: %d %q", status, body)
	}
	// Y la API real sigue respondiendo con el frontend montado.
	if status, _, _ := get(t, srv, http.MethodGet, "/api/health"); status != http.StatusOK {
		t.Errorf("/api/health = %d", status)
	}
}

var metodosNoPermitidos = []struct{ m, p string }{
	{http.MethodPatch, "/api/documentos/%d"},
	{http.MethodPost, "/api/documentos/%d"},
	{http.MethodPut, "/api/proyects/%d/documentos"},
	{http.MethodDelete, "/api/proyects/%d/documentos"},
	{http.MethodGet, "/api/auth/login"},
	{http.MethodGet, "/api/auth/logout"},
	{http.MethodPost, "/api/auth/me"},
	{http.MethodDelete, "/api/health"},
}

func rutaMetodo(format string, docID, proyectoID int) string {
	switch {
	case strings.HasPrefix(format, "/api/documentos"):
		return apitest.Path(format, docID)
	case strings.Contains(format, "%d"):
		return apitest.Path(format, proyectoID)
	}
	return format
}

// TestMetodosNoPermitidos_NoTocanNada exige que un método no registrado no llegue a
// ningún handler: 4xx y el documento intacto.
func TestMetodosNoPermitidos_NoTocanNada(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "intacto"})

	for _, c := range metodosNoPermitidos {
		path := rutaMetodo(c.p, d.ID, p)
		for _, u := range []*apitest.User{nil, ana} {
			expect4xx(t, api.Do(u, c.m, path, map[string]any{"titulo": "x", "eliminado": true}), c.m+" "+path)
		}
	}
	if got := getDoc(t, api, ana, d.ID); got.Titulo != "intacto" || got.Eliminado {
		t.Errorf("documento modificado por métodos no permitidos: %+v", got)
	}
}

func TestMetodosNoPermitidos(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")
	d := crearDoc(t, api, ana, p, map[string]any{"titulo": "intacto"})

	for _, c := range metodosNoPermitidos {
		path := rutaMetodo(c.p, d.ID, p)
		for _, u := range []*apitest.User{nil, ana} {
			res := api.Do(u, c.m, path, nil)
			if res.Status != http.StatusMethodNotAllowed {
				t.Errorf("%s %s (auth=%v): código %d, se esperaba 405; cuerpo: %s", c.m, path, u != nil, res.Status, res.Body)
			}
		}
	}
	if got := getDoc(t, api, ana, d.ID); got.Titulo != "intacto" || got.Eliminado {
		t.Errorf("documento modificado por métodos no permitidos: %+v", got)
	}
}

func TestCORS(t *testing.T) {
	api := apitest.New(t, "documentos")
	srv := api.Server

	preflight := func(origin, method string) (int, http.Header) {
		status, h, _ := get(t, srv, http.MethodOptions, "/api/proyects",
			"Origin", origin,
			"Access-Control-Request-Method", method,
			"Access-Control-Request-Headers", "content-type,authorization")
		return status, h
	}

	for _, origin := range []string{"http://localhost:4200", "capacitor://localhost"} {
		for _, m := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete} {
			status, h := preflight(origin, m)
			if status >= 300 {
				t.Errorf("preflight %s %s: código %d", origin, m, status)
			}
			if got := h.Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("preflight %s %s: Allow-Origin = %q", origin, m, got)
			}
			if got := h.Get("Access-Control-Allow-Credentials"); got != "true" {
				t.Errorf("preflight %s: Allow-Credentials = %q", origin, got)
			}
			if got := strings.ToUpper(h.Get("Access-Control-Allow-Methods")); !strings.Contains(got, m) {
				t.Errorf("preflight %s %s: Allow-Methods = %q", origin, m, got)
			}
			ah := strings.ToLower(h.Get("Access-Control-Allow-Headers"))
			if !strings.Contains(ah, "authorization") || !strings.Contains(ah, "content-type") {
				t.Errorf("preflight %s: Allow-Headers = %q", origin, ah)
			}
		}
		// Petición real desde el origen permitido.
		_, h, _ := get(t, srv, http.MethodGet, "/api/health", "Origin", origin)
		if h.Get("Access-Control-Allow-Origin") != origin || h.Get("Access-Control-Allow-Credentials") != "true" {
			t.Errorf("GET simple desde %s: cabeceras CORS %v", origin, h)
		}
	}

	for _, origin := range []string{"https://evil.example", "http://localhost:4200.evil.example", "null", "http://localhost:4201"} {
		_, h := preflight(origin, http.MethodPost)
		if got := h.Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("preflight desde %s permitido: Allow-Origin = %q", origin, got)
		}
		if got := h.Get("Access-Control-Allow-Credentials"); got == "true" {
			t.Errorf("preflight desde %s concede credenciales", origin)
		}
		_, h, _ = get(t, srv, http.MethodGet, "/api/health", "Origin", origin)
		if got := h.Get("Access-Control-Allow-Origin"); got != "" || h.Get("Access-Control-Allow-Credentials") == "true" {
			t.Errorf("GET desde %s: Allow-Origin = %q", origin, got)
		}
	}

	// Método no listado en CORS.
	if _, h := preflight("http://localhost:4200", "TRACE"); h.Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("preflight con TRACE permitido")
	}
}
