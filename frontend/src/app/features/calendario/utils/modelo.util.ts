import {
  BloqueTrabajo,
  Calendario,
  CalendarioRango,
  Deadline,
  OcurrenciaDia,
  TurnoDia,
} from '../data/calendario.model';
import { diasEntre, sumarDias } from './dias.util';
import { choquesDelDia } from './layout.util';
import { COLOR_PLANIFICADO } from './estilo.util';

export interface ActividadDia extends OcurrenciaDia {
  color: string;
  calendario: string;
  /** Títulos de las actividades del mismo día con que se solapa. */
  choques: string[];
  /** Bloque de trabajo de una tarea (capa Planificado): actividad_id es -id del bloque. */
  trabajo?: BloqueTrabajo;
}

export interface DeadlineDia {
  deadline: Deadline;
  /** vence: es su fecha límite; curso: está entre su inicio y su límite. */
  momento: 'vence' | 'curso';
  vencido: boolean;
}

export interface TurnoVista {
  calendario: Calendario;
  turno: TurnoDia;
}

export interface DiaInfo {
  fecha: string;
  turnos: TurnoVista[];
  deadlines: DeadlineDia[];
  actividades: ActividadDia[];
}

export interface Visibilidad {
  /** Calendarios propios visibles. */
  calendarios: Set<number>;
  deadlines: boolean;
  /** Bloques de trabajo de tareas. */
  planificado: boolean;
}

/** Nombre de la capa de bloques de trabajo. */
export const CAPA_PLANIFICADO = 'Planificado';

/** Un bloque de trabajo con forma de ocurrencia, para dibujarlo como una actividad más. */
export function ocurrenciaDeBloque(b: BloqueTrabajo): OcurrenciaDia {
  return {
    actividad_id: -b.id,
    calendario_id: 0,
    fecha: b.fecha,
    titulo: b.tarea,
    hora_inicio: b.hora_inicio,
    hora_fin: b.hora_fin,
    semanal: false,
    cancelada: false,
  };
}

export function diaVacio(fecha: string): DiaInfo {
  return { fecha, turnos: [], deadlines: [], actividades: [] };
}

/** Agrupa el rango por día, solo con las capas visibles. */
export function construirDias(
  rango: CalendarioRango,
  visibles: Visibilidad,
  hoy: string,
): Map<string, DiaInfo> {
  const dias = new Map<string, DiaInfo>();
  const dia = (f: string) => {
    let d = dias.get(f);
    if (!d) {
      d = diaVacio(f);
      dias.set(f, d);
    }
    return d;
  };
  const cals = new Map(rango.calendarios.map((c) => [c.id, c]));

  for (const t of rango.turnos) {
    const cal = cals.get(t.calendario_id);
    if (cal && visibles.calendarios.has(cal.id))
      dia(t.fecha).turnos.push({ calendario: cal, turno: t });
  }

  if (visibles.deadlines) {
    for (const d of rango.deadlines) {
      const vencido = d.fecha_limite < hoy;
      // Sin inicio, el deadline solo ocupa el día en que vence.
      const inicio = d.fecha_inicio ?? d.fecha_limite;
      const desde = inicio > rango.desde ? inicio : rango.desde;
      for (let f = desde; f <= rango.hasta && f <= d.fecha_limite; f = sumarDias(f, 1)) {
        dia(f).deadlines.push({
          deadline: d,
          momento: f === d.fecha_limite ? 'vence' : 'curso',
          vencido: vencido && f === d.fecha_limite,
        });
      }
    }
  }

  const porDia = new Map<string, OcurrenciaDia[]>();
  const agregar = (o: OcurrenciaDia) => porDia.set(o.fecha, [...(porDia.get(o.fecha) ?? []), o]);
  for (const o of rango.ocurrencias) {
    if (visibles.calendarios.has(o.calendario_id)) agregar(o);
  }
  const trabajos = new Map<number, BloqueTrabajo>();
  if (visibles.planificado) {
    for (const b of rango.bloques ?? []) {
      trabajos.set(-b.id, b);
      agregar(ocurrenciaDeBloque(b));
    }
  }
  for (const [f, ocs] of porDia) {
    const choques = choquesDelDia(ocs);
    dia(f).actividades = ocs.map((o) => {
      const trabajo = trabajos.get(o.actividad_id);
      const cal = cals.get(o.calendario_id);
      return {
        ...o,
        color: trabajo ? COLOR_PLANIFICADO : (cal?.color ?? '#58a6ff'),
        calendario: trabajo ? CAPA_PLANIFICADO : (cal?.nombre ?? ''),
        choques: choques.get(o.actividad_id) ?? [],
        ...(trabajo ? { trabajo } : {}),
      };
    });
  }

  for (const d of dias.values()) {
    d.deadlines.sort((a, b) => (a.momento === b.momento ? 0 : a.momento === 'vence' ? -1 : 1));
  }
  return dias;
}

export interface ResumenFranja {
  vencidos: Deadline[];
  proximos: Deadline[];
  choques: { fecha: string; titulo: string }[];
}

/** Lo urgente: deadlines vencidos, los que vencen en 7 días y los choques de horario. */
export function resumenFranja(
  rango: CalendarioRango,
  dias: Map<string, DiaInfo>,
  hoy: string,
): ResumenFranja {
  const vencidos = rango.deadlines.filter((d) => d.fecha_limite < hoy);
  const proximos = rango.deadlines.filter((d) => {
    const n = diasEntre(hoy, d.fecha_limite);
    return n >= 0 && n <= 6;
  });
  const choques: ResumenFranja['choques'] = [];
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(hoy, i);
    const vistos = new Set<string>();
    for (const a of dias.get(f)?.actividades ?? []) {
      if (!a.choques.length) continue;
      const clave = [a.titulo, ...a.choques].sort().join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      choques.push({ fecha: f, titulo: `${a.titulo} ↔ ${a.choques.join(', ')}` });
    }
  }
  return { vencidos, proximos, choques };
}
