package calendario

import (
	"reflect"
	"testing"
)

func h(t *testing.T, s string) int {
	t.Helper()
	m, err := HoraMin(s)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func huecosTexto(hs []Hueco) []string {
	out := []string{}
	for _, x := range hs {
		out = append(out, x.Fecha.Format(Layout)+" "+FormatoHora(x.Ini)+"-"+FormatoHora(x.Fin))
	}
	return out
}

func TestHoraMin(t *testing.T) {
	if h(t, "08:30") != 510 || h(t, "24:00") != 1440 || FormatoHora(1440) != "24:00" || FormatoHora(65) != "01:05" {
		t.Fatal("conversión de horas")
	}
	for _, mal := range []string{"8:30", "25:00", "aa:bb", "24:01"} {
		if _, err := HoraMin(mal); err == nil {
			t.Errorf("%q debería ser inválida", mal)
		}
	}
}

func TestHuecosBaseMenosOcupado(t *testing.T) {
	// Lunes 16: base 09–18, terapia 11–12 y un bloque 15–16.
	desde := dia(t, "2026-11-16")
	base := []Franja{{DiaSemana: 0, Ini: h(t, "09:00"), Fin: h(t, "18:00")}}
	ocupa := []Intervalo{{h(t, "11:00"), h(t, "12:00")}, {h(t, "15:00"), h(t, "16:00")}}
	got := huecosTexto(Huecos(desde, 1, base, nil, ocupa, 0, 15))
	want := []string{"2026-11-16 09:00-11:00", "2026-11-16 12:00-15:00", "2026-11-16 16:00-18:00"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("huecos %v, se esperaban %v", got, want)
	}
}

func TestHuecosLiberaSumaAlBase(t *testing.T) {
	// El colegio (08–13) libera tiempo antes del horario base (10–18) y se une con él.
	desde := dia(t, "2026-11-16")
	base := []Franja{{DiaSemana: 0, Ini: h(t, "10:00"), Fin: h(t, "18:00")}}
	libera := []Intervalo{{h(t, "08:00"), h(t, "13:00")}}
	got := huecosTexto(Huecos(desde, 1, base, libera, nil, 0, 15))
	if want := []string{"2026-11-16 08:00-18:00"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("huecos %v, se esperaban %v", got, want)
	}
}

func TestHuecosOcupaCruzaMedianocheYCortaPorDia(t *testing.T) {
	// Base todo el día martes y miércoles; una noche de 20:00 a 08:00 ocupa.
	desde := dia(t, "2026-11-17")
	base := []Franja{{1, 0, MinutosDia}, {2, 0, MinutosDia}}
	ocupa := []Intervalo{{h(t, "20:00"), MinutosDia + h(t, "08:00")}}
	got := huecosTexto(Huecos(desde, 2, base, nil, ocupa, 0, 15))
	want := []string{"2026-11-17 00:00-20:00", "2026-11-18 08:00-24:00"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("huecos %v, se esperaban %v", got, want)
	}
}

func TestHuecosDesdeAhoraYMinimo(t *testing.T) {
	desde := dia(t, "2026-11-16")
	base := []Franja{{0, h(t, "09:00"), h(t, "18:00")}}
	ocupa := []Intervalo{{h(t, "10:00"), h(t, "17:50")}}
	// A las 09:40 queda 09:40–10:00 (20 min) y 17:50–18:00 (10 min, bajo el mínimo).
	got := huecosTexto(Huecos(desde, 1, base, nil, ocupa, h(t, "09:40"), 15))
	if want := []string{"2026-11-16 09:40-10:00"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("huecos %v, se esperaban %v", got, want)
	}
}

func TestHuecosLiberaFueraDelRangoNoSale(t *testing.T) {
	desde := dia(t, "2026-11-16")
	libera := []Intervalo{{-60, 60}, {MinutosDia - 60, MinutosDia + 60}}
	got := huecosTexto(Huecos(desde, 1, nil, libera, nil, 0, 15))
	want := []string{"2026-11-16 00:00-01:00", "2026-11-16 23:00-24:00"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("huecos %v, se esperaban %v", got, want)
	}
}

func TestHorarioTurno(t *testing.T) {
	if i, f, ok := HorarioTurno("N"); !ok || i != 1200 || f != 1920 {
		t.Fatal("noche")
	}
	if _, _, ok := HorarioTurno("S"); ok {
		t.Fatal("saliente no tiene horario")
	}
}
