package models

import "time"

// User representa la entidad completa en la base de datos
type User struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Alias         string    `json:"alias"`
	Email         string    `json:"email"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
	Password      string    `json:"-"` // El tag "-" evita que el password se envíe en los JSON por seguridad
}

// UserRequest define los datos que esperamos recibir cuando se crea un usuario
type UserRequest struct {
	Nombre   string `json:"nombre"`
	Alias    string `json:"alias"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// UserResponse define los datos seguros que devolvemos al cliente
type UserResponse struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Alias         string    `json:"alias"`
	Email         string    `json:"email"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

type UserUpdateRequest struct {
	Nombre string `json:"nombre"`
	Alias string `json:"alias"`
	Email string `json:"email"`
}
