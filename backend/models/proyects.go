package models

import "time"

// definir la entidad completa
type Proyects struct {
	ID                   int        `json:"id"`
	Nombre               string     `json:"nombre"`
	FechaCreacion        time.Time  `json:"fecha_creacion"`
	FechaTerminado       *time.Time `json:"fecha_terminado,omitempty"`
	Eliminado            bool       `json:"eliminado"`
	Descripcion          string     `json:"descripcion"`
	Comentario           string     `json:"comentario"`
	UserID               int        `json:"user_id"`
	Estado               string     `json:"estado"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	// Pre-mortem: "¿por qué podría fracasar?", escrito al crear el proyecto.
	Premortem       string     `json:"premortem"`
	Prioridad       string     `json:"prioridad"`
	FechaLimite     *time.Time `json:"fecha_limite"`
	ProyectoPadreID *int       `json:"proyecto_padre_id"`
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
	Premortem            string     `json:"premortem"`
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
	FechaTerminado       *time.Time `json:"fecha_terminado,omitempty"`
	FechaActualizacion   *time.Time `json:"fecha_actualizacion,omitempty"`
	Estado               string     `json:"estado"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Premortem            string     `json:"premortem"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
	SubproyectosCount    int        `json:"subproyectos_count"`
	NombrePadre          *string    `json:"nombre_padre,omitempty"`
	// Último evento del proyecto o de lo que cuelga de él (tareas, notas, documentos, logs).
	UltimaActividad *time.Time `json:"ultima_actividad,omitempty"`
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
	Premortem            *string    `json:"premortem"`
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
	FechaTerminado       *time.Time `json:"fecha_terminado,omitempty"`
	PorQue               string     `json:"por_que"`
	ParaQue              string     `json:"para_que"`
	CriterioFinalizacion string     `json:"criterio_finalizacion"`
	Premortem            string     `json:"premortem"`
	Prioridad            string     `json:"prioridad"`
	FechaLimite          *time.Time `json:"fecha_limite"`
	ProyectoPadreID      *int       `json:"proyecto_padre_id"`
}
