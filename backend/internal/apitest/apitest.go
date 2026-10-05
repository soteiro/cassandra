// Package apitest levanta la API completa (router real + PostgreSQL de test) para
// tests de integración por HTTP. Cada paquete de tests usa su propia base:
//
//	api := apitest.New(t, "proyectos")
//	ana := api.User("ana@cassandra.test")
//	res := api.Do(ana, http.MethodPost, "/api/proyects", map[string]any{"nombre": "X", ...})
//	res.Expect(t, http.StatusCreated)
//	var p models.ProyectResponse
//	res.JSON(t, &p)
package apitest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"cassandra/config"
	"cassandra/internal/admin"
	"cassandra/internal/testdb"
	"cassandra/repository"
	"cassandra/server"
	"cassandra/utils"

	"github.com/jackc/pgx/v5/pgxpool"
)

// JWTSecret es el secreto de los tokens de test.
const JWTSecret = "apitest-jwt-secret-de-al-menos-32-caracteres"

// API es un servidor de test con la base vacía.
type API struct {
	DB     *pgxpool.Pool
	Server *httptest.Server
	t      *testing.T
}

// User es un usuario creado en la base de test, con su token de acceso.
type User struct {
	ID    int
	Email string
	Token string
}

// New crea la API sobre la base cassandra_test_<name>, con todas las tablas vacías.
func New(t *testing.T, name string) *API {
	t.Helper()
	db := testdb.New(t, name)
	cfg := &config.Config{
		JwtSecret:       JWTSecret,
		RateLimitPerMin: 1_000_000,
		AllowedOrigins:  config.DefaultAllowedOrigins,
	}
	srv := httptest.NewServer(server.NewRouter(server.Options{Config: cfg, DB: db, Version: "vtest"}))
	t.Cleanup(srv.Close)
	return &API{DB: db, Server: srv, t: t}
}

// User crea un usuario (con su persona "yo", igual que el CLI) y devuelve su token.
func (a *API) User(email string) *User {
	a.t.Helper()
	u, err := admin.CreateUser(context.Background(), repository.NewUserRepository(a.DB),
		admin.NewUser{Nombre: strings.Split(email, "@")[0], Email: email, Password: "clave-de-test-123"})
	if err != nil {
		a.t.Fatalf("apitest: creando usuario %s: %v", email, err)
	}
	token, err := utils.GenerateAccessToken(u.ID, JWTSecret)
	if err != nil {
		a.t.Fatal(err)
	}
	return &User{ID: u.ID, Email: u.Email, Token: token}
}

// Response es la respuesta de una petición de test.
type Response struct {
	Status int
	Body   []byte
	Header http.Header
	method string
	path   string
}

// Do envía una petición. user nil = sin autenticación. body puede ser nil, un string
// (se envía tal cual, útil para JSON inválido) o cualquier valor serializable a JSON.
func (a *API) Do(user *User, method, path string, body any) *Response {
	a.t.Helper()
	var reader io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		reader = strings.NewReader(b)
	default:
		data, err := json.Marshal(b)
		if err != nil {
			a.t.Fatal(err)
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, a.Server.URL+path, reader)
	if err != nil {
		a.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if user != nil {
		req.Header.Set("Authorization", "Bearer "+user.Token)
	}
	res, err := a.Server.Client().Do(req)
	if err != nil {
		a.t.Fatalf("apitest: %s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		a.t.Fatal(err)
	}
	return &Response{Status: res.StatusCode, Body: data, Header: res.Header, method: method, path: path}
}

// Expect falla el test si el código no es el esperado (muestra el cuerpo para depurar).
func (r *Response) Expect(t *testing.T, status int) *Response {
	t.Helper()
	if r.Status != status {
		t.Fatalf("%s %s: código %d, se esperaba %d; cuerpo: %s", r.method, r.path, r.Status, status, truncate(r.Body))
	}
	return r
}

// JSON decodifica el cuerpo en v.
func (r *Response) JSON(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("%s %s: cuerpo no es JSON válido para %T: %v; cuerpo: %s", r.method, r.path, v, err, truncate(r.Body))
	}
}

// ID extrae el campo "id" de una respuesta JSON de objeto.
func (r *Response) ID(t *testing.T) int {
	t.Helper()
	var v struct {
		ID int `json:"id"`
	}
	r.JSON(t, &v)
	if v.ID == 0 {
		t.Fatalf("%s %s: la respuesta no tiene id; cuerpo: %s", r.method, r.path, truncate(r.Body))
	}
	return v.ID
}

// Path arma rutas con formato: api.Path("/api/proyects/%d", id).
func Path(format string, args ...any) string { return fmt.Sprintf(format, args...) }

func truncate(b []byte) string {
	const max = 500
	if len(b) > max {
		return string(b[:max]) + "…"
	}
	return string(b)
}
