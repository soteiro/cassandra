package models

import "time"

type DocumentoProyecto struct {
	ID                 int       `json:"id"`
	ProyectoID         int       `json:"proyecto_id"`
	UserID             int       `json:"user_id"`
	Titulo             string    `json:"titulo"`
	Contenido          string    `json:"contenido"`
	Tipo               string    `json:"tipo"`
	Tags               *string   `json:"tags,omitempty"`
	FechaCreacion      time.Time `json:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion"`
	Eliminado          bool      `json:"eliminado"`
}

type CreateDocumentoRequest struct {
	ProyectoID int     `json:"proyecto_id"`
	UserID     int     `json:"user_id"`
	Titulo     string  `json:"titulo"`
	Contenido  string  `json:"contenido"`
	Tipo       string  `json:"tipo"`
	Tags       *string `json:"tags,omitempty"`
}

type UpdateDocumentoRequest struct {
	Titulo    *string `json:"titulo"`
	Contenido *string `json:"contenido"`
	Tipo      *string `json:"tipo"`
	Tags      *string `json:"tags"`
	Eliminado *bool   `json:"eliminado"`
}

type DocumentoResponse = DocumentoProyecto
