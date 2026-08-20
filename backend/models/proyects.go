package models

import "time"

// definir la entidad completa
type Proyects struct {
	ID                   int        `json:"id"`
	Nombre               string     `json:"nombre"`
	FechaCreacion        time.Time  `json:"fecha_creacion"`
	Eliminado            bool       `json:"eliminado"`
	Descripcion          string     `json:"descripcion"`
	Comentario           string     `json:"comentario"`
	UserID               int        `json:"user_id"`
	Estado               string     `json:"estado"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
}

// definir los datos que se espera recibir la creacion de un proyecto
type ProyectRequest struct {
	Nombre               string     `json:"nombre"`
	Descripcion          string     `json:"descripcion"`
	Comentario           string     `json:"comentario"`
	UserID               int        `json:"user_id"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
}

// datos que devuelva la creacion de un proyecto
type ProyectResponse struct {
	ID                   int        `json:"id"`
	Nombre               string     `json:"nombre"`
	Descripcion          string     `json:"descripcion"`
	Comentario           string     `json:"comentario"`
	FechaCreacion        time.Time  `json:"fecha_creacion"`
	Estado               string     `json:"estado"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
	SubproyectosCount    int        `json:"subproyectos_count"`
	NombrePadre          *string    `json:"nombre_padre,omitempty"`
}

// el * hace opcional el parametro
type ProyectUpdateRequest struct {
	Nombre               *string    `json:"nombre"`
	Descripcion          *string    `json:"descripcion"`
	Comentario           *string    `json:"comentario"`
	Estado               *string    `json:"estado"`
	PorQue               *string    `json:"por_que"`
	ParaQue              *string    `json:"para_que"`
	CriterioFinalizacion *string    `json:"criterio_finalizacion"`
	Prioridad            *string    `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
}

type ProyectUpdateResponse struct {
	ID                   int        `json:"id"`
	Nombre               string     `json:"nombre"`
	Descripcion          string     `json:"descripcion"`
	Comentario           string     `json:"comentario"`
	Estado               string     `json:"estado"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
}



