package middleware

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"cassandra/utils"
)

const secret = "test-secret"

// run ejecuta el middleware y devuelve el código de respuesta y el userID que vio el handler.
func run(t *testing.T, req *http.Request) (int, int) {
	t.Helper()
	seen := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, ok := GetUserIDFromContext(r.Context())
		if !ok {
			t.Error("el userID no llegó al contexto")
		}
		seen = id
		w.WriteHeader(http.StatusTeapot)
	})
	rec := httptest.NewRecorder()
	AuthMiddleware(secret)(next).ServeHTTP(rec, req)
	return rec.Code, seen
}

func token(t *testing.T, id int, key string) string {
	t.Helper()
	s, err := utils.GenerateAccessToken(id, key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAuthMiddleware(t *testing.T) {
	valid := token(t, 7, secret)
	foreign := token(t, 7, "otro-secreto")

	cases := []struct {
		name     string
		header   string
		cookie   string
		wantCode int
		wantID   int
	}{
		{"sin token", "", "", http.StatusUnauthorized, 0},
		{"bearer válido", "Bearer " + valid, "", http.StatusTeapot, 7},
		{"cookie válida", "", valid, http.StatusTeapot, 7},
		{"bearer de otro secreto", "Bearer " + foreign, "", http.StatusUnauthorized, 0},
		{"cookie inválida", "", "basura", http.StatusUnauthorized, 0},
		// El header es autoritativo: si viene mal formado no se usa la cookie.
		{"header mal formado con cookie válida", "Token " + valid, valid, http.StatusUnauthorized, 0},
		{"bearer vacío con cookie válida", "Bearer ", valid, http.StatusUnauthorized, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/proyects", nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}
			if c.cookie != "" {
				req.AddCookie(&http.Cookie{Name: "access_token", Value: c.cookie})
			}
			code, id := run(t, req)
			if code != c.wantCode || id != c.wantID {
				t.Errorf("código=%d id=%d, se esperaba código=%d id=%d", code, id, c.wantCode, c.wantID)
			}
		})
	}
}

func TestGetUserIDFromContextWithoutValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if _, ok := GetUserIDFromContext(req.Context()); ok {
		t.Error("no debería haber userID en un contexto vacío")
	}
}

func TestAuthMiddlewareDoesNotLogTokens(t *testing.T) {
	var logs bytes.Buffer
	prev := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(prev) })

	foreign := token(t, 7, "otro-secreto")
	req := httptest.NewRequest(http.MethodGet, "/api/proyects", nil)
	req.Header.Set("Authorization", "Bearer "+foreign)
	run(t, req)

	if strings.Contains(logs.String(), foreign) {
		t.Errorf("el log contiene el token completo:\n%s", logs.String())
	}
	if !strings.Contains(logs.String(), "token inválido") {
		t.Errorf("se esperaba un log del rechazo; logs:\n%s", logs.String())
	}
}
