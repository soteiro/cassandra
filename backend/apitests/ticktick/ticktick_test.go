package ticktick_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"cassandra/config"
	"cassandra/internal/apitest"
	"cassandra/internal/ticktick"
	"cassandra/models"
	"cassandra/repository"
	"cassandra/server"
)

func TestPersonalOAuthAndToday(t *testing.T) {
	var upstreamStatus atomic.Int32
	var revocations atomic.Int32
	upstreamStatus.Store(200)
	token := "private-provider-token"
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/token":
			id, secret, ok := r.BasicAuth()
			_ = r.ParseForm()
			if !ok || id != "client" || secret != "secret" || r.Form.Get("scope") != "tasks:read" {
				t.Error("invalid exchange")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": token, "scope": "tasks:read", "expires_in": 3600})
		case "/oauth/revoke":
			if err := r.ParseMultipartForm(1024); err != nil || r.FormValue("token") != token {
				t.Error("invalid revocation")
			}
			revocations.Add(1)
		case "/open/v1/project":
			if r.Header.Get("Authorization") != "Bearer "+token {
				t.Error("missing provider token")
			}
			w.WriteHeader(int(upstreamStatus.Load()))
			if upstreamStatus.Load() == 200 {
				_, _ = w.Write([]byte(`[]`))
			}
		case "/open/v1/project/inbox/data":
			if r.Method != "GET" {
				t.Error("unexpected mutation")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"tasks": []map[string]any{{"id": "one", "projectId": "inbox-user", "title": "Inbox today", "status": 0, "dueDate": time.Now().UTC().Format(time.RFC3339)}}})
		default:
			t.Errorf("unexpected endpoint %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer provider.Close()
	cfg := &config.Config{TickTick: &config.TickTick{ClientID: "client", ClientSecret: "secret", RedirectURI: "https://cassandra.test/api/connections/ticktick/callback", EncryptionKey: bytes.Repeat([]byte{3}, 32)}}
	api := apitest.NewWithOptions(t, "ticktick", server.Options{Config: cfg, TickTickClient: ticktick.NewClientForEndpoints(provider.URL+"/open/v1", provider.URL+"/oauth")})
	api.Server.Client().CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	ana, bob := api.User("ana@cassandra.test"), api.User("bob@cassandra.test")
	api.Do(nil, "GET", "/api/connections/ticktick", nil).Expect(t, 401)
	api.Do(&apitest.User{Token: "csk_read_only_integration_key"}, "GET", "/api/connections/ticktick", nil).Expect(t, 401)
	api.Do(ana, "POST", "/api/connections/ticktick/authorize", map[string]any{"access_token": "injected"}).Expect(t, 400)
	authorize := func(user *apitest.User) string {
		var out struct {
			URL string `json:"authorization_url"`
		}
		api.Do(user, "POST", "/api/connections/ticktick/authorize", map[string]any{}).Expect(t, 200).JSON(t, &out)
		u, err := url.Parse(out.URL)
		if err != nil {
			t.Fatal(err)
		}
		if u.Query().Get("scope") != "tasks:read" || len(u.Query().Get("state")) != 43 {
			t.Fatal("unsafe authorization", out.URL)
		}
		return u.Query().Get("state")
	}
	callback := func(state, expect string) {
		res := api.Do(nil, "GET", "/api/connections/ticktick/callback?code=private-code&state="+url.QueryEscape(state), nil).Expect(t, 303)
		if res.Header.Get("Location") != "https://cassandra.test/configuracion/ticktick?ticktick="+expect {
			t.Fatalf("unsafe callback target %s", res.Header.Get("Location"))
		}
		if res.Header.Get("Cache-Control") != "no-store" || res.Header.Get("Referrer-Policy") != "no-referrer" {
			t.Error("callback privacy headers")
		}
	}
	old := authorize(ana)
	state := authorize(ana)
	callback(old, "invalid_state")
	// Only the hash is persisted, and one request consumes the state.
	var storedState string
	if err := api.DB.QueryRow(context.Background(), "SELECT state_hash FROM ticktick_oauth_states WHERE user_id=$1", ana.ID).Scan(&storedState); err != nil || storedState == state {
		t.Fatal("state not hashed", err)
	}
	callback(state, "connected")
	callback(state, "invalid_state")
	var status models.TickTickConnection
	api.Do(ana, "GET", "/api/connections/ticktick", nil).Expect(t, 200).JSON(t, &status)
	if !status.Connected || !status.Available || status.NeedsReauthorize {
		t.Fatal(status)
	}
	api.Do(bob, "GET", "/api/connections/ticktick", nil).Expect(t, 200).JSON(t, &status)
	if status.Connected {
		t.Fatal("cross-user connection")
	}
	repo := repository.NewTickTickRepository(api.DB)
	stored, err := repo.Get(context.Background(), ana.ID)
	if err != nil || len(stored.Token) == 0 || bytes.Contains(stored.Token, []byte(token)) {
		t.Fatal("token not encrypted", err)
	}
	// Losing/rotating the key must offer reconnection from Configuración too.
	rotated := *cfg
	rotated.TickTick = &config.TickTick{ClientID: "client", ClientSecret: "secret", RedirectURI: cfg.TickTick.RedirectURI, EncryptionKey: bytes.Repeat([]byte{8}, 32)}
	rotatedServer := httptest.NewServer(server.NewRouter(server.Options{Config: &rotated, DB: api.DB}))
	req, _ := http.NewRequest("GET", rotatedServer.URL+"/api/connections/ticktick", nil)
	req.Header.Set("Authorization", "Bearer "+ana.Token)
	response, err := rotatedServer.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	var rotatedStatus models.TickTickConnection
	err = json.NewDecoder(response.Body).Decode(&rotatedStatus)
	response.Body.Close()
	rotatedServer.Close()
	if err != nil || !rotatedStatus.Connected || !rotatedStatus.NeedsReauthorize {
		t.Fatal("key change concealed the reconnect action", err, rotatedStatus)
	}
	var today models.TickTickToday
	path := "/api/ticktick/tasks/today?time_zone=UTC"
	res := api.Do(ana, "GET", path, nil).Expect(t, 200)
	res.JSON(t, &today)
	if today.State != "ready" || !today.InboxRead || len(today.Tasks) != 1 || today.Tasks[0].List != "Inbox" {
		t.Fatalf("inbox missing %+v", today)
	}
	if bytes.Contains(res.Body, []byte(token)) {
		t.Fatal("exposed provider token")
	}
	api.Do(bob, "GET", path, nil).Expect(t, 200).JSON(t, &today)
	if today.State != "not_connected" || len(today.Tasks) != 0 {
		t.Fatal("cross-user tasks", today)
	}
	api.Do(ana, "GET", path+"&date=2000-01-01", nil).Expect(t, 400)
	api.Do(ana, "GET", "/api/ticktick/tasks/today?time_zone=invalid", nil).Expect(t, 400)
	// New authorization invalidates the cache without removing the existing grant.
	_ = authorize(ana)
	upstreamStatus.Store(401)
	api.Do(ana, "GET", path, nil).Expect(t, 200).JSON(t, &today)
	if today.State != "reauthorize" {
		t.Fatal("provider rejection logged out session", today)
	}
	api.Do(ana, "GET", "/api/connections/ticktick", nil).Expect(t, 200).JSON(t, &status)
	if !status.NeedsReauthorize {
		t.Fatal("authorization rejection not persisted")
	}
	pending := authorize(ana)
	api.Do(ana, "DELETE", "/api/connections/ticktick", nil).Expect(t, 200).JSON(t, &status)
	if status.Connected || status.RevocationFailed || revocations.Load() != 1 {
		t.Fatal("disconnect", status, revocations.Load())
	}
	callback(pending, "invalid_state")
	// A callback consumed before a disconnect cannot restore the disconnected token.
	state = authorize(ana)
	id, version, err := repo.Consume(context.Background(), state)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = repo.Disconnect(context.Background(), ana.ID); err != nil {
		t.Fatal(err)
	}
	if err = repo.Save(context.Background(), id, version, []byte("late-token"), nil); err == nil {
		t.Fatal("late callback undid disconnect")
	}
	stored, _ = repo.Get(context.Background(), ana.ID)
	if len(stored.Token) != 0 {
		t.Fatal("disconnect kept token")
	}
	state = authorize(ana)
	_, err = api.DB.Exec(context.Background(), "UPDATE ticktick_oauth_states SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE user_id=$1", ana.ID)
	if err != nil {
		t.Fatal(err)
	}
	callback(state, "invalid_state")
	// The callback does not accept a caller-provided redirect target.
	res = api.Do(nil, "GET", "/api/connections/ticktick/callback?state=bad&redirect_uri=https://evil.test", nil).Expect(t, 303)
	if strings.Contains(res.Header.Get("Location"), "evil") {
		t.Fatal("open redirect")
	}
}

func TestDisabledIntegration(t *testing.T) {
	api := apitest.New(t, "ticktick")
	user := api.User("disabled@cassandra.test")
	var status models.TickTickConnection
	api.Do(user, "GET", "/api/connections/ticktick", nil).Expect(t, 200).JSON(t, &status)
	if status.Available || status.Connected {
		t.Fatal(status)
	}
	var today models.TickTickToday
	api.Do(user, "GET", "/api/ticktick/tasks/today?time_zone=UTC", nil).Expect(t, 200).JSON(t, &today)
	if today.State != "unavailable" {
		t.Fatal(today)
	}
	api.Do(user, "POST", "/api/connections/ticktick/authorize", map[string]any{}).Expect(t, 503)
}
