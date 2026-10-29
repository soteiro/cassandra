package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOAuthLogRedactionPreservesValidation(t *testing.T) {
	handler := RedactOAuthRequestURI(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.RequestURI, "secret") {
			t.Error("logger sees OAuth credentials")
		}
		if r.URL.Query().Get("code") != "secret-code" || r.URL.Query().Get("state") != "secret-state" {
			t.Error("callback lost validation parameters")
		}
	}))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/api/connections/ticktick/callback?code=secret-code&state=secret-state", nil))
}
