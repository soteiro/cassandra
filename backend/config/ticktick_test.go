package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestTickTickConfiguration(t *testing.T) {
	for _, name := range []string{"TICKTICK_CLIENT_ID", "TICKTICK_CLIENT_SECRET", "TICKTICK_REDIRECT_URI", "INTEGRATIONS_ENCRYPTION_KEY"} {
		t.Setenv(name, "")
	}
	if cfg, err := loadTickTick(); err != nil || cfg != nil {
		t.Fatal("optional feature must be disabled", err)
	}
	t.Setenv("TICKTICK_CLIENT_SECRET", "never-echo-this-secret")
	if _, err := loadTickTick(); err == nil || strings.Contains(err.Error(), "never-echo") {
		t.Fatal("partial config or leaked secret", err)
	}
	t.Setenv("TICKTICK_CLIENT_ID", "client")
	t.Setenv("INTEGRATIONS_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32))))
	for _, uri := range []string{"https://cassandra.test/api/connections/ticktick/callback", "http://localhost:8080/api/connections/ticktick/callback"} {
		t.Setenv("TICKTICK_REDIRECT_URI", uri)
		if _, err := loadTickTick(); err != nil {
			t.Fatal(err)
		}
	}
	for _, uri := range []string{"http://cassandra.test/api/connections/ticktick/callback", "https://user:pass@cassandra.test/api/connections/ticktick/callback", "https://cassandra.test/wrong", "https://cassandra.test/api/connections/ticktick/callback?return=elsewhere"} {
		t.Setenv("TICKTICK_REDIRECT_URI", uri)
		if _, err := loadTickTick(); err == nil {
			t.Fatal("accepted unsafe redirect", uri)
		}
	}
	t.Setenv("TICKTICK_REDIRECT_URI", "https://cassandra.test/api/connections/ticktick/callback")
	t.Setenv("INTEGRATIONS_ENCRYPTION_KEY", "not-base64")
	if _, err := loadTickTick(); err == nil {
		t.Fatal("accepted invalid encryption key")
	}
}
