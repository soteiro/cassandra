package models

import (
	"strings"
	"time"
)

// Planificación: horario base, bloques de trabajo y disponibilidad para un asistente.
// Fechas "YYYY-MM-DD" y horas "HH:MM" sin zona horaria, como el resto del calendario.

// FranjaHorario: horas en que el usuario puede trabajar un día de la semana (0 = lunes).
type FranjaHorario struct {
	DiaSemana  int    `json:"dia_semana"`
	HoraInicio string `json:"hora_inicio"`
	HoraFin    string `json:"hora_fin"`
}

type HorarioBaseRequest struct {
	Franjas []FranjaHorario `json:"franjas"`
}

// Bloque de trabajo reservado para una tarea.
type Bloque struct {
	ID             int    `json:"id"`
	TareaID        int    `json:"tarea_id"`
	Tarea          string `json:"tarea"`
	ProyectoID     int    `json:"proyecto_id"`
	ProyectoNombre string `json:"proyecto_nombre"`
	Estado         string `json:"estado"`
	Fecha          string `json:"fecha"`
	HoraInicio     string `json:"hora_inicio"`
	HoraFin        string `json:"hora_fin"`
	Origen         string `json:"origen"` // app | mcp
}

type BloqueInput struct {
	Fecha      string `json:"fecha" jsonschema:"Día del bloque, YYYY-MM-DD"`
	HoraInicio string `json:"hora_inicio" jsonschema:"HH:MM"`
	HoraFin    string `json:"hora_fin" jsonschema:"HH:MM, posterior al inicio; 24:00 para terminar a medianoche"`
}

// PlanificarRequest reserva uno o más bloques para una tarea, todos o ninguno.
type PlanificarRequest struct {
	OperacionID string        `json:"operacion_id" jsonschema:"Identificador estable de 8 a 100 caracteres; reusar solo para reintentar la misma planificación"`
	Bloques     []BloqueInput `json:"bloques" jsonschema:"De 1 a 20 bloques; no pueden solaparse entre sí ni con otros bloques"`
}

type PlanificacionResult struct {
	Bloques []Bloque `json:"bloques"`
	// Avisos: bloques que no caen enteros en un hueco libre (se guardan igual).
	Avisos []string `json:"avisos"`
}

// UpdateIntegrationTaskRequest cambia solo los campos presentes.
type UpdateIntegrationTaskRequest struct {
	Estado            *string `json:"estado,omitempty" jsonschema:"Abierto, Pendiente, En Curso, Terminado o Bloqueado. Terminado también cierra sus subtareas"`
	Prioridad         *string `json:"prioridad,omitempty" jsonschema:"baja, normal, alta o urgente"`
	FechaInicio       *string `json:"fecha_inicio,omitempty" jsonschema:"YYYY-MM-DD"`
	FechaLimite       *string `json:"fecha_limite,omitempty" jsonschema:"YYYY-MM-DD; no anterior a fecha_inicio"`
	EstimacionMin     *int    `json:"estimacion_min,omitempty" jsonschema:"Minutos estimados para terminarla, de 1 a 10080"`
	QuitarFechaInicio bool    `json:"quitar_fecha_inicio,omitempty"`
	QuitarFechaLimite bool    `json:"quitar_fecha_limite,omitempty"`
	QuitarEstimacion  bool    `json:"quitar_estimacion,omitempty"`
}

// Disponibilidad: lo que necesita un asistente para repartir tareas en el tiempo libre.
type Disponibilidad struct {
	Desde string `json:"desde"`
	Hasta string `json:"hasta"`
	// Momento desde el que se cuentan los huecos (hora local del cliente).
	Ahora         string              `json:"ahora"`
	HorarioBase   []FranjaHorario     `json:"horario_base"`
	Calendarios   []CalendarioVisible `json:"calendarios"`
	Huecos        []HuecoLibre        `json:"huecos"`
	MinutosLibres int                 `json:"minutos_libres"`
	Eventos       []EventoCalendario  `json:"eventos"`
	Bloques       []Bloque            `json:"bloques"`
	Deadlines     []Deadline          `json:"deadlines"`
	Avisos        []string            `json:"avisos"`
}

// CalendarioVisible: un calendario cuyo contenido puede ver quien consulta.
type CalendarioVisible struct {
	ID             int    `json:"id"`
	Nombre         string `json:"nombre"`
	Tipo           string `json:"tipo"`
	Disponibilidad string `json:"disponibilidad"`
}

