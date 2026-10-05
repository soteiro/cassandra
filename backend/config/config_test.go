package config

import (
	"slices"
	"strings"
	"testing"
)

func TestGetEnvInt(t *testing.T) {
	cases := []struct {
		name  string
		value string
		set   bool
		want  int
	}{
		{"sin variable usa el valor por defecto", "", false, 100},
		{"valor válido", "5000", true, 5000},
		{"valor no numérico usa el valor por defecto", "abc", true, 100},
		{"cero usa el valor por defecto", "0", true, 100},
		{"negativo usa el valor por defecto", "-5", true, 100},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if c.set {
				t.Setenv("RATE_LIMIT_PER_MIN", c.value)
			}
			if got := getEnvInt("RATE_LIMIT_PER_MIN", 100); got != c.want {
				t.Errorf("getEnvInt() = %d, se esperaba %d", got, c.want)
			}
		})
	}
}

func TestAllowedOrigins(t *testing.T) {
	if got := allowedOrigins(""); !slices.Equal(got, DefaultAllowedOrigins) {
		t.Errorf("sin ALLOWED_ORIGINS = %v, se esperaban los valores por defecto", got)
	}

	got := allowedOrigins(" https://cassandra.ejemplo.com/ , ,https://otra.ejemplo.com")
	want := append(append([]string{}, DefaultAllowedOrigins...), "https://cassandra.ejemplo.com", "https://otra.ejemplo.com")
	if !slices.Equal(got, want) {
		t.Errorf("allowedOrigins = %v, se esperaba %v", got, want)
	}
	if len(DefaultAllowedOrigins) != 5 {
		t.Error("allowedOrigins no debe modificar DefaultAllowedOrigins")
	}
}

func TestValidateJWTSecret(t *testing.T) {
	ok := strings.Repeat("a", MinJWTSecretLength)
	if got, err := validateJWTSecret("  " + ok + "\n"); err != nil || got != ok {
		t.Errorf("secreto válido rechazado: %q, %v", got, err)
	}
	for name, secret := range map[string]string{
		"vacío":                  "",
		"solo espacios":          "   ",
		"corto":                  strings.Repeat("a", MinJWTSecretLength-1),
		"el antiguo por defecto": "jtwsecretlasjkndlaskndlakmd",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := validateJWTSecret(secret); err == nil {
				t.Error("se esperaba error")
			}
		})
	}
}

func TestLoadRequiresJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Errorf("Load sin JWT_SECRET: err = %v, se esperaba un error que lo mencione", err)
	}

	t.Setenv("JWT_SECRET", strings.Repeat("s", 48))
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.JwtSecret != strings.Repeat("s", 48) {
		t.Error("Load no usó el JWT_SECRET del entorno")
	}
}

func TestParseTrustedProxies(t *testing.T) {
	got, err := parseTrustedProxies("")
	if err != nil || len(got) != 2 || got[0].String() != "127.0.0.0/8" {
		t.Errorf("por defecto = %v, %v", got, err)
	}
	got, err = parseTrustedProxies(" 10.0.0.5 , 192.168.1.0/24, ::1 ")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"10.0.0.5/32", "192.168.1.0/24", "::1/128"}
	for i, p := range got {
		if p.String() != want[i] {
			t.Errorf("prefijo %d = %s, se esperaba %s", i, p, want[i])
		}
	}
	if _, err := parseTrustedProxies("no-es-ip"); err == nil {
		t.Error("se esperaba error con un valor inválido")
	}
}
