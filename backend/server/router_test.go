package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"cassandra/config"
)

func TestVersionHandler(t *testing.T) {
	rec := httptest.NewRecorder()
	VersionHandler("v1.2.3")(rec, httptest.NewRequest(http.MethodGet, "/api/version", nil))

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || body["version"] != "v1.2.3" {
		t.Errorf("código=%d cuerpo=%v", rec.Code, body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q", ct)
	}
}

// Rutas públicas, protección de la API y fallback SPA, sin base de datos.
func TestRouterWithoutDatabase(t *testing.T) {
	frontend := fstest.MapFS{
		"index.html": {Data: []byte("<app-root></app-root>")},
		"main.js":    {Data: []byte("console.log(1)")},
	}
	cfg := &config.Config{JwtSecret: "test-secret-de-al-menos-32-caracteres!", RateLimitPerMin: 1000, AllowedOrigins: config.DefaultAllowedOrigins}
	h := NewRouter(Options{Config: cfg, Frontend: frontend, Version: "v9.9.9"})

	cases := []struct {
		path     string
		wantCode int
		contains string
	}{
		{"/api/health", http.StatusOK, `"ok"`},
		{"/api/version", http.StatusOK, `"v9.9.9"`},
		{"/api/proyects", http.StatusUnauthorized, ""},
		{"/api/no-existe", http.StatusNotFound, ""},
		{"/main.js", http.StatusOK, "console.log"},
		{"/proyectos/3", http.StatusOK, "<app-root>"}, // ruta de Angular → index.html
	}
	for _, c := range cases {
		t.Run(c.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
			if rec.Code != c.wantCode {
				t.Errorf("código = %d, se esperaba %d", rec.Code, c.wantCode)
			}
			if c.contains != "" && !strings.Contains(rec.Body.String(), c.contains) {
				t.Errorf("cuerpo = %q, debía contener %q", rec.Body.String(), c.contains)
			}
		})
	}
}
