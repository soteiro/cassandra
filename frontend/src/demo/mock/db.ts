/**
 * Base de datos de la demo: vive en memoria y se guarda en localStorage, así cada visitante
 * tiene su propio sandbox. Nada sale del navegador.
 */
import type { ProjectResponse } from '../../app/features/proyectos/data/project.model';
import type { Task } from '../../app/features/tareas/data/task.model';
import type { NotaProyecto } from '../../app/features/notas/data/nota.model';
import type { DocumentoProyecto } from '../../app/features/proyectos/data/documento.model';
import type { ProjectLog } from '../../app/features/proyectos/data/project-log.model';
import type { EventoActividad } from '../../app/features/actividad/data/actividad.model';
import type { Revision } from '../../app/features/revision/data/revision.model';
import type { Preferencias } from '../../app/shared/models/preferencias.model';
import type {
  Actividad,
  Calendario,
  FranjaHorario,
} from '../../app/features/calendario/data/calendario.model';
import type { APIKey } from '../../app/features/configuracion/data/api-key.model';
import type { TickTickTask } from '../../app/features/ticktick/data/ticktick.model';
import { crearSeed } from './seed';

export type ProyectoRow = Omit<
  ProjectResponse,
  'subproyectos_count' | 'nombre_padre' | 'ultima_actividad'
> & {
  eliminado: boolean;
};
export type TareaRow = Omit<Task, 'proyecto_nombre' | 'subtareas'>;
export type NotaRow = Omit<NotaProyecto, 'tarea_nombre'>;
export type EventoRow = Omit<EventoActividad, 'nombre' | 'eliminado'> & {
  proyecto_id: number | null;
};

export interface CalendarioRow extends Omit<Calendario, 'primer_largo'> {
  ciclos: { desde: string; ancla: string }[];
  excepciones: Record<string, string>;
}

export interface ActividadRow extends Actividad {
  cancelaciones: string[];
}

export interface BloqueRow {
  id: number;
  tarea_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  origen: 'app' | 'mcp';
  liberado: boolean;
}

export interface DemoDB {
  version: number;
  seq: number;
  proyectos: ProyectoRow[];
  tareas: TareaRow[];
  notas: NotaRow[];
  documentos: DocumentoProyecto[];
  logs: ProjectLog[];
  eventos: EventoRow[];
  revisiones: Revision[];
  preferencias: Required<Preferencias>;
  calendarios: CalendarioRow[];
  actividades: ActividadRow[];
  bloques: BloqueRow[];
  operaciones: Record<string, number[]>;
  horarioBase: FranjaHorario[];
  apiKeys: APIKey[];
  ticktick: { connected: boolean; tasks: TickTickTask[] };
}

/** Subir este número descarta los datos guardados y vuelve a sembrar. */
export const DB_VERSION = 1;
const STORAGE_KEY = 'cassandra.demo.db';

let db: DemoDB | null = null;

function leer(): DemoDB | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoDB;
    return parsed?.version === DB_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function getDB(): DemoDB {
  if (!db) {
    db = leer() ?? crearSeed();
    guardar();
  }
  return db;
}

export function guardar(): void {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Sin almacenamiento la demo funciona igual, pero solo dura esta pestaña.
  }
}

/** Vuelve a los datos de ejemplo (con fechas relativas a hoy). */
export function restablecer(): void {
  db = crearSeed();
  guardar();
}

export function nuevoId(): number {
  const d = getDB();
  d.seq += 1;
  return d.seq;
}
