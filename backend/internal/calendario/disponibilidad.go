package calendario

import (
	"fmt"
	"sort"
	"time"
)

// MinutosDia: un día en minutos. Las horas del calendario se cuentan en minutos desde
// las 00:00; 24:00 (1440) es el fin del día.
const MinutosDia = 24 * 60

// Intervalo en minutos absolutos desde las 00:00 del primer día del rango. Fin es exclusivo.
// Un intervalo puede pasar la medianoche (una Noche de 20:00 a 08:00).
type Intervalo struct {
	Ini, Fin int
}

// Franja del horario base: minutos del día en que se puede trabajar ese día de la semana.
type Franja struct {
	DiaSemana int
	Ini, Fin  int
}

// Hueco libre dentro de un día: Ini y Fin son minutos de ese día (Fin ≤ 1440).
type Hueco struct {
	Fecha    time.Time
	Ini, Fin int
}

// Minutos de un hueco.
func (h Hueco) Minutos() int { return h.Fin - h.Ini }

// HoraMin lee "HH:MM" (admite "24:00" como fin del día).
func HoraMin(s string) (int, error) {
	if s == "24:00" {
		return MinutosDia, nil
	}
	t, err := time.Parse("15:04", s)
	if err != nil || len(s) != 5 {
		return 0, fmt.Errorf("hora inválida: %q", s)
	}
	return t.Hour()*60 + t.Minute(), nil
}

// FormatoHora escribe minutos del día como "HH:MM" ("24:00" para el fin del día).
func FormatoHora(m int) string {
	return fmt.Sprintf("%02d:%02d", m/60, m%60)
}

// HorarioTurno: horas reales de un turno, relativas al día en que empieza.
// La Noche termina a las 08:00 del día siguiente. Saliente, libre, vacaciones y licencia
// no tienen horario.
func HorarioTurno(codigo string) (ini, fin int, ok bool) {
	switch codigo {
	case "L":
		return 8 * 60, 20 * 60, true
	case "N":
		return 20 * 60, MinutosDia + 8*60, true
	}
	return 0, 0, false
}

// unir ordena y fusiona intervalos que se tocan o se solapan.
func unir(xs []Intervalo) []Intervalo {
	out := make([]Intervalo, 0, len(xs))
	for _, x := range xs {
		if x.Fin > x.Ini {
			out = append(out, x)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Ini < out[j].Ini })
	n := 0
	for _, x := range out {
		if n > 0 && x.Ini <= out[n-1].Fin {
			if x.Fin > out[n-1].Fin {
				out[n-1].Fin = x.Fin
			}
			continue
		}
		out[n] = x
		n++
	}
	return out[:n]
}

// restar quita de a (unido) todo lo que cubre b (unido).
func restar(a, b []Intervalo) []Intervalo {
	out := []Intervalo{}
	j := 0
	for _, x := range a {
		ini := x.Ini
		for j < len(b) && b[j].Fin <= ini {
			j++
		}
		for k := j; k < len(b) && b[k].Ini < x.Fin; k++ {
			if b[k].Ini > ini {
				out = append(out, Intervalo{ini, b[k].Ini})
			}
			if b[k].Fin > ini {
				ini = b[k].Fin
			}
		}
		if ini < x.Fin {
			out = append(out, Intervalo{ini, x.Fin})
		}
	}
	return out
}

// Huecos calcula el tiempo libre de `dias` días desde `desde`: el horario base más lo
// que libera (el colegio), menos lo que ocupa (actividades, bloques ya planificados).
// No devuelve nada antes de `inicio` (minutos absolutos, p. ej. la hora actual) ni
// huecos más cortos que `minimo` minutos. Los huecos se cortan a medianoche.
func Huecos(desde time.Time, dias int, base []Franja, libera, ocupa []Intervalo, inicio, minimo int) []Hueco {
	disponible := append([]Intervalo{}, libera...)
	for d := 0; d < dias; d++ {
		ds := DiaSemana(Dia(desde).AddDate(0, 0, d))
		for _, f := range base {
			if f.DiaSemana == ds {
				disponible = append(disponible, Intervalo{d*MinutosDia + f.Ini, d*MinutosDia + f.Fin})
			}
		}
	}
	// Solo dentro del rango y desde el inicio pedido.
	limite := Intervalo{inicio, dias * MinutosDia}
	if limite.Ini < 0 {
		limite.Ini = 0
	}
	libre := restar(unir(disponible), unir(append(append([]Intervalo{}, ocupa...),
		Intervalo{-MinutosDia, limite.Ini}, Intervalo{limite.Fin, (dias + 1) * MinutosDia})))

	out := []Hueco{}
	for _, x := range libre {
		for ini := x.Ini; ini < x.Fin; {
			d := ini / MinutosDia
			fin := min(x.Fin, (d+1)*MinutosDia)
			if fin-ini >= minimo {
				out = append(out, Hueco{Fecha: Dia(desde).AddDate(0, 0, d), Ini: ini - d*MinutosDia, Fin: fin - d*MinutosDia})
			}
			ini = fin
		}
	}
	return out
}
