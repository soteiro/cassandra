package models

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrTaskInvalid = errors.New("entrada de tarea inválida")
var ErrTaskOperationConflict = errors.New("operacion_id ya fue usado para crear una tarea con otros datos")

const TaskTextLimit = 4000

// IntegrationTask usa proyecto_id en el contrato de integración y no expone user_id.
// Las lecturas acotan también textos antiguos creados desde otros clientes.
type IntegrationTask struct {
	ID                 int        `json:"id"`
	ProyectoID         int        `json:"proyecto_id"`
	Nombre             string     `json:"nombre"`
	Descripcion        string     `json:"descripcion"`
	Comentario         string     `json:"comentario"`
	Estado             string     `json:"estado"`
	Prioridad          string     `json:"prioridad"`
	TareaPadreID       *int       `json:"tarea_padre_id"`
	FechaCreacion      time.Time  `json:"fecha_creacion"`
	FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	FechaTerminado     *time.Time `json:"fecha_terminado"`
	TextoTruncado      bool       `json:"texto_truncado"`
}

type CreateIntegrationTaskRequest struct {
	OperacionID  string `json:"operacion_id" jsonschema:"Identificador estable de 8 a 100 caracteres; reusar solo para reintentar la misma creación"`
	Nombre       string `json:"nombre" jsonschema:"Nombre de la tarea, de 1 a 500 caracteres"`
	Descripcion  string `json:"descripcion,omitempty" jsonschema:"Hasta 4000 caracteres"`
	Comentario   string `json:"comentario,omitempty" jsonschema:"Hasta 4000 caracteres"`
	Prioridad    string `json:"prioridad,omitempty" jsonschema:"baja, normal, alta o urgente; por defecto normal"`
	TareaPadreID *int   `json:"tarea_padre_id,omitempty" jsonschema:"Tarea existente del mismo proyecto; omitir para crear una tarea principal"`
}

type IntegrationTaskQuery struct {
	Consulta     string `json:"consulta,omitempty" jsonschema:"Búsqueda textual literal en nombre, descripción y comentario; hasta 300 bytes"`
	Estado       string `json:"estado,omitempty" jsonschema:"Abierto, Pendiente, En Curso, Terminado o Bloqueado"`
	Prioridad    string `json:"prioridad,omitempty" jsonschema:"baja, normal, alta o urgente"`
	TareaPadreID *int   `json:"tarea_padre_id,omitempty" jsonschema:"Filtrar subtareas directas; 0 para tareas principales; omitir para todas"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Resultados por página, de 1 a 20; por defecto 10"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Desplazamiento de 0 a 10000; orden por ID descendente"`
}

type IntegrationTaskList struct {
	Tareas []IntegrationTask `json:"tareas"`
	HayMas bool              `json:"hay_mas"`
}

func invalidTask(message string) error { return fmt.Errorf("%w: %s", ErrTaskInvalid, message) }

func validTaskPriority(priority string) bool {
	switch priority {
	case "baja", "normal", "alta", "urgente":
		return true
	}
	return false
}

// Validate normaliza antes de calcular la huella de idempotencia.
func (r *CreateIntegrationTaskRequest) Validate() error {
	r.Nombre = strings.TrimSpace(r.Nombre)
	r.Descripcion = strings.TrimSpace(r.Descripcion)
	r.Comentario = strings.TrimSpace(r.Comentario)
	r.Prioridad = strings.ToLower(strings.TrimSpace(r.Prioridad))
	if !operationIDPattern.MatchString(r.OperacionID) {
		return invalidTask("operacion_id debe tener 8–100 caracteres: letras, números, guion, punto o dos puntos")
	}
	if r.Nombre == "" || utf8.RuneCountInString(r.Nombre) > 500 {
		return invalidTask("nombre debe tener entre 1 y 500 caracteres")
	}
	for _, value := range []string{r.Nombre, r.Descripcion, r.Comentario} {
		if !utf8.ValidString(value) || strings.ContainsRune(value, '\x00') {
			return invalidTask("los textos deben ser UTF-8 válido y no contener NUL")
		}
	}
	if utf8.RuneCountInString(r.Descripcion) > TaskTextLimit || utf8.RuneCountInString(r.Comentario) > TaskTextLimit {
		return invalidTask("descripción y comentario admiten hasta 4000 caracteres cada uno")
	}
	if r.Prioridad == "" {
		r.Prioridad = "normal"
	}
	if !validTaskPriority(r.Prioridad) {
		return invalidTask("prioridad debe ser baja, normal, alta o urgente")
	}
	if r.TareaPadreID != nil && (*r.TareaPadreID <= 0 || *r.TareaPadreID > math.MaxInt32) {
		return invalidTask("tarea_padre_id debe ser un entero positivo de 32 bits")
	}
	return nil
}

func (q *IntegrationTaskQuery) Validate() error {
	q.Consulta = strings.TrimSpace(q.Consulta)
	q.Estado = strings.TrimSpace(q.Estado)
	q.Prioridad = strings.ToLower(strings.TrimSpace(q.Prioridad))
	if q.Limit == 0 {
		q.Limit = 10
	}
	if q.Limit < 1 || q.Limit > 20 || q.Offset < 0 || q.Offset > 10000 {
		return invalidTask("limit debe estar entre 1 y 20 y offset entre 0 y 10000")
	}
	if len(q.Consulta) > 300 || !utf8.ValidString(q.Consulta) || strings.ContainsRune(q.Consulta, '\x00') {
		return invalidTask("consulta admite hasta 300 bytes de texto UTF-8 sin NUL")
	}
	switch q.Estado {
	case "", "Abierto", "Pendiente", "En Curso", "Terminado", "Bloqueado":
	default:
		return invalidTask("estado debe ser Abierto, Pendiente, En Curso, Terminado o Bloqueado")
	}
	if q.Prioridad != "" && !validTaskPriority(q.Prioridad) {
		return invalidTask("prioridad debe ser baja, normal, alta o urgente")
	}
	if q.TareaPadreID != nil && (*q.TareaPadreID < 0 || *q.TareaPadreID > math.MaxInt32) {
		return invalidTask("tarea_padre_id debe estar entre 0 y 2147483647")
	}
	return nil
}
