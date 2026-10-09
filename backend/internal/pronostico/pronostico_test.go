package pronostico

import "testing"

func TestSemanasSinDatosSuficientes(t *testing.T) {
	casos := map[string]struct {
		abiertas  int
		porSemana []int
	}{
		"sin abiertas":       {0, []int{3, 3}},
		"sin historia":       {5, nil},
		"pocas terminadas":   {5, []int{1, 0, 1, 0}},
		"nada en la ventana": {5, []int{0, 0, 0}},
	}
	for nombre, c := range casos {
		if _, ok := Semanas(c.abiertas, c.porSemana, 1); ok {
			t.Errorf("%s: no debería pronosticar", nombre)
		}
	}
}

func TestSemanasRitmoConstante(t *testing.T) {
	r, ok := Semanas(10, []int{2, 2, 2, 2}, 1)
	if !ok || r.SemanasMin != 5 || r.SemanasMax != 5 {
		t.Errorf("con 2 por semana y 10 abiertas son 5 semanas exactas: %+v ok=%v", r, ok)
	}
}

func TestSemanasRitmoIrregularDaUnRango(t *testing.T) {
	r, ok := Semanas(12, []int{0, 6, 1, 0, 5, 0, 2, 4}, 7)
	if !ok {
		t.Fatal("debería pronosticar")
	}
	if r.SemanasMin >= r.SemanasMax {
		t.Errorf("un ritmo irregular debe dar un rango: %+v", r)
	}
	// Promedio 2,25/semana → ~5,3 semanas; el rango debe contenerlo.
	if r.SemanasMin > 5 || r.SemanasMax < 6 {
		t.Errorf("el rango debería contener ~5-6 semanas: %+v", r)
	}
	if r2, _ := Semanas(12, []int{0, 6, 1, 0, 5, 0, 2, 4}, 7); r2 != r {
		t.Error("con la misma semilla el resultado debe ser estable")
	}
}

func TestSemanasConMuchasSemanasVaciasTieneTope(t *testing.T) {
	r, ok := Semanas(1000, []int{3, 0, 0, 0, 0, 0, 0, 0}, 1)
	if !ok || r.SemanasMax > maxSemanas {
		t.Errorf("el pronóstico debe tener tope: %+v", r)
	}
}

func TestMediana(t *testing.T) {
	if m := Mediana([]float64{3, 1, 2}); m != 2 {
		t.Errorf("impar: %v", m)
	}
	if m := Mediana([]float64{4, 1, 3, 2}); m != 2.5 {
		t.Errorf("par: %v", m)
	}
}
