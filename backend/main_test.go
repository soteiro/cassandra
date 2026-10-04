package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVersionHandler(t *testing.T) {
	prev := version
	version = "v1.2.3"
	t.Cleanup(func() { version = prev })

	rec := httptest.NewRecorder()
	versionHandler(rec, httptest.NewRequest(http.MethodGet, "/api/version", nil))

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
