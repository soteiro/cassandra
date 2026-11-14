package calendario

import (
	"testing"
	"time"
)

func dia(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := ParseDia(s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func TestTurnoBase(t *testing.T) {
	ciclos := []Ciclo{{Desde: dia(t, "2000-01-01"), Ancla: dia(t, "2026-11-02")}}
	casos := map[string]string{
		"2026-11-02": "L", "2026-11-03": "N", "2026-11-04": "S", "2026-11-05": "F",
		"2026-11-06": "L", "2026-11-14": "L", "2026-11-15": "N",
		// Antes del ancla el ciclo también se cuenta hacia atrás.
		"2026-11-01": "F", "2026-10-31": "S",
	}
	for fecha, want := range casos {
		if got := TurnoBase(dia(t, fecha), ciclos); got != want {
			t.Errorf("%s: turno %q, se esperaba %q", fecha, got, want)
		}
	}
}

func TestTurnoBaseCambioDeCiclo(t *testing.T) {
	// El ciclo nuevo rige desde el 16; los días anteriores conservan el anterior.
	ciclos := []Ciclo{
		{Desde: dia(t, "2000-01-01"), Ancla: dia(t, "2026-11-02")},
		{Desde: dia(t, "2026-11-16"), Ancla: dia(t, "2026-11-16")},
	}
	if got := TurnoBase(dia(t, "2026-11-15"), ciclos); got != "N" {
		t.Errorf("15: %q, se esperaba N (ciclo anterior)", got)
	}
	if got := TurnoBase(dia(t, "2026-11-16"), ciclos); got != "L" {
		t.Errorf("16: %q, se esperaba L (ciclo nuevo)", got)
	}
	if got := TurnoBase(dia(t, "2026-11-17"), ciclos); got != "N" {
		t.Errorf("17: %q, se esperaba N", got)
	}
}

func TestTurnoBaseSinCiclo(t *testing.T) {
	if got := TurnoBase(dia(t, "2026-11-14"), nil); got != "" {
		t.Errorf("sin ciclo: %q, se esperaba vacío", got)
	}
	ciclos := []Ciclo{{Desde: dia(t, "2026-12-01"), Ancla: dia(t, "2026-12-01")}}
	if got := TurnoBase(dia(t, "2026-11-30"), ciclos); got != "" {
		t.Errorf("antes del primer ciclo: %q, se esperaba vacío", got)
	}
}

func TestOcurrenciasUnaVez(t *testing.T) {
	r := Regla{Fecha: dia(t, "2026-11-19")}
	if got := Ocurrencias(r, dia(t, "2026-11-01"), dia(t, "2026-11-30")); len(got) != 1 {
		t.Fatalf("dentro del rango: %v", got)
	}
	if got := Ocurrencias(r, dia(t, "2026-12-01"), dia(t, "2026-12-31")); len(got) != 0 {
		t.Fatalf("fuera del rango: %v", got)
	}
}

func TestOcurrenciasSemanal(t *testing.T) {
	// Colegio de lunes a viernes, desde el miércoles 11 hasta el martes 17.
	hasta := dia(t, "2026-11-17")
	r := Regla{Fecha: dia(t, "2026-11-11"), Dias: []int{0, 1, 2, 3, 4}, Hasta: &hasta}
	got := Ocurrencias(r, dia(t, "2026-11-09"), dia(t, "2026-11-22"))
	want := []string{"2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"}
	if len(got) != len(want) {
		t.Fatalf("ocurrencias %v, se esperaban %v", got, want)
	}
	for i := range want {
		if got[i].Format(Layout) != want[i] {
			t.Errorf("ocurrencia %d: %s, se esperaba %s", i, got[i].Format(Layout), want[i])
		}
	}
}

func TestDiaSemana(t *testing.T) {
	if d := DiaSemana(dia(t, "2026-11-16")); d != 0 {
		t.Errorf("lunes: %d", d)
	}
	if d := DiaSemana(dia(t, "2026-11-15")); d != 6 {
		t.Errorf("domingo: %d", d)
	}
}
