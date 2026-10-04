package documentos

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/utils"

	"github.com/golang-jwt/jwt/v5"
)

const password = "clave-de-test-123"

// navegador simula un browser: cliente con cookie jar contra el servidor de test.
type navegador struct {
	t      *testing.T
	api    *apitest.API
	client *http.Client
	base   *url.URL
}

func nuevoNavegador(t *testing.T, api *apitest.API) *navegador {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	c := api.Server.Client()
	client := &http.Client{Transport: c.Transport, Jar: jar}
	base, _ := url.Parse(api.Server.URL)
	return &navegador{t: t, api: api, client: client, base: base}
}

type respuesta struct {
	status  int
	body    string
	cookies []*http.Cookie
}

// do envía la petición; headers opcionales en pares clave/valor.
func (n *navegador) do(method, path, body string, headers ...string) respuesta {
	n.t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, n.api.Server.URL+path, r)
	if err != nil {
		n.t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := n.client.Do(req)
	if err != nil {
		n.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return respuesta{status: res.StatusCode, body: string(data), cookies: res.Cookies()}
}

func (n *navegador) expect(res respuesta, status int, que string) {
	n.t.Helper()
	if res.status != status {
		n.t.Fatalf("%s: código %d, se esperaba %d; cuerpo: %s", que, res.status, status, res.body)
	}
}

func (n *navegador) cookie(name string) string {
	for _, c := range n.client.Jar.Cookies(n.base) {
		if c.Name == name {
			return c.Value
		}
	}
	return ""
}

func (n *navegador) setCookie(name, value string) {
	n.client.Jar.SetCookies(n.base, []*http.Cookie{{Name: name, Value: value, Path: "/"}})
}

func (n *navegador) login(email string) {
	n.t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	n.expect(n.do(http.MethodPost, "/api/auth/login", string(body)), http.StatusOK, "login")
}

func meUserID(t *testing.T, res respuesta) int {
	t.Helper()
	var v struct {
		UserID int `json:"user_id"`
	}
	if err := json.Unmarshal([]byte(res.body), &v); err != nil {
		t.Fatalf("/api/auth/me no es JSON: %s", res.body)
	}
	return v.UserID
}

func firmar(t *testing.T, secret string, claims jwt.Claims, method jwt.SigningMethod) string {
	t.Helper()
	tok, err := jwt.NewWithClaims(method, claims).SignedString(secret2key(secret, method))
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func secret2key(secret string, method jwt.SigningMethod) any {
	if method == jwt.SigningMethodNone {
		return jwt.UnsafeAllowNoneSignatureType
	}
	return []byte(secret)
}

func claims(userID int, exp time.Duration) utils.UserClaims {
	return utils.UserClaims{UserID: userID, RegisteredClaims: jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(exp)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}}
}

// --- Flujo completo ---

func TestSesion_FlujoCompletoConCookies(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	n := nuevoNavegador(t, api)

	// Sin sesión: protegida y /me dan 401.
	n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusUnauthorized, "protegida sin sesión")
	n.expect(n.do(http.MethodGet, "/api/auth/me", ""), http.StatusUnauthorized, "me sin sesión")

	// Login: cookies HttpOnly.
	body, _ := json.Marshal(map[string]string{"email": ana.Email, "password": password})
	res := n.do(http.MethodPost, "/api/auth/login", string(body))
	n.expect(res, http.StatusOK, "login")
	if strings.Contains(res.body, "eyJ") {
		t.Errorf("el login devuelve un JWT en el cuerpo: %s", res.body)
	}
	vistas := map[string]*http.Cookie{}
	for _, c := range res.cookies {
		vistas[c.Name] = c
	}
	for _, name := range []string{"access_token", "refresh_token"} {
		c := vistas[name]
		if c == nil || c.Value == "" {
			t.Fatalf("login no fijó la cookie %s; cookies: %v", name, res.cookies)
		}
		if !c.HttpOnly {
			t.Errorf("cookie %s no es HttpOnly", name)
		}
		if c.Path != "/" {
			t.Errorf("cookie %s con Path %q", name, c.Path)
		}
	}
	access1, refresh1 := n.cookie("access_token"), n.cookie("refresh_token")
	if access1 == "" || refresh1 == "" {
		t.Fatalf("el cookie jar no guardó las cookies")
	}
	if id, err := utils.ValidateAccessToken(access1, apitest.JWTSecret); err != nil || id != ana.ID {
		t.Errorf("access_token de la cookie: id=%d err=%v", id, err)
	}

	// Ruta protegida solo con la cookie (sin header Authorization).
	n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusOK, "protegida con cookie")
	n.expect(n.do(http.MethodGet, apitest.Path("/api/users/%d", ana.ID), ""), http.StatusOK, "perfil con cookie")

	// /me
	res = n.do(http.MethodGet, "/api/auth/me", "")
	n.expect(res, http.StatusOK, "me")
	if id := meUserID(t, res); id != ana.ID {
		t.Errorf("me user_id = %d, se esperaba %d", id, ana.ID)
	}

	// /refresh renueva el access_token.
	time.Sleep(1100 * time.Millisecond) // iat con resolución de segundos: forzar un token distinto
	res = n.do(http.MethodPost, "/api/auth/refresh", "")
	n.expect(res, http.StatusOK, "refresh")
	access2 := n.cookie("access_token")
	if access2 == "" || access2 == access1 {
		t.Errorf("refresh no renovó el access_token")
	}
	if id, err := utils.ValidateAccessToken(access2, apitest.JWTSecret); err != nil || id != ana.ID {
		t.Errorf("access_token renovado: id=%d err=%v", id, err)
	}
	n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusOK, "protegida tras refresh")

	// /me sin access_token pero con refresh_token: renueva.
	n.setCookie("access_token", "")
	res = n.do(http.MethodGet, "/api/auth/me", "")
	n.expect(res, http.StatusOK, "me solo con refresh")
	if n.cookie("access_token") == "" {
		t.Errorf("/me con refresh válido no repuso el access_token")
	}

	// Logout: borra cookies y el refresh token del servidor.
	n.expect(n.do(http.MethodPost, "/api/auth/logout", ""), http.StatusOK, "logout")
	if v := n.cookie("access_token"); v != "" {
		t.Errorf("access_token sigue en el jar tras logout")
	}
	if v := n.cookie("refresh_token"); v != "" {
		t.Errorf("refresh_token sigue en el jar tras logout")
	}
	n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusUnauthorized, "protegida tras logout")
	n.expect(n.do(http.MethodGet, "/api/auth/me", ""), http.StatusUnauthorized, "me tras logout")
	n.expect(n.do(http.MethodPost, "/api/auth/refresh", ""), http.StatusUnauthorized, "refresh sin cookie")
	n.expect(n.do(http.MethodPost, "/api/auth/logout", ""), http.StatusUnauthorized, "logout sin cookie")

	// El refresh token revocado ya no sirve aunque se reinyecte.
	n.setCookie("refresh_token", refresh1)
	n.expect(n.do(http.MethodPost, "/api/auth/refresh", ""), http.StatusUnauthorized, "refresh revocado")
	n.expect(n.do(http.MethodGet, "/api/auth/me", ""), http.StatusUnauthorized, "me con refresh revocado")
	n.setCookie("refresh_token", "")

	// Hallazgo documentado: el access token es un JWT sin estado; si alguien lo copió
	// antes del logout, sigue valiendo hasta que expire (15 min).
	n.setCookie("access_token", access2)
	if r := n.do(http.MethodGet, "/api/proyects", ""); r.status == http.StatusOK {
		t.Logf("HALLAZGO: un access_token capturado antes del logout sigue siendo aceptado (JWT sin revocación, vida 15 min)")
	}
}

