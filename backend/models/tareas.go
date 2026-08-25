package models

import "time"

type Tareas struct {
	ID             int        `json:"id"`
	Nombre         string     `json:"nombre"`
	Descripcion    string     `json:"descripcion"`
	Comentario     string     `json:"comentario"`
	FechaCreacion  time.Time  `json:"fecha_creacion"`
	FechaTerminado *time.Time `json:"fecha_terminado,omitempty"`
	Eliminado      bool       `json:"eliminado"`
	Estado         *string    `json:"estado"`
	UserID         int        `json:"user_id"`
	ProyectID      int        `json:"proyect_id"`
	TareaPadreID   *int       `json:"tarea_padre_id,omitempty"`
}

// definir que los datos que espera recibir la creacion de una tarea
type TareaRequest struct {
	Nombre       string  `json:"nombre"`
	Descripcion  string  `json:"descripcion"`
	Comentario   string  `json:"comentario"`
	Estado       *string `json:"estado"`
	UserID       int     `json:"user_id"`
	ProyectID    int     `json:"proyect_id"`
	TareaPadreID *int    `json:"tarea_padre_id,omitempty"`
}

// respuesta que devuelve la creacion de una tarea
type TareaResponse struct {
	ID             int             `json:"id"`
	Nombre         string          `json:"nombre"`
	Descripcion    string          `json:"descripcion"`
	Comentario     string          `json:"comentario"`
	FechaCreacion  time.Time       `json:"fecha_creacion"`
	FechaTerminado *time.Time      `json:"fecha_terminado,omitempty"`
	Estado         *string         `json:"estado"`
	UserID         int             `json:"user_id"`
	ProyectID      int             `json:"proyect_id"`
	ProyectoNombre *string         `json:"proyecto_nombre,omitempty"`
	TareaPadreID   *int            `json:"tarea_padre_id,omitempty"`
	Subtareas      []TareaResponse `json:"subtareas,omitempty"`
}

type TareaUpdateRequest struct {
	Nombre       *string `json:"nombre"`
	Descripcion  *string `json:"descripcion"`
	Comentario   *string `json:"comentario"`
	Estado       *string `json:"estado"`
	Eliminado    *bool   `json:"eliminado"`
	TareaPadreID *int    `json:"tarea_padre_id,omitempty"`
}

type TareaUpdateResponse struct {
	ID             int        `json:"id"`
	Nombre         string     `json:"nombre"`
	Descripcion    string     `json:"descripcion"`
	Comentario     string     `json:"comentario"`
	Estado         *string    `json:"estado"`
	FechaTerminado *time.Time `json:"fecha_terminado,omitempty"`
	Eliminado      bool       `json:"eliminado"`
	TareaPadreID   *int       `json:"tarea_padre_id,omitempty"`
}
