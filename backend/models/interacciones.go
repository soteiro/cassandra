package models

import "time"

// Interaccion representa el modelo completo de la tabla interacciones
type Interaccion struct {
	ID                 int        `json:"id"`
	UserID             int        `json:"user_id"`
	PersonaID          int        `json:"persona_id"`
	Interaccion        string     `json:"interaccion"`
	FechaCreacion      time.Time  `json:"fecha_creacion"`
	FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	Eliminado          bool       `json:"eliminado"`
}

// InteraccionRequest representa el payload para crear una interacción
type InteraccionRequest struct {
	PersonaID   int    `json:"persona_id"`
	Interaccion string `json:"interaccion"`
	UserID      int    `json:"user_id"`
}

// InteraccionResponse representa la respuesta de una interacción
type InteraccionResponse struct {
	ID                 int        `json:"id"`
	UserID             int        `json:"user_id"`
	PersonaID          int        `json:"persona_id"`
	Interaccion        string     `json:"interaccion"`
	FechaCreacion      time.Time  `json:"fecha_creacion"`
	FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	Eliminado          bool       `json:"eliminado"`
}

// InteraccionUpdateRequest representa el payload para actualizar una interacción
type InteraccionUpdateRequest struct {
	Interaccion *string `json:"interaccion"`
	Eliminado   *bool   `json:"eliminado"`
}
