// Package pronostico calcula pronósticos honestos (rangos, no fechas exactas) a partir
// de lo que el usuario hizo de verdad.
package pronostico

import (
	"math/rand/v2"
	"slices"
)

// MinTerminadas es el mínimo de tareas cerradas en la ventana para pronosticar: con
// menos, el rango no significa nada.
const MinTerminadas = 3

// MinProyectos es el mínimo de proyectos completados con fecha límite para hablar de
// "cuánto te demoras de verdad".
const MinProyectos = 3

const simulaciones = 2000
const maxSemanas = 520

// Rango es el número de semanas para terminar, entre un percentil optimista y uno
// prudente.
type Rango struct {
	SemanasMin int
	SemanasMax int
}

// Semanas simula cuántas semanas tomaría cerrar `abiertas` tareas si cada semana futura
// se parece a una de las semanas pasadas (`porSemana`, cerradas por semana). Devuelve
// los percentiles 15 y 85. ok=false si no hay datos suficientes. `semilla` hace el
// resultado estable entre llamadas.
func Semanas(abiertas int, porSemana []int, semilla uint64) (Rango, bool) {
	total := 0
	for _, n := range porSemana {
		total += n
	}
	if abiertas <= 0 || len(porSemana) == 0 || total < MinTerminadas {
		return Rango{}, false
	}

	r := rand.New(rand.NewPCG(semilla, uint64(abiertas)))
	resultados := make([]int, simulaciones)
	for i := range resultados {
		pendientes, semanas := abiertas, 0
		for pendientes > 0 && semanas < maxSemanas {
			pendientes -= porSemana[r.IntN(len(porSemana))]
			semanas++
		}
		resultados[i] = semanas
	}
	slices.Sort(resultados)
	return Rango{
		SemanasMin: resultados[simulaciones*15/100],
		SemanasMax: resultados[simulaciones*85/100],
	}, true
}

// Mediana de valores (no vacío).
func Mediana(v []float64) float64 {
	s := slices.Clone(v)
	slices.Sort(s)
	n := len(s)
	if n%2 == 1 {
		return s[n/2]
	}
	return (s[n/2-1] + s[n/2]) / 2
}
