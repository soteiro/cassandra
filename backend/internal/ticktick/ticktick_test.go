package ticktick

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCredentialEncryption(t *testing.T) {
	c, _ := NewCipher(bytes.Repeat([]byte{7}, 32))
	a, err := c.Encrypt(1, "private-token")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := c.Encrypt(1, "private-token")
	if bytes.Equal(a, b) || bytes.Contains(a, []byte("private-token")) {
		t.Fatal("credential not randomized and sealed")
	}
	if got, err := c.Decrypt(1, a); err != nil || got != "private-token" {
		t.Fatal("decrypt", err)
	}
	if _, err := c.Decrypt(2, a); err == nil {
		t.Fatal("accepted other user's token")
	}
	a[len(a)-1] ^= 1
	if _, err := c.Decrypt(1, a); err == nil {
		t.Fatal("accepted tampered token")
	}
	if _, err := c.Decrypt(1, []byte("short")); err == nil {
		t.Fatal("accepted truncated token")
	}
	if _, err := NewCipher([]byte("short")); err == nil {
		t.Fatal("accepted short key")
	}
}

func TestDayAndDueDates(t *testing.T) {
	// Santiago starts daylight saving at midnight: this civil day lasts 23h.
	start, end, err := Day("2026-09-06", "America/Santiago", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	// Some zones skip midnight; Day must still select the requested civil date.
	if end.Sub(start) != 23*time.Hour {
		t.Fatalf("DST duration %s", end.Sub(start))
	}
	start, _, err = Day("2026-10-29", "America/Santiago", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		date, zone       string
		all, want, valid bool
	}{
		{"2026-10-30T01:00:00+0000", "UTC", false, true, true},
		{"2026-10-29T01:00:00Z", "UTC", false, false, true},
		{"2026-10-29T00:00:00.000+0000", "UTC", true, true, true},
		{"2026-10-29T00:00:00.000+0000", "", true, true, true},
		{"2026-10-29T00:00:00Z", "invalid/zone", true, false, false},
		{"broken", "UTC", false, false, false},
	} {
		got, valid := dueToday(RawTask{DueDate: tt.date, TimeZone: tt.zone, IsAllDay: tt.all}, start)
		if got != tt.want || valid != tt.valid {
			t.Errorf("%+v: %v,%v", tt, got, valid)
		}
	}
	for _, zone := range []string{"Local", "bad/zone", ""} {
		if _, _, err := Day("2026-10-29", zone, time.Now()); err == nil {
			t.Errorf("accepted %q", zone)
		}
	}
}

func TestClientInboxSchemaAndFailures(t *testing.T) {
	for _, tt := range []struct {
		body   string
		status int
		want   error
	}{
		{`{"tasks":[],"columns":[]}`, 200, nil},
		{`{"columns":[]}`, 200, ErrInvalidResponse},
		{`{"tasks":null}`, 200, ErrInvalidResponse},
		{`{"errorCode":"private-token"}`, 200, ErrInvalidResponse},
		{`private-token`, 401, ErrAuthorization},
		{`private-token`, 429, ErrRateLimited},
		{`private-token`, 502, ErrUnavailable},
		{`[]`, 200, ErrInvalidResponse},
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" || r.URL.Path != "/open/v1/project/inbox/data" || r.Header.Get("Authorization") != "Bearer private-token" {
				t.Error("unexpected request")
			}
			w.WriteHeader(tt.status)
			_, _ = w.Write([]byte(tt.body))
		}))
		client := NewClientForEndpoints(srv.URL+"/open/v1", srv.URL+"/oauth")
		_, err := client.ProjectTasks(context.Background(), "private-token", "inbox")
		srv.Close()
		if !errors.Is(err, tt.want) {
			t.Errorf("body %s: %v", tt.body, err)
		}
		if err != nil && strings.Contains(err.Error(), "private-token") {
			t.Fatal("reflected secret")
		}
	}
	var leaked atomic.Bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Store(true) }))
	defer target.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 302) }))
	defer srv.Close()
	_, _, err := NewClientForEndpoints(srv.URL, srv.URL).Projects(context.Background(), "private-token")
	if err == nil || leaked.Load() {
		t.Fatal("followed upstream redirect")
	}
}

func TestOAuthProtocol(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/token":
			id, secret, ok := r.BasicAuth()
			_ = r.ParseForm()
			if !ok || id != "client" || secret != "secret" || r.Form.Get("scope") != "tasks:read" || r.Form.Get("grant_type") != "authorization_code" || r.Form.Get("code") != "code" || r.Form.Get("redirect_uri") != "https://cassandra.test/api/connections/ticktick/callback" {
				t.Error("invalid token exchange")
			}
			_, _ = w.Write([]byte(`{"access_token":"token","expires_in":3600,"scope":"tasks:read"}`))
		case "/oauth/revoke":
			if r.Method != "POST" || r.ParseMultipartForm(1024) != nil || r.FormValue("token") != "token" {
				t.Error("invalid revocation")
			}
		default:
			t.Error("unexpected endpoint")
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	c := NewClientForEndpoints(srv.URL+"/open/v1", srv.URL+"/oauth")
	token, err := c.Exchange(context.Background(), "client", "secret", "https://cassandra.test/api/connections/ticktick/callback", "code")
	if err != nil || token.AccessToken != "token" {
		t.Fatal(err)
	}
	if err = c.Revoke(context.Background(), token.AccessToken); err != nil {
		t.Fatal(err)
	}
}