type HuecoLibre struct {
	Fecha      string `json:"fecha"`
	HoraInicio string `json:"hora_inicio"`
	HoraFin    string `json:"hora_fin"`
	Minutos    int    `json:"minutos"`
}

// EventoCalendario: una actividad o un turno. Sin calendario_id es tiempo ocupado de un
// calendario o proyecto que quien consulta no puede ver.
type EventoCalendario struct {
	Fecha          string `json:"fecha"`
	HoraInicio     string `json:"hora_inicio,omitempty"`
	HoraFin        string `json:"hora_fin,omitempty"`
	TerminaDiaSig  bool   `json:"termina_dia_siguiente,omitempty"`
	Titulo         string `json:"titulo"`
	CalendarioID   *int   `json:"calendario_id,omitempty"`
	Disponibilidad string `json:"disponibilidad"`
}

func horaPlan(s string) (int, bool) {
	if s == "24:00" {
		return 24 * 60, true
	}
	t, err := time.Parse("15:04", s)
	if err != nil || len(s) != 5 {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

func fechaPlan(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil && len(s) == 10
}

// Validate comprueba fechas, horas y que los bloques no se solapen entre sí.
func (r *PlanificarRequest) Validate() error {
	if !operationIDPattern.MatchString(r.OperacionID) {
		return invalidTask("operacion_id debe tener 8–100 caracteres: letras, números, guion, punto o dos puntos")
	}
	if len(r.Bloques) == 0 || len(r.Bloques) > 20 {
		return invalidTask("se admiten de 1 a 20 bloques")
	}
	type rango struct {
		fecha    string
		ini, fin int
	}
	vistos := []rango{}
	for _, b := range r.Bloques {
		ini, ok1 := horaPlan(b.HoraInicio)
		fin, ok2 := horaPlan(b.HoraFin)
		if !fechaPlan(b.Fecha) || !ok1 || !ok2 || b.HoraInicio == "24:00" {
			return invalidTask("cada bloque necesita fecha YYYY-MM-DD y horas HH:MM")
		}
		if fin <= ini {
			return invalidTask("la hora de fin debe ser posterior a la de inicio")
		}
		for _, v := range vistos {
			if v.fecha == b.Fecha && ini < v.fin && v.ini < fin {
				return invalidTask("los bloques pedidos se solapan entre sí")
			}
		}
		vistos = append(vistos, rango{b.Fecha, ini, fin})
	}
	return nil
}

// Validate normaliza y comprueba el cambio; al menos un campo debe venir.
func (r *UpdateIntegrationTaskRequest) Validate() error {
	if r.Estado == nil && r.Prioridad == nil && r.FechaInicio == nil && r.FechaLimite == nil && r.EstimacionMin == nil &&
		!r.QuitarFechaInicio && !r.QuitarFechaLimite && !r.QuitarEstimacion {
		return invalidTask("no hay cambios")
	}
	if r.Estado != nil {
		switch *r.Estado = strings.TrimSpace(*r.Estado); *r.Estado {
		case "Abierto", "Pendiente", "En Curso", "Terminado", "Bloqueado":
		default:
			return invalidTask("estado debe ser Abierto, Pendiente, En Curso, Terminado o Bloqueado")
		}
	}
	if r.Prioridad != nil {
		*r.Prioridad = strings.ToLower(strings.TrimSpace(*r.Prioridad))
		if !validTaskPriority(*r.Prioridad) {
			return invalidTask("prioridad debe ser baja, normal, alta o urgente")
		}
	}
	for _, f := range []*string{r.FechaInicio, r.FechaLimite} {
		if f != nil && !fechaPlan(*f) {
			return invalidTask("las fechas deben ser YYYY-MM-DD")
		}
	}
	if (r.FechaInicio != nil && r.QuitarFechaInicio) || (r.FechaLimite != nil && r.QuitarFechaLimite) || (r.EstimacionMin != nil && r.QuitarEstimacion) {
		return invalidTask("no se puede fijar y quitar el mismo campo")
	}
	if r.FechaInicio != nil && r.FechaLimite != nil && *r.FechaInicio > *r.FechaLimite {
		return invalidTask("fecha_inicio no puede ser posterior a fecha_limite")
	}
	if r.EstimacionMin != nil && (*r.EstimacionMin < 1 || *r.EstimacionMin > 10080) {
		return invalidTask("estimacion_min debe estar entre 1 y 10080")
	}
	return nil
}
