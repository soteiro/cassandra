export interface TareaEstancada {
  id: number;
  nombre: string;
  estado: string;
  prioridad: string;
  proyecto_id: number;
  proyecto_nombre: string;
  tarea_padre_id?: number;
  fecha_actualizacion: string;
  dias_sin_cambios: number;
}

export interface ResumenRevision {
  terminadas?: number;
  creadas?: number;
  estancadas?: number;
  decisiones?: Record<string, number>;
  proyectos_revisados?: number;
  proyectos_pausados?: number;
}

export interface Revision {
  id: number;
  nota: string;
  resumen: ResumenRevision;
  fecha_creacion: string;
}

export interface Preferencias {
  /** 0 = domingo … 6 = sábado. */
  dia_revision: number;
  limite_en_curso: number;
}
