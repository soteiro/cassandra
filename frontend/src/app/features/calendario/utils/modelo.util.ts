import {
  BloqueTrabajo,
  Calendario,
  CalendarioRango,
  Deadline,
  OcurrenciaDia,
  TurnoDia,
} from '../data/calendario.model';
import { diasEntre, horaANumero, sumarDias } from './dias.util';
import { choquesDelDia } from './layout.util';
import { COLOR_PLANIFICADO } from './estilo.util';

export interface ActividadDia extends OcurrenciaDia {
  color: string;
  calendario: string;
  /** Títulos de las actividades del mismo día con que se solapa. */
  choques: string[];
  /** Bloque de trabajo de una tarea (capa Planificado): actividad_id es -id del bloque. */
  trabajo?: BloqueTrabajo;
  /** Única en el día (una actividad que cruza la medianoche tiene dos tramos). */
  clave: string;
  /** Horas de este día que ocupa (0–24). */
  desde: number;
  hasta: number;
  /** "22:30–07:00": el horario completo, aunque este tramo sea solo una parte. */
  horas: string;
  /** Cruza la medianoche: 'sigue' al día siguiente o 'viene' del día anterior. */
  parte?: 'sigue' | 'viene';
  /** Te ocupa a ti (calendario "Me ocupa" o bloque de trabajo). */
  mio: boolean;
}

/** Un tramo de tiempo para trabajar en el día. */
export interface TramoLibre {
  desde: number;
  hasta: number;
  horas: string;
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
  /** Tiempo para trabajar (capa "Para trabajar"). */
  libre: TramoLibre[];
}

export interface Visibilidad {
  /** Calendarios propios visibles. */
  calendarios: Set<number>;
  deadlines: boolean;
  /** Bloques de trabajo de tareas. */
  planificado: boolean;
  /** Tiempo para trabajar. */
  libre: boolean;
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
  return { fecha, turnos: [], deadlines: [], actividades: [], libre: [] };
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

  // Cada ocurrencia en uno o dos tramos: una que cruza la medianoche (dormir de 22:30 a
  // 07:00) se dibuja hasta las 24 en su día y desde las 0 en el siguiente.
  const enRango = (f: string) => f >= rango.desde && f <= rango.hasta;
  const porDia = new Map<string, ActividadDia[]>();
  const agregar = (o: OcurrenciaDia, trabajo?: BloqueTrabajo) => {
    const cal = cals.get(o.calendario_id);
    const base = {
      ...o,
      color: trabajo ? COLOR_PLANIFICADO : (cal?.color ?? '#58a6ff'),
      calendario: trabajo ? CAPA_PLANIFICADO : (cal?.nombre ?? ''),
      choques: [],
      horas: `${o.hora_inicio}–${o.hora_fin}`,
      mio: !!trabajo || cal?.disponibilidad === 'ocupa',
      ...(trabajo ? { trabajo } : {}),
    };
    const clave = trabajo ? `b${trabajo.id}` : String(o.actividad_id);
    const ini = horaANumero(o.hora_inicio);
    const fin = horaANumero(o.hora_fin);
    const tramos: [string, ActividadDia][] = [];
    if (fin <= ini) {
      tramos.push([o.fecha, { ...base, clave, desde: ini, hasta: 24, parte: 'sigue' }]);
      const sig = sumarDias(o.fecha, 1);
      tramos.push([sig, { ...base, clave: `${clave}v`, desde: 0, hasta: fin, parte: 'viene' }]);
    } else {
      tramos.push([o.fecha, { ...base, clave, desde: ini, hasta: fin }]);
    }
    for (const [f, a] of tramos) {
      if (enRango(f)) porDia.set(f, [...(porDia.get(f) ?? []), a]);
    }
  };
  for (const o of rango.ocurrencias) {
    if (visibles.calendarios.has(o.calendario_id)) agregar(o);
  }
  if (visibles.planificado) {
    for (const b of rango.bloques ?? []) agregar(ocurrenciaDeBloque(b), b);
  }
  for (const [f, acts] of porDia) {
    acts.sort((a, b) => a.desde - b.desde);
    const choques = choquesDelDia(
      acts.map((a) => ({ ...a, grupo: a.trabajo ? 'trabajo' : String(a.calendario_id) })),
    );
    dia(f).actividades = acts.map((a) => ({ ...a, choques: choques.get(a.clave) ?? [] }));
  }

  if (visibles.libre) {
    for (const h of rango.tiempo_libre ?? []) {
      if (!enRango(h.fecha)) continue;
      dia(h.fecha).libre.push({
        desde: horaANumero(h.hora_inicio),
        hasta: horaANumero(h.hora_fin),
        horas: `${h.hora_inicio}–${h.hora_fin}`,
      });
    }
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
