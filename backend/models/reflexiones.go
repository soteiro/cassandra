package models

import "time"

// Reflexion representa el modelo completo de la tabla reflexiones
type Reflexion struct {
	ID                 int        `json:"id"`
	UserID             int        `json:"user_id"`
	Reflexion          string     `json:"reflexion"`
	Tipo               string     `json:"tipo"`
	FechaCreacion      time.Time  `json:"fecha_creacion"`
	FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	Eliminado          bool       `json:"eliminado"`
}

// CreateReflexionRequest representa el payload para crear una reflexión
type CreateReflexionRequest struct {
	Reflexion string `json:"reflexion"`
	Tipo      string `json:"tipo"`
	UserID    int    `json:"user_id"`
}

// ReflexionResponse representa la respuesta devuelta al cliente
type ReflexionResponse struct {
	ID                 int        `json:"id"`
	UserID             int        `json:"user_id"`
	Reflexion          string     `json:"reflexion"`
	Tipo               string     `json:"tipo"`
	FechaCreacion      time.Time  `json:"fecha_creacion"`
	FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	Eliminado          bool       `json:"eliminado"`
}

// UpdateReflexionRequest representa el payload para actualizar una reflexión
type UpdateReflexionRequest struct {
	Reflexion *string `json:"reflexion"`
	Tipo      *string `json:"tipo"`
	Eliminado *bool   `json:"eliminado"`
}
