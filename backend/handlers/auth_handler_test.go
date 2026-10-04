package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"cassandra/internal/testdb"
	"cassandra/repository"
	"cassandra/utils"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	testSecret   = "test-jwt-secret"
	testEmail    = "ada@cassandra.test"
	testPassword = "clave-segura"
)

type authEnv struct {
	db      *pgxpool.Pool
	handler *AuthHandler
	userID  int
}

func newAuthEnv(t *testing.T) *authEnv {
	t.Helper()
	db := testdb.New(t, "handlers")
	env := &authEnv{
		db:      db,
		handler: NewAuthHandler(repository.NewUserRepository(db), repository.NewAuthRepository(db), testSecret),
	}
	env.userID = env.insertUser(t, testEmail, testPassword, "ada", false)
	return env
}

// insertUser crea un usuario directamente en la base. alias vacío se guarda como NULL.
func (e *authEnv) insertUser(t *testing.T, email, password, alias string, eliminado bool) int {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	var aliasArg any
	if alias != "" {
		aliasArg = alias
	}
	var id int
	err = e.db.QueryRow(context.Background(),
		`INSERT INTO users (nombre, alias, email, password, eliminado) VALUES ('Test', $1, $2, $3, $4) RETURNING id`,
		aliasArg, email, string(hash), eliminado).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (e *authEnv) refreshTokenCount(t *testing.T) int {
	t.Helper()
	var n int
	if err := e.db.QueryRow(context.Background(), `SELECT count(*) FROM refresh_tokens`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func login(t *testing.T, h *AuthHandler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.Login(rec, req)
	return rec
}

func loginBody(email, password string) string {
	b, _ := json.Marshal(map[string]string{"email": email, "password": password})
	return string(b)
}

func cookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// --- Login ---

func TestLoginOK(t *testing.T) {
	env := newAuthEnv(t)
	rec := login(t, env.handler, loginBody(testEmail, testPassword))

	if rec.Code != http.StatusOK {
		t.Fatalf("código = %d, cuerpo = %q", rec.Code, rec.Body.String())
	}
	access := cookie(rec, "access_token")
	refresh := cookie(rec, "refresh_token")
	if access == nil || refresh == nil {
		t.Fatal("faltan las cookies access_token / refresh_token")
	}
	if !access.HttpOnly || !refresh.HttpOnly {
		t.Error("las cookies de sesión deben ser HttpOnly")
	}
	if id, err := utils.ValidateAccessToken(access.Value, testSecret); err != nil || id != env.userID {
		t.Errorf("access token inválido: id=%d err=%v", id, err)
	}
	if n := env.refreshTokenCount(t); n != 1 {
		t.Errorf("refresh tokens en DB = %d, se esperaba 1", n)
	}
}

func TestLoginUserWithoutAlias(t *testing.T) {
	// Regresión: users.alias admite NULL y antes impedía iniciar sesión.
	env := newAuthEnv(t)
	env.insertUser(t, "sin-alias@cassandra.test", testPassword, "", false)

	if rec := login(t, env.handler, loginBody("sin-alias@cassandra.test", testPassword)); rec.Code != http.StatusOK {
		t.Errorf("código = %d, se esperaba 200", rec.Code)
	}
}

func TestLoginRejected(t *testing.T) {
	env := newAuthEnv(t)
	env.insertUser(t, "borrado@cassandra.test", testPassword, "x", true)

	cases := []struct {
		name string
		body string
		want int
	}{
		{"contraseña incorrecta", loginBody(testEmail, "otra"), http.StatusUnauthorized},
		{"email inexistente", loginBody("nadie@cassandra.test", testPassword), http.StatusUnauthorized},
		{"usuario eliminado", loginBody("borrado@cassandra.test", testPassword), http.StatusUnauthorized},
		{"JSON inválido", "{", http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := login(t, env.handler, c.body)
			if rec.Code != c.want {
				t.Errorf("código = %d, se esperaba %d", rec.Code, c.want)
			}
			if cookie(rec, "access_token") != nil {
				t.Error("no debería emitir cookies de sesión")
			}
		})
	}
	if n := env.refreshTokenCount(t); n != 0 {
		t.Errorf("refresh tokens en DB = %d, se esperaba 0", n)
	}
}

// --- Refresh ---

func (e *authEnv) saveRefresh(t *testing.T, token string, expira time.Time) {
	t.Helper()
	if err := e.handler.AuthRepo.SaveRefreshToken(context.Background(), e.userID, token, expira); err != nil {
		t.Fatal(err)
	}
}

func requestWithCookies(method, path string, cookies ...*http.Cookie) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return req
}

func TestRefresh(t *testing.T) {
	env := newAuthEnv(t)
	env.saveRefresh(t, "valido", time.Now().Add(time.Hour))
	env.saveRefresh(t, "expirado", time.Now().Add(-time.Hour))

	t.Run("token válido emite un access token nuevo", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Refresh(rec, requestWithCookies(http.MethodPost, "/api/auth/refresh",
			&http.Cookie{Name: "refresh_token", Value: "valido"}))
		if rec.Code != http.StatusOK {
			t.Fatalf("código = %d", rec.Code)
		}
		access := cookie(rec, "access_token")
		if access == nil {
			t.Fatal("falta la cookie access_token")
		}
		if id, err := utils.ValidateAccessToken(access.Value, testSecret); err != nil || id != env.userID {
			t.Errorf("access token inválido: id=%d err=%v", id, err)
		}
	})

	t.Run("token expirado se rechaza y se borra", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Refresh(rec, requestWithCookies(http.MethodPost, "/api/auth/refresh",
			&http.Cookie{Name: "refresh_token", Value: "expirado"}))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", rec.Code)
		}
		var n int
		env.db.QueryRow(context.Background(), `SELECT count(*) FROM refresh_tokens WHERE token = 'expirado'`).Scan(&n)
		if n != 0 {
			t.Error("el refresh token expirado debería borrarse")
		}
	})

	for name, req := range map[string]*http.Request{
		"sin cookie":        requestWithCookies(http.MethodPost, "/api/auth/refresh"),
		"token desconocido": requestWithCookies(http.MethodPost, "/api/auth/refresh", &http.Cookie{Name: "refresh_token", Value: "nope"}),
	} {
		t.Run(name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			env.handler.Refresh(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("código = %d, se esperaba 401", rec.Code)
			}
		})
	}
}

