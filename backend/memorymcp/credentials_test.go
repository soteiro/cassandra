package memorymcp

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"cassandra/models"
)

const testServer = "https://qa.ejemplo.com"

func writeFile(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
}

func repoWithLink(t *testing.T, id string) string {
	t.Helper()
	repo := t.TempDir()
	if err := os.Mkdir(filepath.Join(repo, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(repo, LinkFile), `{"proyecto_id": `+id+`, "servidor": "`+testServer+`"}`, 0o644)
	return repo
}

func TestResolveAPIKeyPrefersEnvironment(t *testing.T) {
	key, err := ResolveAPIKey("cass_mem_env", "", testServer, t.TempDir(), t.TempDir())
	if err != nil || key != "cass_mem_env" {
		t.Fatalf("key=%q err=%v", key, err)
	}
}

func TestResolveAPIKeyUsesKeyOfLinkedProjectPerServer(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "7.key"), "cass_mem_siete\n", 0o600)
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "8.key"), "cass_mem_ocho\n", 0o600)
	writeFile(t, filepath.Join(keys, "otro.ejemplo.com", "7.key"), "cass_mem_otro\n", 0o600)

	repo := repoWithLink(t, "7")
	sub := filepath.Join(repo, "backend", "cmd")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	// Desde un subdirectorio se encuentra el vínculo de la raíz del repositorio.
	key, err := ResolveAPIKey("", "", testServer, sub, keys)
	if err != nil || key != "cass_mem_siete" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	// El host sale de CASSANDRA_URL, no del archivo del repositorio.
	key, err = ResolveAPIKey("", "", "https://otro.ejemplo.com", repo, keys)
	if err != nil || key != "cass_mem_otro" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	if _, err = ResolveAPIKey("", "", "https://sin-keys.ejemplo.com", repo, keys); err == nil {
		t.Fatal("usó una key de otro servidor")
	}
}

func TestResolveAPIKeyGlobalFromConnectorConfig(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "all.key"), "cass_mem_global\n", 0o600)
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "7.key"), "cass_mem_siete\n", 0o600)
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "8.key"), "cass_mem_ocho\n", 0o600)

	// "all" usa la key global aunque el repositorio esté vinculado a otro proyecto.
	key, err := ResolveAPIKey("", "all", testServer, repoWithLink(t, "7"), keys)
	if err != nil || key != "cass_mem_global" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	// Fuera de un repositorio también funciona: el agente PM no necesita vínculo.
	if key, err = ResolveAPIKey("", " all ", testServer, t.TempDir(), keys); err != nil || key != "cass_mem_global" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	// Un ID elige la key de ese proyecto sin vínculo.
	if key, err = ResolveAPIKey("", "8", testServer, t.TempDir(), keys); err != nil || key != "cass_mem_ocho" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	// CASSANDRA_API_KEY sigue mandando.
	if key, err = ResolveAPIKey("cass_mem_env", "all", testServer, t.TempDir(), keys); err != nil || key != "cass_mem_env" {
		t.Fatalf("key=%q err=%v", key, err)
	}
	for _, bad := range []string{"todos", "ALL", "0", "-1", "../7", "7.key", "99999999999"} {
		if key, err := ResolveAPIKey("", bad, testServer, t.TempDir(), keys); err == nil || key != "" {
			t.Errorf("CASSANDRA_PROYECTO=%q aceptado: key=%q", bad, key)
		}
	}
	// Sin all.key para el servidor, falla sin caer en otra key.
	if key, err := ResolveAPIKey("", "all", "https://otro.ejemplo.com", repoWithLink(t, "7"), keys); err == nil || key != "" {
		t.Fatalf("key=%q err=%v", key, err)
	}
}

