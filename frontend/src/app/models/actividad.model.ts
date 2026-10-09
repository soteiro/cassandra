export interface TareaTerminada {
  id: number;
  nombre: string;
  prioridad: string;
  proyecto_id: number;
  proyecto_nombre: string;
  tarea_padre_id?: number;
  fecha_terminado: string;
}

export interface ProyectoCompleto {
  id: number;
  nombre: string;
  fecha_terminado: string;
}

export interface ResumenActividad {
  desde: string;
  hasta: string;
  tareas_terminadas: TareaTerminada[];
  proyectos_completados: ProyectoCompleto[];
  flujo: { creadas: number; terminadas: number };
  otros: { interacciones: number; personas_contactadas: number; reflexiones: number; notas: number };
}

export type CambioEvento = { antes?: unknown; despues?: unknown; modificado?: boolean };

export interface EventoActividad {
  id: number;
  entidad: string;
  entidad_id: number;
  accion: 'creado' | 'modificado' | 'eliminado' | 'restaurado';
  cambios: Record<string, CambioEvento>;
  origen: string;
  ocurrido_en: string;
  nombre?: string;
  eliminado: boolean;
}
