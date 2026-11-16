package models

// Las fechas del calendario viajan como "YYYY-MM-DD" y las horas como "HH:MM": son días y
// horas de la vida diaria, sin zona horaria.

// Calendario propio: de turnos (ciclo) o de actividades (horarios).
type Calendario struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Color  string `json:"color"`
	Tipo   string `json:"tipo"`
	Oculto bool   `json:"oculto"`
	// Cómo cuenta para los huecos libres: ocupa, libera o contexto.
	Disponibilidad string `json:"disponibilidad"`
	// Ciclo vigente (solo turnos): primer día del ciclo que rige hoy. nil = sin configurar.
	PrimerLargo *string `json:"primer_largo,omitempty"`
}

type CalendarioRequest struct {
	Nombre string `json:"nombre"`
	Color  string `json:"color"`
	Tipo   string `json:"tipo"`
	// Vacío: contexto para turnos y ocupa para actividades.
	Disponibilidad string `json:"disponibilidad,omitempty"`
}

type CalendarioUpdateRequest struct {
	Nombre         *string `json:"nombre"`
	Color          *string `json:"color"`
	Oculto         *bool   `json:"oculto"`
	Disponibilidad *string `json:"disponibilidad,omitempty"`
}

// DisponibilidadValida: ocupa, libera o contexto.
func DisponibilidadValida(s string) bool {
	return s == "ocupa" || s == "libera" || s == "contexto"
}

// CicloRequest fija el primer Largo: desde esa fecha se recalcula el ciclo.
type CicloRequest struct {
	PrimerLargo string `json:"primer_largo"`
}

type ExcepcionRequest struct {
	Codigo string `json:"codigo"`
}

type ActividadRequest struct {
	Titulo     string `json:"titulo"`
	Fecha      string `json:"fecha"`
	HoraInicio string `json:"hora_inicio"`
	HoraFin    string `json:"hora_fin"`
	// Vacío = una sola vez. 0 = lunes … 6 = domingo.
	DiasSemana []int   `json:"dias_semana"`
	Hasta      *string `json:"hasta"`
}

type Actividad struct {
	ID           int     `json:"id"`
	CalendarioID int     `json:"calendario_id"`
	Titulo       string  `json:"titulo"`
	Fecha        string  `json:"fecha"`
	HoraInicio   string  `json:"hora_inicio"`
	HoraFin      string  `json:"hora_fin"`
	DiasSemana   []int   `json:"dias_semana"`
	Hasta        *string `json:"hasta,omitempty"`
}

// Rango del calendario: todo lo que hay que dibujar entre dos fechas.
type CalendarioRango struct {
	Desde            string          `json:"desde"`
	Hasta            string          `json:"hasta"`
	OcultarDeadlines bool            `json:"ocultar_deadlines"`
	Calendarios      []Calendario    `json:"calendarios"`
	Deadlines        []Deadline      `json:"deadlines"`
	Turnos           []TurnoDia      `json:"turnos"`
	Ocurrencias      []OcurrenciaDia `json:"ocurrencias"`
	Bloques          []Bloque        `json:"bloques"`
}

// Deadline: tarea o proyecto pendiente con fecha límite.
type Deadline struct {
	Tipo           string  `json:"tipo"` // tarea | proyecto
	ID             int     `json:"id"`
	Titulo         string  `json:"titulo"`
	ProyectoID     int     `json:"proyecto_id"`
	ProyectoNombre string  `json:"proyecto_nombre"`
	Estado         string  `json:"estado"`
	FechaInicio    *string `json:"fecha_inicio,omitempty"`
	FechaLimite    string  `json:"fecha_limite"`
}

// TurnoDia: el turno de un día. Base es lo que dice el ciclo; Codigo, lo que vale.
type TurnoDia struct {
	CalendarioID int    `json:"calendario_id"`
	Fecha        string `json:"fecha"`
	Codigo       string `json:"codigo"`
	Base         string `json:"base"`
	Cambio       bool   `json:"cambio"`
}

// OcurrenciaDia: una actividad en un día concreto.
type OcurrenciaDia struct {
	ActividadID  int    `json:"actividad_id"`
	CalendarioID int    `json:"calendario_id"`
	Fecha        string `json:"fecha"`
	Titulo       string `json:"titulo"`
	HoraInicio   string `json:"hora_inicio"`
	HoraFin      string `json:"hora_fin"`
	Semanal      bool   `json:"semanal"`
	Cancelada    bool   `json:"cancelada"`
}
