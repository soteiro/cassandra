package memorymcp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"cassandra/models"
)

func TestClientRejectsCredentialURLsAndPlaintextRemote(t *testing.T) {
	token := "cass_mem_" + strings.Repeat("a", 43)
	for _, base := range []string{"http://example.com", "https://user:secret@example.com", "https://example.com?secret=x", "https://example.com#key", "file:///tmp/data"} {
		if _, err := NewClient(base, token); err == nil {
			t.Errorf("aceptó URL insegura: %s", base)
		}
	}
	if _, err := NewClient("https://example.com", "bad-key"); err == nil {
		t.Fatal("aceptó formato de key inválido")
	}
}

func TestClientDoesNotFollowRedirectOrExposeReflectedSecrets(t *testing.T) {
	token := "cass_mem_" + strings.Repeat("a", 43)
	var received bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { received = true; w.Write([]byte(`{}`)) }))
	defer target.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(r.Header.Get("Authorization")))
	}))
	defer origin.Close()
	c, err := NewClient(origin.URL, token)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/redirect", "/reflect"} {
		err := c.request(context.Background(), http.MethodGet, path, nil, &models.MemoryContext{})
		if err == nil || strings.Contains(err.Error(), token) {
			t.Fatalf("error inseguro o ausente: %v", err)
		}
	}
	if received {
		t.Fatal("el cliente siguió la redirección")
	}
}
