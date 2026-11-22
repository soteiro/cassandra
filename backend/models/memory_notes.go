package models

import (
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

// MemoryNote es una nota que el usuario escribió en un proyecto (documentación o negocio),
// vista desde una integración. Las integraciones solo la leen: nunca la crean ni la editan.
type MemoryNote struct {
	ID          int     `json:"id"`
	ProyectoID  int     `json:"proyecto_id"`
	TareaID     *int    `json:"tarea_id"`
	TareaNombre *string `json:"tarea_nombre"`
	Nota        string  `json:"nota"`
	// TextoTruncado indica que la nota se acotó a 4000 caracteres.
	TextoTruncado bool      `json:"texto_truncado"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

type MemoryNoteQuery struct {
	Consulta string `json:"consulta,omitempty" jsonschema:"Búsqueda textual literal en el texto de la nota; hasta 300 bytes"`
	TareaID  *int   `json:"tarea_id,omitempty" jsonschema:"Filtrar notas de una tarea; 0 para notas sin tarea (negocio, documentación general); omitir para todas"`
	Limit    int    `json:"limit,omitempty" jsonschema:"Resultados por página, de 1 a 20; por defecto 10"`
	Offset   int    `json:"offset,omitempty" jsonschema:"Desplazamiento de 0 a 10000; orden de la más reciente a la más antigua"`
}

type MemoryNoteList struct {
	Notas  []MemoryNote `json:"notas"`
	HayMas bool         `json:"hay_mas"`
}

// Validate normaliza la consulta y acota la paginación.
func (q *MemoryNoteQuery) Validate() error {
	q.Consulta = strings.TrimSpace(q.Consulta)
	if q.Limit == 0 {
		q.Limit = 10
	}
	if q.Limit < 1 || q.Limit > 20 || q.Offset < 0 || q.Offset > 10000 {
		return invalidMemory("limit debe estar entre 1 y 20 y offset entre 0 y 10000")
	}
	if len(q.Consulta) > 300 || !utf8.ValidString(q.Consulta) || strings.ContainsRune(q.Consulta, '\x00') {
		return invalidMemory("consulta admite hasta 300 bytes de texto UTF-8 sin NUL")
	}
	if q.TareaID != nil && (*q.TareaID < 0 || *q.TareaID > math.MaxInt32) {
		return invalidMemory("tarea_id debe estar entre 0 y 2147483647")
	}
	return nil
}