// Un .cassandra-memory.json de un repositorio (posiblemente ajeno) no puede elegir la key global.
func TestResolveAPIKeyLinkFileCannotSelectGlobalKey(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "all.key"), "cass_mem_global", 0o600)
	for _, id := range []string{`"all"`, `"7"`, `null`, `0`} {
		if key, err := ResolveAPIKey("", "", testServer, repoWithLink(t, id), keys); err == nil || key != "" {
			t.Errorf("proyecto_id %s aceptado: key=%q", id, key)
		}
	}
}

func TestResolveAPIKeyErrors(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "7.key"), "cass_mem_siete", 0o644)

	cases := map[string]func() (string, string){
		"sin vínculo": func() (string, string) {
			repo := t.TempDir()
			os.Mkdir(filepath.Join(repo, ".git"), 0o755)
			return repo, testServer
		},
		"vínculo de un directorio superior al repo": func() (string, string) {
			parent := t.TempDir()
			writeFile(t, filepath.Join(parent, LinkFile), `{"proyecto_id": 7}`, 0o644)
			repo := filepath.Join(parent, "repo")
			os.MkdirAll(filepath.Join(repo, ".git"), 0o755)
			return repo, testServer
		},
		"proyecto_id inválido":       func() (string, string) { return repoWithLink(t, "-3"), testServer },
		"proyecto_id no numérico":    func() (string, string) { return repoWithLink(t, `"../../etc"`), testServer },
		"key con permisos abiertos":  func() (string, string) { return repoWithLink(t, "7"), testServer },
		"key de otro proyecto falta": func() (string, string) { return repoWithLink(t, "9"), testServer },
		"URL inválida":               func() (string, string) { return repoWithLink(t, "7"), "://roto" },
		"servidor con puntos":        func() (string, string) { return repoWithLink(t, "7"), "https://.." },
	}
	for name, setup := range cases {
		dir, server := setup()
		if key, err := ResolveAPIKey("", "", server, dir, keys); err == nil || key != "" {
			t.Errorf("%s: aceptó key=%q err=%v", name, key, err)
		}
	}
}

func TestResolveAPIKeyErrorsDoNotLeakKey(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "7.key"), "cass_mem_secreta", 0o644)
	_, err := ResolveAPIKey("", "", testServer, repoWithLink(t, "7"), keys)
	if err == nil || strings.Contains(err.Error(), "cass_mem_secreta") {
		t.Fatalf("error ausente o filtra la key: %v", err)
	}
}

func TestResolveAPIKeyRejectsOversizedKeyFile(t *testing.T) {
	keys := t.TempDir()
	writeFile(t, filepath.Join(keys, "qa.ejemplo.com", "7.key"), strings.Repeat("a", 1000), 0o600)
	if _, err := ResolveAPIKey("", "", testServer, repoWithLink(t, "7"), keys); err == nil {
		t.Fatal("aceptó un archivo de key desmesurado")
	}
}

func TestDefaultKeysDir(t *testing.T) {
	if dir, err := DefaultKeysDir("/x"); err != nil || dir != "/x" {
		t.Fatalf("dir=%q err=%v", dir, err)
	}
	t.Setenv("XDG_CONFIG_HOME", "/cfg")
	if dir, err := DefaultKeysDir(""); err != nil || dir != "/cfg/cassandra-memory" {
		t.Fatalf("dir=%q err=%v", dir, err)
	}
}

func TestUnavailableClientReportsReasonWithoutContactingServer(t *testing.T) {
	c, err := NewUnavailableClient(testServer, os.ErrNotExist)
	if err != nil {
		t.Fatal(err)
	}
	c.http = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("contactó al servidor sin key")
		return nil, nil
	})}
	if err := c.request(context.Background(), http.MethodGet, "/api/memory/projects/1", nil, &models.MemoryContext{}); err != os.ErrNotExist {
		t.Fatalf("error inesperado: %v", err)
	}
	if _, err := NewUnavailableClient("http://example.com", os.ErrNotExist); err == nil {
		t.Fatal("aceptó HTTP remoto")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
