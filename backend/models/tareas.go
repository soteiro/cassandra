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
	EstimacionMin  *int       `json:"estimacion_min"`
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
	// Minutos estimados para terminarla (1 a 10080).
	EstimacionMin *int `json:"estimacion_min,omitempty"`
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
	EstimacionMin      *int            `json:"estimacion_min"`
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
	EstimacionMin    *int  `json:"estimacion_min,omitempty"`
	ClearEstimacion  *bool `json:"clear_estimacion,omitempty"`
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
	EstimacionMin  *int       `json:"estimacion_min"`
}
