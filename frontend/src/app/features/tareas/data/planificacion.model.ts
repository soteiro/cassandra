/** Horas reservadas para trabajar en una tarea. Fecha "YYYY-MM-DD", horas "HH:MM". */
export interface BloqueInput {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface PlanificarRequest {
  /** Identificador estable: reintentar con el mismo id no duplica los bloques. */
  operacion_id: string;
  bloques: BloqueInput[];
}

export interface BloqueReservado extends BloqueInput {
  id: number;
  tarea_id: number;
  tarea: string;
  proyecto_id: number;
  origen: 'app' | 'mcp';
}

export interface PlanificacionResult {
  bloques: BloqueReservado[];
  /** Bloques que no caen enteros en un hueco libre (se guardan igual). */
  avisos: string[] | null;
}

/** Tiempo libre para trabajar, ya descontado lo que ocupa el calendario. */
export interface HuecoLibre {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  minutos: number;
}
