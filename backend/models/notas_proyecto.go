package models

import "time"

type NotasProyecto struct {
	ID            int       `json:"id"`
	ProyectoID    int       `json:"proyecto_id"`
	Nota          string    `json:"nota"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	UserID        int       `json:"user_id"`
	Eliminado     bool      `json:"eliminado"`
}

// Request para la creación de una nota de proyecto
type NotasProyectoRequest struct {
	ProyectoID int    `json:"proyecto_id"`
	Nota       string `json:"nota"`
	UserID     int    `json:"user_id"`
}

// Response para notas de proyecto
type NotasProyectoResponse struct {
	ID            int       `json:"id"`
	ProyectoID    int       `json:"proyecto_id"`
	Nota          string    `json:"nota"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	UserID        int       `json:"user_id"`
	Eliminado     bool      `json:"eliminado"`
}

// Request para la actualización de una nota de proyecto
type NotasProyectoUpdateRequest struct {
	Nota      *string `json:"nota"`
	Eliminado *bool   `json:"eliminado"`
}

// Alias para compatibilidad con código existente
type NotasProyectoUpdateResponse = NotasProyectoResponse

