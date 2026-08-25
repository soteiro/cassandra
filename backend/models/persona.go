package models

import "time"

// Modelo completo de la tabla persona
type Persona struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	Alias         string    `json:"alias"`
	Entorno       string    `json:"entorno"`
	Informacion   string    `json:"informacion"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
	EsYo          bool      `json:"es_yo"`
}

// Request para crear una persona
type PersonaRequest struct {
	Nombre      string `json:"nombre"`
	Alias       string `json:"alias"`
	Entorno     string `json:"entorno"`
	Informacion string `json:"informacion"`
	UserID      int    `json:"user_id"`
	EsYo        bool   `json:"es_yo"`
}

// Response para persona
type PersonaResponse struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	Alias         string    `json:"alias"`
	Entorno       string    `json:"entorno"`
	Informacion   string    `json:"informacion"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
	EsYo          bool      `json:"es_yo"`
}

// Request para actualizar una persona
type PersonaUpdateRequest struct {
	Nombre      *string `json:"nombre"`
	Alias       *string `json:"alias"`
	Entorno     *string `json:"entorno"`
	Informacion *string `json:"informacion"`
	Eliminado   *bool   `json:"eliminado"`
	EsYo        *bool   `json:"es_yo"`
}