func TestSesion_LoginInvalido(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	n := nuevoNavegador(t, api)

	for _, c := range []struct {
		body   string
		status int
	}{
		{`{"email":"` + ana.Email + `","password":"incorrecta"}`, http.StatusUnauthorized},
		{`{"email":"nadie@cassandra.test","password":"` + password + `"}`, http.StatusUnauthorized},
		{`{"email":"","password":""}`, http.StatusUnauthorized},
		{`{json roto`, http.StatusBadRequest},
	} {
		res := n.do(http.MethodPost, "/api/auth/login", c.body)
		n.expect(res, c.status, "login "+c.body)
		if len(res.cookies) != 0 {
			t.Errorf("login fallido fijó cookies: %v", res.cookies)
		}
	}
	// Mismo mensaje para email inexistente y contraseña errónea (no enumera usuarios).
	a := n.do(http.MethodPost, "/api/auth/login", `{"email":"`+ana.Email+`","password":"incorrecta"}`)
	b := n.do(http.MethodPost, "/api/auth/login", `{"email":"nadie@cassandra.test","password":"x"}`)
	if a.body != b.body {
		t.Errorf("mensajes distintos permiten enumerar usuarios: %q vs %q", a.body, b.body)
	}
}

func TestSesion_HeaderInvalidoNoCaeALaCookie(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	n := nuevoNavegador(t, api)
	n.login(ana.Email)
	n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusOK, "cookie válida")

	for _, h := range []string{"Bearer basura", "Bearer ", "Basic YWJjOmRlZg==", "basura", "bearer " + ana.Token} {
		n.expect(n.do(http.MethodGet, "/api/proyects", "", "Authorization", h), http.StatusUnauthorized, "Authorization: "+h)
	}
	// El header válido sí funciona aunque haya cookie.
	n.expect(n.do(http.MethodGet, "/api/proyects", "", "Authorization", "Bearer "+ana.Token), http.StatusOK, "header válido")
}

