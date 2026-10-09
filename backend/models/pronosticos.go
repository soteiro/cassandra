package models

// Planificacion: cuánto se demora el usuario de verdad frente a lo que estima, a
// partir de sus proyectos completados que tenían fecha límite.
type Planificacion struct {
	// Proyectos completados con fecha límite considerados.
	Proyectos int `json:"proyectos"`
	// Terminados en la fecha límite o antes.
	ATiempo int `json:"a_tiempo"`
	// Mediana de (tiempo real / tiempo estimado). nil si hay menos de 3 proyectos.
	Factor *float64 `json:"factor,omitempty"`
}

// PronosticoProyecto: cuándo terminaría un proyecto al ritmo reciente, si no entran
// tareas nuevas. Se calcula con el ritmo semanal, nunca con la duración de cada tarea.
type PronosticoProyecto struct {
	TareasAbiertas int `json:"tareas_abiertas"`
	// Tareas del proyecto terminadas en la ventana (últimas SemanasVentana semanas).
	TerminadasVentana int `json:"terminadas_ventana"`
	SemanasVentana    int `json:"semanas_ventana"`
	// Rango en semanas (percentiles 15 y 85). nil si no hay datos suficientes.
	SemanasMin *int `json:"semanas_min,omitempty"`
	SemanasMax *int `json:"semanas_max,omitempty"`
	// Veces que se movió la fecha límite a otro día (según el registro de eventos).
	CambiosFechaLimite int `json:"cambios_fecha_limite"`
}