func TestTodayFilteringCacheAndIsolation(t *testing.T) {
	var calls atomic.Int32
	var status atomic.Int32
	status.Store(200)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Error("unexpected write endpoint")
		}
		if r.URL.Path == "/open/v1/project" {
			calls.Add(1)
			w.WriteHeader(int(status.Load()))
			if status.Load() == 200 {
				_, _ = w.Write([]byte(`[{"id":"work","name":"Trabajo"}]`))
			}
			return
		}
		task := func(id, project string, priority, state int, due string) map[string]any {
			return map[string]any{"id": id, "projectId": project, "title": id, "priority": priority, "status": state, "dueDate": due}
		}
		tasks := []map[string]any{}
		if strings.Contains(r.URL.Path, "inbox") {
			tasks = append(tasks, task("inbox-active", "inbox-user", 1, 0, "2026-10-29T14:00:00Z"), task("done", "inbox-user", 5, 2, "2026-10-29T14:00:00Z"), task("abandoned", "inbox-user", 5, -1, "2026-10-29T14:00:00Z"))
		} else {
			active := task("high", "work", 5, 0, "2026-10-30T01:00:00.000+0000")
			tasks = append(tasks, active, active, task("tomorrow", "work", 5, 0, "2026-10-30T14:00:00Z"), task("no-date", "work", 0, 0, ""))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"tasks": tasks})
	}))
	defer srv.Close()
	s := NewService(NewClientForEndpoints(srv.URL+"/open/v1", srv.URL+"/oauth"))
	now := time.Date(2026, 10, 29, 16, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	get := func(user int, refresh bool) (string, error) {
		out, err := s.Today(context.Background(), user, 1, "token", "2026-10-29", "America/Santiago", refresh)
		if err == nil && out.State == "ready" {
			if !out.InboxRead || len(out.Tasks) != 2 || out.Tasks[0].ID != "high" {
				t.Errorf("incorrect today: %+v", out)
			}
		}
		return out.State, err
	}
	if _, err := get(1, false); err != nil {
		t.Fatal(err)
	}
	_, _ = get(1, true)
	if calls.Load() != 1 {
		t.Fatal("refresh bypassed cooldown")
	}
	_, _ = get(2, false)
	if calls.Load() != 2 {
		t.Fatal("shared cache across users")
	}
	now = now.Add(6 * time.Minute)
	status.Store(503)
	state, err := get(1, false)
	if err != nil || state != "stale" {
		t.Fatal("missing stale fallback", state, err)
	}
	now = now.Add(31 * time.Second)
	status.Store(401)
	_, err = get(1, false)
	if !errors.Is(err, ErrAuthorization) {
		t.Fatal("served stale authorization", err)
	}
	status.Store(200)
	s.Invalidate(1)
	if _, err = get(1, false); err != nil {
		t.Fatal("invalidation", err)
	}
}

func TestInboxFailureIsNeverCompleteEmpty(t *testing.T) {
	for _, fallback := range []bool{false, true} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/open/v1/project":
				_, _ = w.Write([]byte(`[]`))
			case "/open/v1/task/undone":
				if fallback {
					_, _ = w.Write([]byte(`[]`))
				} else {
					w.WriteHeader(503)
				}
			default:
				_, _ = w.Write([]byte(`{"columns":[]}`))
			}
		}))
		s := NewService(NewClientForEndpoints(srv.URL+"/open/v1", srv.URL+"/oauth"))
		out, err := s.Today(context.Background(), 1, 1, "token", "2026-10-29", "UTC", false)
		srv.Close()
		if fallback {
			if err != nil || out.State != "partial" || len(out.Warnings) == 0 {
				t.Fatal("fallback claimed complete", out, err)
			}
		} else if err == nil {
			t.Fatal("failed inbox claimed complete", out)
		}
	}
}

func TestConcurrentReadersAndInvalidation(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/open/v1/project" {
			calls.Add(1)
			once.Do(func() { close(entered) })
			<-release
			_, _ = w.Write([]byte(`[]`))
		} else {
			_, _ = w.Write([]byte(`{"tasks":[]}`))
		}
	}))
	defer srv.Close()
	s := NewService(NewClientForEndpoints(srv.URL+"/open/v1", srv.URL+"/oauth"))
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = s.Today(context.Background(), 1, 1, "token", "2026-10-29", "UTC", false)
	}()
	<-entered
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Today(ctx, 1, 1, "token", "2026-10-29", "UTC", false); !errors.Is(err, context.Canceled) {
		t.Fatal("canceled reader", err)
	}
	s.Invalidate(1)
	close(release)
	<-done
	_, err := s.Today(context.Background(), 1, 1, "token", "2026-10-29", "UTC", false)
	if err != nil || calls.Load() != 2 {
		t.Fatal("inflight result restored invalid cache", err, calls.Load())
	}
}
