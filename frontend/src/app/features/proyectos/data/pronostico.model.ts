export interface Planificacion {
  proyectos: number;
  a_tiempo: number;
  /** Mediana de tiempo real / tiempo estimado. Ausente con menos de 3 proyectos. */
  factor?: number;
}

export interface PronosticoProyecto {
  tareas_abiertas: number;
  terminadas_ventana: number;
  semanas_ventana: number;
  semanas_min?: number;
  semanas_max?: number;
  cambios_fecha_limite: number;
}
