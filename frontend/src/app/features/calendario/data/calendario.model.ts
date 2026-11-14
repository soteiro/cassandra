/** Fechas "YYYY-MM-DD" y horas "HH:MM": días y horas de la vida diaria, sin zona horaria. */

export type TipoCalendario = 'turnos' | 'actividades';

/** L largo, N noche, S saliente, F libre, V vacaciones, M licencia. */
export type CodigoTurno = 'L' | 'N' | 'S' | 'F' | 'V' | 'M';

export interface Calendario {
  id: number;
  nombre: string;
  color: string;
  tipo: TipoCalendario;
  oculto: boolean;
  /** Turnos: primer día del último ciclo fijado. Sin él, el calendario no tiene días. */
  primer_largo?: string | null;
}

export interface CalendarioRequest {
  nombre: string;
  color: string;
  tipo: TipoCalendario;
}

export interface Deadline {
  tipo: 'tarea' | 'proyecto';
  id: number;
  titulo: string;
  proyecto_id: number;
  proyecto_nombre: string;
  estado: string;
  fecha_inicio?: string | null;
  fecha_limite: string;
}

export interface TurnoDia {
  calendario_id: number;
  fecha: string;
  codigo: CodigoTurno;
  base: CodigoTurno | '';
  cambio: boolean;
}

export interface OcurrenciaDia {
  actividad_id: number;
  calendario_id: number;
  fecha: string;
  titulo: string;
  hora_inicio: string;
  hora_fin: string;
  semanal: boolean;
  cancelada: boolean;
}

export interface CalendarioRango {
  desde: string;
  hasta: string;
  ocultar_deadlines: boolean;
  calendarios: Calendario[];
  deadlines: Deadline[];
  turnos: TurnoDia[];
  ocurrencias: OcurrenciaDia[];
}

export interface Actividad {
  id: number;
  calendario_id: number;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  /** Vacío = una sola vez. 0 = lunes … 6 = domingo. */
  dias_semana: number[];
  hasta?: string | null;
}

export interface ActividadRequest {
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  hasta?: string | null;
}

export interface InfoTurno {
  nombre: string;
  corto: string;
  horas: string;
  /** Trabaja ese día (Largo o Noche). */
  trabaja: boolean;
}

/** Cuarto turno: Largo 08–20, Noche 20–08 (cruza la medianoche), Saliente y Libre. */
export const TURNOS: Record<CodigoTurno, InfoTurno> = {
  L: { nombre: 'Largo', corto: 'L', horas: '08:00–20:00', trabaja: true },
  N: { nombre: 'Noche', corto: 'N', horas: '20:00–08:00', trabaja: true },
  S: { nombre: 'Saliente', corto: 'S', horas: 'sale a las 08:00', trabaja: false },
  F: { nombre: 'Libre', corto: '–', horas: 'día libre', trabaja: false },
  V: { nombre: 'Vacaciones', corto: 'V', horas: 'vacaciones', trabaja: false },
  M: { nombre: 'Licencia', corto: 'LM', horas: 'licencia médica', trabaja: false },
};

export const CICLO_CUARTO_TURNO: CodigoTurno[] = ['L', 'N', 'S', 'F'];

/**
 * Colores para calendarios propios, con nombre para lectores de pantalla. Evitan el amarillo
 * y el rojo, que ya significan deadline y vencido.
 */
export const PALETA_CALENDARIO: { color: string; nombre: string }[] = [
  { color: '#c297ff', nombre: 'Violeta' },
  { color: '#8b93ff', nombre: 'Índigo' },
  { color: '#58a6ff', nombre: 'Azul' },
  { color: '#56d4dd', nombre: 'Celeste' },
  { color: '#3fb9a0', nombre: 'Turquesa' },
  { color: '#7ee787', nombre: 'Verde' },
  { color: '#b5bd68', nombre: 'Oliva' },
  { color: '#f778ba', nombre: 'Rosa' },
  { color: '#db61a2', nombre: 'Fucsia' },
  { color: '#ff9e64', nombre: 'Naranja' },
  { color: '#b08968', nombre: 'Café' },
  { color: '#a5b4c4', nombre: 'Gris' },
];

export const COLORES_CALENDARIO = PALETA_CALENDARIO.map((p) => p.color);