func TestSesion_TokensManipulados(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	n := nuevoNavegador(t, api)

	otroSecreto := firmar(t, "otro-secreto-de-al-menos-32-caracteres-xx", claims(ana.ID, time.Hour), jwt.SigningMethodHS256)
	expirado := firmar(t, apitest.JWTSecret, claims(ana.ID, -time.Minute), jwt.SigningMethodHS256)
	none := firmar(t, "", claims(ana.ID, time.Hour), jwt.SigningMethodNone)
	hs512 := firmar(t, apitest.JWTSecret, claims(ana.ID, time.Hour), jwt.SigningMethodHS512)

	// Token válido con firma alterada (último carácter cambiado).
	alterado := ana.Token[:len(ana.Token)-2] + "xx"
	// Payload cambiado a otro user_id manteniendo la firma original.
	partes := strings.Split(ana.Token, ".")
	otroPayload := firmar(t, "x-secreto-cualquiera-de-32-caracteres!!", claims(ana.ID+1, time.Hour), jwt.SigningMethodHS256)
	mezclado := partes[0] + "." + strings.Split(otroPayload, ".")[1] + "." + partes[2]

	for nombre, tok := range map[string]string{
		"otro secreto": otroSecreto, "expirado": expirado, "alg none": none,
		"firma alterada": alterado, "payload cambiado": mezclado,
	} {
		n.expect(n.do(http.MethodGet, "/api/proyects", "", "Authorization", "Bearer "+tok), http.StatusUnauthorized, "header "+nombre)
		n.setCookie("access_token", tok)
		n.expect(n.do(http.MethodGet, "/api/proyects", ""), http.StatusUnauthorized, "cookie "+nombre)
		n.expect(n.do(http.MethodGet, "/api/auth/me", ""), http.StatusUnauthorized, "me con cookie "+nombre)
	}
	// HS512 con el secreto correcto: la validación acepta cualquier HMAC (documentado).
	if r := n.do(http.MethodGet, "/api/proyects", "", "Authorization", "Bearer "+hs512); r.status == http.StatusOK {
		t.Logf("NOTA: se acepta un JWT HS512 firmado con el secreto correcto (solo se exige familia HMAC)")
	}
}

func TestSesion_UsuarioEliminado_NoPuedeHacerLogin(t *testing.T) {
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	beto := usuario(t, api, "beto@cassandra.test")

	// No se puede borrar a otro.
	api.Do(beto, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusForbidden)
	api.Do(ana, http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusOK)

	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	n := nuevoNavegador(t, api)
	body, _ := json.Marshal(map[string]string{"email": ana.Email, "password": password})
	n.expect(n.do(http.MethodPost, "/api/auth/login", string(body)), http.StatusUnauthorized, "login de usuario eliminado")
	api.Do(beto, http.MethodGet, "/api/proyects", nil).Expect(t, http.StatusOK)
}

func TestSesion_UsuarioEliminado_AccessTokenRechazado(t *testing.T) {
	bug(t, "el middleware solo valida la firma del JWT: un usuario eliminado (DELETE /api/users/{id}) sigue accediendo a rutas protegidas con su access token")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	p := crearProyecto(t, api, ana, "P")

	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	api.Do(ana, http.MethodGet, "/api/proyects", nil).Expect(t, http.StatusUnauthorized)
	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", p),
		map[string]any{"titulo": "post mortem"}).Expect(t, http.StatusUnauthorized)
}

func TestSesion_UsuarioEliminado_RefreshRechazado(t *testing.T) {
	bug(t, "/api/auth/refresh y /api/auth/me siguen emitiendo access tokens a un usuario eliminado: el refresh token no se revoca ni se comprueba users.eliminado")
	api := apitest.New(t, "documentos")
	ana := usuario(t, api, "ana@cassandra.test")
	n := nuevoNavegador(t, api)
	n.login(ana.Email)

	api.Do(ana, http.MethodDelete, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusNoContent)

	n.expect(n.do(http.MethodPost, "/api/auth/refresh", ""), http.StatusUnauthorized, "refresh de usuario eliminado")
	n.setCookie("access_token", "")
	n.expect(n.do(http.MethodGet, "/api/auth/me", ""), http.StatusUnauthorized, "me de usuario eliminado")
}
