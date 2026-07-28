package models

import "time"

// Entidad principal para los logs en crudo de un proyecto
type ProjectLog struct {
	ID            int       `json:"id"`
	ProyectoID    int       `json:"proyecto_id"`
	UserID        int       `json:"user_id"`
	Titulo        string    `json:"titulo"`
	ContenidoRaw  string    `json:"contenido_raw"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

// Datos necesarios para la creación de un log en crudo
type CreateProjectLogRequest struct {
	ProyectoID   int    `json:"proyecto_id"`
	Titulo       string `json:"titulo"`
	ContenidoRaw string `json:"contenido_raw"`
}

// Datos opcionales para la actualización de un log
type UpdateProjectLogRequest struct {
	Titulo       *string `json:"titulo"`
	ContenidoRaw *string `json:"contenido_raw"`
}
