package models

import (
	"encoding/json"
	"time"
)

// ResumenActividad es lo que el usuario hizo en un periodo ("Lo que hiciste").
type ResumenActividad struct {
	Desde                time.Time          `json:"desde"`
	Hasta                time.Time          `json:"hasta"`
	TareasTerminadas     []TareaTerminada   `json:"tareas_terminadas"`
	ProyectosCompletados []ProyectoCompleto `json:"proyectos_completados"`
	Flujo                FlujoTareas        `json:"flujo"`
	Otros                OtraActividad      `json:"otros"`
}

type TareaTerminada struct {
	ID             int       `json:"id"`
	Nombre         string    `json:"nombre"`
	Prioridad      string    `json:"prioridad"`
	ProyectoID     int       `json:"proyecto_id"`
	ProyectoNombre string    `json:"proyecto_nombre"`
	TareaPadreID   *int      `json:"tarea_padre_id,omitempty"`
	FechaTerminado time.Time `json:"fecha_terminado"`
}

type ProyectoCompleto struct {
	ID             int       `json:"id"`
	Nombre         string    `json:"nombre"`
	FechaTerminado time.Time `json:"fecha_terminado"`
}

// FlujoTareas: cuántas tareas entraron y cuántas salieron (terminadas) en el periodo.
type FlujoTareas struct {
	Creadas    int `json:"creadas"`
	Terminadas int `json:"terminadas"`
}

// OtraActividad cuenta lo que no es trabajo: el resumen no mide solo producción.
type OtraActividad struct {
	Interacciones       int `json:"interacciones"`
	PersonasContactadas int `json:"personas_contactadas"`
	Reflexiones         int `json:"reflexiones"`
	Notas               int `json:"notas"`
}

// EventoActividad es un evento del registro con el nombre actual de lo que tocó
// ("En qué quedaste").
type EventoActividad struct {
	ID         int64           `json:"id"`
	Entidad    string          `json:"entidad"`
	EntidadID  int             `json:"entidad_id"`
	Accion     string          `json:"accion"`
	Cambios    json.RawMessage `json:"cambios"`
	Origen     string          `json:"origen"`
	OcurridoEn time.Time       `json:"ocurrido_en"`
	// Nombre de la tarea, documento, log o proyecto; extracto en las notas.
	Nombre *string `json:"nombre,omitempty"`
	// El registro ya no existe o está borrado.
	Eliminado bool `json:"eliminado"`
}