// --- Logout ---

func TestLogout(t *testing.T) {
	env := newAuthEnv(t)
	env.saveRefresh(t, "sesion-a", time.Now().Add(time.Hour))
	env.saveRefresh(t, "sesion-b", time.Now().Add(time.Hour))

	rec := httptest.NewRecorder()
	env.handler.Logout(rec, requestWithCookies(http.MethodPost, "/api/auth/logout",
		&http.Cookie{Name: "refresh_token", Value: "sesion-a"}))

	if rec.Code != http.StatusOK {
		t.Fatalf("código = %d", rec.Code)
	}
	for _, name := range []string{"access_token", "refresh_token"} {
		if c := cookie(rec, name); c == nil || c.MaxAge >= 0 {
			t.Errorf("la cookie %s debería borrarse (MaxAge < 0)", name)
		}
	}
	// Solo se cierra la sesión actual; las demás siguen vivas.
	if n := env.refreshTokenCount(t); n != 1 {
		t.Errorf("refresh tokens en DB = %d, se esperaba 1", n)
	}

	t.Run("sin cookie", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Logout(rec, requestWithCookies(http.MethodPost, "/api/auth/logout"))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", rec.Code)
		}
	})
}

// --- Me ---

func TestMe(t *testing.T) {
	env := newAuthEnv(t)
	env.saveRefresh(t, "refresh-ok", time.Now().Add(time.Hour))
	access, _ := utils.GenerateAccessToken(env.userID, testSecret)

	userIDFrom := func(t *testing.T, rec *httptest.ResponseRecorder) int {
		var body map[string]int
		if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		return body["user_id"]
	}

	t.Run("access token válido", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Me(rec, requestWithCookies(http.MethodGet, "/api/auth/me",
			&http.Cookie{Name: "access_token", Value: access}))
		if rec.Code != http.StatusOK || userIDFrom(t, rec) != env.userID {
			t.Errorf("código = %d", rec.Code)
		}
		if cookie(rec, "access_token") != nil {
			t.Error("no debería renovar el access token si sigue vigente")
		}
	})

	t.Run("access inválido pero refresh válido renueva la sesión", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Me(rec, requestWithCookies(http.MethodGet, "/api/auth/me",
			&http.Cookie{Name: "access_token", Value: "caducado"},
			&http.Cookie{Name: "refresh_token", Value: "refresh-ok"}))
		if rec.Code != http.StatusOK || userIDFrom(t, rec) != env.userID {
			t.Fatalf("código = %d", rec.Code)
		}
		if cookie(rec, "access_token") == nil {
			t.Error("debería emitir un access token nuevo")
		}
	})

	t.Run("sin sesión", func(t *testing.T) {
		rec := httptest.NewRecorder()
		env.handler.Me(rec, requestWithCookies(http.MethodGet, "/api/auth/me"))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", rec.Code)
		}
	})
}

// --- Cookies ---

func TestCookieSettings(t *testing.T) {
	cases := []struct {
		name       string
		origin     string
		proto      string
		wantSecure bool
		wantSame   http.SameSite
	}{
		{"mismo origen por http", "", "", false, http.SameSiteLaxMode},
		{"https detrás de proxy", "", "https", true, http.SameSiteNoneMode},
		{"dev server de Angular", "http://localhost:4200", "", true, http.SameSiteNoneMode},
		{"app Capacitor", "capacitor://localhost", "", true, http.SameSiteNoneMode},
		{"dominio de producción", "https://cassandra.soteiro.dev", "", true, http.SameSiteNoneMode},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
			if c.origin != "" {
				req.Header.Set("Origin", c.origin)
			}
			if c.proto != "" {
				req.Header.Set("X-Forwarded-Proto", c.proto)
			}
			secure, same := getCookieSettings(req)
			if secure != c.wantSecure || same != c.wantSame {
				t.Errorf("secure=%v sameSite=%v, se esperaba secure=%v sameSite=%v", secure, same, c.wantSecure, c.wantSame)
			}
		})
	}
}
