package config

import "testing"

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
