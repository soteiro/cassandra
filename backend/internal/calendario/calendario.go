// Package calendario calcula los días del calendario a partir de reglas: el turno de cada
// día según un ciclo con excepciones, y las ocurrencias de actividades semanales.
// Son funciones puras para que el repositorio solo lea filas y aquí se pruebe la lógica.
package calendario

import (
	"time"
)

// Formato de las fechas del calendario.
const Layout = "2006-01-02"

// CuartoTurno: Largo, Noche, Saliente y Libre, uno por día.
var CuartoTurno = []string{"L", "N", "S", "F"}

// Códigos válidos de un día de turnos (los del ciclo más vacaciones y licencia).
var CodigosTurno = map[string]bool{"L": true, "N": true, "S": true, "F": true, "V": true, "M": true}

// Ciclo rige desde Desde, contando el patrón a partir de Ancla.
type Ciclo struct {
	Desde time.Time
	Ancla time.Time
}

// Dia es un día del calendario sin hora (medianoche UTC).
func Dia(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// ParseDia lee "YYYY-MM-DD".
func ParseDia(s string) (time.Time, error) {
	return time.Parse(Layout, s)
}

// diasEntre cuenta los días de a hasta b (negativo si b es anterior).
func diasEntre(a, b time.Time) int {
	return int(Dia(b).Sub(Dia(a)).Hours() / 24)
}

// TurnoBase devuelve el código que da el ciclo para el día, o "" si ningún ciclo rige.
// ciclos debe venir ordenado por Desde ascendente.
func TurnoBase(dia time.Time, ciclos []Ciclo) string {
	var vigente *Ciclo
	for i := range ciclos {
		if !Dia(ciclos[i].Desde).After(Dia(dia)) {
			vigente = &ciclos[i]
		}
	}
	if vigente == nil {
		return ""
	}
	n := len(CuartoTurno)
	i := ((diasEntre(vigente.Ancla, dia) % n) + n) % n
	return CuartoTurno[i]
}

// DiaSemana: 0 = lunes … 6 = domingo.
func DiaSemana(t time.Time) int {
	return (int(t.Weekday()) + 6) % 7
}

// Regla de una actividad: una sola vez (Dias vacío) o semanal desde Fecha hasta Hasta.
type Regla struct {
	Fecha time.Time
	Dias  []int
	Hasta *time.Time
}

// Ocurrencias devuelve los días entre desde y hasta (inclusive) en que ocurre la regla.
func Ocurrencias(r Regla, desde, hasta time.Time) []time.Time {
	desde, hasta = Dia(desde), Dia(hasta)
	inicio := Dia(r.Fecha)
	if len(r.Dias) == 0 {
		if inicio.Before(desde) || inicio.After(hasta) {
			return nil
		}
		return []time.Time{inicio}
	}
	fin := hasta
	if r.Hasta != nil && Dia(*r.Hasta).Before(fin) {
		fin = Dia(*r.Hasta)
	}
	if inicio.After(desde) {
		desde = inicio
	}
	dias := map[int]bool{}
	for _, d := range r.Dias {
		dias[d] = true
	}
	var out []time.Time
	for d := desde; !d.After(fin); d = d.AddDate(0, 0, 1) {
		if dias[DiaSemana(d)] {
			out = append(out, d)
		}
	}
	return out
}
