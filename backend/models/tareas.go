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
	Prioridad      string     `json:"prioridad"`
	UserID         int        `json:"user_id"`
	ProjectID      int        `json:"proyect_id"`
	TareaPadreID   *int       `json:"tarea_padre_id,omitempty"`
	FechaInicio    *time.Time `json:"fecha_inicio"`
	FechaLimite    *time.Time `json:"fecha_limite"`
}

// definir que los datos que espera recibir la creacion de una tarea
type TareaRequest struct {
	Nombre       string  `json:"nombre"`
	Descripcion  string  `json:"descripcion"`
	Comentario   string  `json:"comentario"`
	Estado       *string `json:"estado"`
	Prioridad    *string `json:"prioridad,omitempty"`
	UserID       int     `json:"user_id"`
	ProjectID    int     `json:"proyect_id"`
	TareaPadreID *int    `json:"tarea_padre_id,omitempty"`
	// Fechas del calendario: el cliente manda la medianoche UTC del día.
	FechaInicio *time.Time `json:"fecha_inicio,omitempty"`
	FechaLimite *time.Time `json:"fecha_limite,omitempty"`
}

// respuesta que devuelve la creacion de una tarea
type TareaResponse struct {
	ID                 int             `json:"id"`
	Nombre             string          `json:"nombre"`
	Descripcion        string          `json:"descripcion"`
	Comentario         string          `json:"comentario"`
	FechaCreacion      time.Time       `json:"fecha_creacion"`
	FechaTerminado     *time.Time      `json:"fecha_terminado,omitempty"`
	FechaActualizacion *time.Time      `json:"fecha_actualizacion,omitempty"`
	Estado             *string         `json:"estado"`
	Prioridad          string          `json:"prioridad"`
	UserID             int             `json:"user_id"`
	ProjectID          int             `json:"proyect_id"`
	ProyectoNombre     *string         `json:"proyecto_nombre,omitempty"`
	TareaPadreID       *int            `json:"tarea_padre_id,omitempty"`
	FechaInicio        *time.Time      `json:"fecha_inicio"`
	FechaLimite        *time.Time      `json:"fecha_limite"`
	Subtareas          []TareaResponse `json:"subtareas,omitempty"`
}

type TareaUpdateRequest struct {
	Nombre       *string    `json:"nombre"`
	Descripcion  *string    `json:"descripcion"`
	Comentario   *string    `json:"comentario"`
	Estado       *string    `json:"estado"`
	Prioridad    *string    `json:"prioridad,omitempty"`
	Eliminado    *bool      `json:"eliminado"`
	TareaPadreID *int       `json:"tarea_padre_id,omitempty"`
	FechaInicio  *time.Time `json:"fecha_inicio,omitempty"`
	FechaLimite  *time.Time `json:"fecha_limite,omitempty"`
	// true quita la fecha (con COALESCE no se puede mandar null).
	ClearFechaInicio *bool `json:"clear_fecha_inicio,omitempty"`
	ClearFechaLimite *bool `json:"clear_fecha_limite,omitempty"`
}

type TareaUpdateResponse struct {
	ID             int        `json:"id"`
	Nombre         string     `json:"nombre"`
	Descripcion    string     `json:"descripcion"`
	Comentario     string     `json:"comentario"`
	Estado         *string    `json:"estado"`
	Prioridad      string     `json:"prioridad"`
	FechaTerminado *time.Time `json:"fecha_terminado,omitempty"`
	Eliminado      bool       `json:"eliminado"`
	TareaPadreID   *int       `json:"tarea_padre_id,omitempty"`
	FechaInicio    *time.Time `json:"fecha_inicio"`
	FechaLimite    *time.Time `json:"fecha_limite"`
}
