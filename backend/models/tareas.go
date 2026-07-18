package models

import "time"

type Tareas struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Descripcion   string    `json:"descripcion"`
	Comentario    string    `json:"comentario"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
	Estado        *string   `json:"estado"`
	UserID        int       `json:"user_id"`
	ProyectID     int       `json:"proyect_id"`
}

// definir que los datos que espera recibir la creacion de una tarea
type TareaRequest struct {
	Nombre      string  `json:"nombre"`
	Descripcion string  `json:"descripcion"`
	Comentario  string  `json:"comentario"`
	Estado      *string `json:"estado"`
	UserID      int     `json:"user_id"`
	ProyectID   int     `json:"proyect_id"`
}

// respuesta que devuelve la creacion de una tarea
type TareaResponse struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Descripcion   string    `json:"descripcion"`
	Comentario    string    `json:"comentario"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Estado        *string   `json:"estado"`
	UserID        int       `json:"user_id"`
	ProyectID     int       `json:"proyect_id"`
}

type TareaUpdateRequest struct {
	Nombre      *string `json:"nombre"`
	Descripcion *string `json:"descripcion"`
	Comentario  *string `json:"comentario"`
	Estado      *string `json:"estado"`
	Eliminado   *bool   `json:"eliminado"`
}

type TareaUpdateResponse struct {
	ID          int     `json:"id"`
	Nombre      string  `json:"nombre"`
	Descripcion string  `json:"descripcion"`
	Comentario  string  `json:"comentario"`
	Estado      *string `json:"estado"`
	Eliminado   bool    `json:"eliminado"`
}
