package models

import (
	"encoding/json"
	"time"
)

// Revision es una revisión semanal guardada.
type Revision struct {
	ID            int             `json:"id"`
	Nota          string          `json:"nota"`
	Resumen       json.RawMessage `json:"resumen"`
	FechaCreacion time.Time       `json:"fecha_creacion"`
}

type RevisionRequest struct {
	Nota    string          `json:"nota"`
	Resumen json.RawMessage `json:"resumen"`
}

// TareaEstancada: tarea abierta de un proyecto activo que no cambia hace días.
type TareaEstancada struct {
	ID                 int       `json:"id"`
	Nombre             string    `json:"nombre"`
	Estado             string    `json:"estado"`
	Prioridad          string    `json:"prioridad"`
	ProyectoID         int       `json:"proyecto_id"`
	ProyectoNombre     string    `json:"proyecto_nombre"`
	TareaPadreID       *int      `json:"tarea_padre_id,omitempty"`
	FechaActualizacion time.Time `json:"fecha_actualizacion"`
	DiasSinCambios     int       `json:"dias_sin_cambios"`
}

// Preferencias del usuario que también le sirven al agente.
type Preferencias struct {
	// 0 = domingo … 6 = sábado.
	DiaRevision   int `json:"dia_revision"`
	LimiteEnCurso int `json:"limite_en_curso"`
}

type PreferenciasUpdate struct {
	DiaRevision   *int `json:"dia_revision"`
	LimiteEnCurso *int `json:"limite_en_curso"`
}
