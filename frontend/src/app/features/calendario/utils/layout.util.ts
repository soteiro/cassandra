import { CodigoTurno, Deadline, OcurrenciaDia, TURNOS, TurnoDia } from '../data/calendario.model';
import { diasEntre, horaANumero, sumarDias } from './dias.util';

/** Horas de una semana: las barras se ubican de 0 (lunes 00:00) a 168 (lunes siguiente). */
export const HORAS_SEMANA = 168;

export interface Carril {
  /** Nivel de solapamiento: 0 va al fondo, cada nivel se monta corrido a la derecha. */
  col: number;
  cols: number;
}

/**
 * Asigna a cada intervalo [a, b) un nivel dentro de su grupo de solapados: el primero
 * libre. Así lo que se solapa se monta encima, corrido, en vez de compartir el ancho.
 */
export function asignarCarriles<T extends { a: number; b: number }>(items: T[]): (T & Carril)[] {
  const orden = [...items].sort((x, y) => x.a - y.a || y.b - x.b);
  const out: (T & Carril)[] = [];
  let grupo: (T & Carril)[] = [];
  let finGrupo = -Infinity;
  const cerrar = () => {
    const cols = grupo.reduce((max, x) => Math.max(max, x.col + 1), 0);
    grupo.forEach((x) => (x.cols = cols));
  };
  let finCarriles: number[] = [];
  for (const item of orden) {
    if (item.a >= finGrupo) {
      cerrar();
      grupo = [];
      finCarriles = [];
      finGrupo = item.b;
    } else {
      finGrupo = Math.max(finGrupo, item.b);
    }
    let col = finCarriles.findIndex((fin) => fin <= item.a);
    if (col < 0) {
      col = finCarriles.length;
      finCarriles.push(item.b);
    } else {
      finCarriles[col] = item.b;
    }
    const conCarril = { ...item, col, cols: 1 };
    grupo.push(conCarril);
    out.push(conCarril);
  }
  cerrar();
  return out;
}

/** Por actividad: los títulos de las otras actividades del mismo día con que se solapa. */
export function choquesDelDia(ocurrencias: OcurrenciaDia[]): Map<number, string[]> {
  const activas = ocurrencias.filter((o) => !o.cancelada);
  const choques = new Map<number, string[]>();
  for (const o of activas) {
    const a = horaANumero(o.hora_inicio);
    const b = horaANumero(o.hora_fin);
    const con = activas
      .filter((x) => x !== o && horaANumero(x.hora_inicio) < b && a < horaANumero(x.hora_fin))
      .map((x) => x.titulo);
    if (con.length) choques.set(o.actividad_id, con);
  }
  return choques;
}

export interface BarraSemana {
  tipo: 'deadline' | 'atraso' | 'turno';
  /** Horas desde el lunes 00:00, recortadas a [0, 168]. */
  a: number;
  z: number;
  /** Fila de la grilla (desde 1). Los turnos van primero, una fila por calendario. */
  fila: number;
  etiqueta: string;
  /** Sigue desde la semana anterior o hacia la siguiente (o pegada a su atraso). */
  cortadaIni: boolean;
  cortadaFin: boolean;
  vencido?: boolean;
  deadline?: Deadline;
  codigo?: CodigoTurno;
  cambio?: boolean;
  calendarioId?: number;
}

export interface OpcionesSemana {
  deadlines: Deadline[];
  /** Calendarios de turnos visibles, en orden: uno por fila. */
  calendariosTurnos: number[];
  turnos: TurnoDia[];
  hoy: string;
  /** Carriles de deadlines a la vista; el resto se cuenta por día en `mas`. */
  maxCarriles: number;
}

export interface LayoutSemana {
  barras: BarraSemana[];
  filas: number;
  /** Deadlines que no caben, por día de la semana. */
  mas: number[];
}

/** Segmentos de un turno en horas relativas al día (0 = 00:00 de ese día). */
function horasTurno(codigo: CodigoTurno): [number, number] | null {
  if (codigo === 'L') return [8, 20];
  if (codigo === 'N') return [20, 32];
  if (codigo === 'V' || codigo === 'M') return [0, 24];
  return null;
}

/**
 * Barras de una semana: turnos a su hora real (la Noche cruza la medianoche) y deadlines
 * desde su inicio hasta que vencen; lo vencido sigue como atraso hasta hoy.
 */
export function barrasSemana(lunes: string, op: OpcionesSemana): LayoutSemana {
  const barras: BarraSemana[] = [];
  const porCalYFecha = new Map(op.turnos.map((t) => [`${t.calendario_id}|${t.fecha}`, t]));

  op.calendariosTurnos.forEach((calId) => {
    const fila = 0; // se asigna al final: solo calendarios con turnos esta semana
    let previa: BarraSemana | null = null;
    for (let d = -1; d < 7; d++) {
      const t = porCalYFecha.get(`${calId}|${sumarDias(lunes, d)}`);
      const horas = t && horasTurno(t.codigo);
      if (!t || !horas) {
        previa = null;
        continue;
      }
      const a = d * 24 + horas[0];
      const z = d * 24 + horas[1];
      const diaCompleto = t.codigo === 'V' || t.codigo === 'M';
      if (diaCompleto && previa && previa.codigo === t.codigo && previa.z === a) {
        previa.z = z;
        continue;
      }
      previa = {
        tipo: 'turno',
        a,
        z,
        fila,
        etiqueta: diaCompleto ? TURNOS[t.codigo].nombre : TURNOS[t.codigo].corto,
        cortadaIni: false,
        cortadaFin: false,
        codigo: t.codigo,
        cambio: t.cambio,
        calendarioId: calId,
      };
      barras.push(previa);
    }
  });
  for (const b of barras) {
    b.cortadaIni = b.a < 0;
    b.cortadaFin = b.z > HORAS_SEMANA;
    b.a = Math.max(b.a, 0);
    b.z = Math.min(b.z, HORAS_SEMANA);
  }
  const visibles = barras.filter((b) => b.z > b.a);
  // Una fila por calendario de turnos con algo esta semana, en el orden dado.
  const conTurnos = op.calendariosTurnos.filter((id) =>
    visibles.some((b) => b.calendarioId === id),
  );
  for (const b of visibles) b.fila = conTurnos.indexOf(b.calendarioId!) + 1;

  // Deadlines: carril greedy por inicio, con su atraso en el mismo carril.
  const filasTurnos = conTurnos.length;
  const items = op.deadlines
    .map((d) => {
      const a = diasEntre(lunes, d.fecha_inicio ?? d.fecha_limite) * 24;
      const z = (diasEntre(lunes, d.fecha_limite) + 1) * 24;
      const vencido = d.fecha_limite < op.hoy;
      const zt = vencido ? Math.max(z, (diasEntre(lunes, op.hoy) + 1) * 24) : z;
      return { d, a, z, zt, vencido };
    })
    .filter((x) => x.zt > 0 && x.a < HORAS_SEMANA)
    .sort((x, y) => x.a - y.a || y.zt - y.a - (x.zt - x.a));

  const finCarriles: number[] = [];
  const mas = [0, 0, 0, 0, 0, 0, 0];
  let usados = 0;
  for (const x of items) {
    const ini = Math.max(x.a, 0);
    const fin = Math.min(x.zt, HORAS_SEMANA);
    let carril = finCarriles.findIndex((f) => f <= ini);
    if (carril < 0) {
      carril = finCarriles.length;
      finCarriles.push(fin);
    } else {
      finCarriles[carril] = fin;
    }
    if (carril >= op.maxCarriles) {
      for (let dia = Math.floor(ini / 24); dia < Math.ceil(fin / 24); dia++) mas[dia]++;
      continue;
    }
    usados = Math.max(usados, carril + 1);
    const fila = filasTurnos + carril + 1;
    const a = Math.max(x.a, 0);
    const z = Math.min(x.z, HORAS_SEMANA);
    const conAtraso = x.zt > x.z;
    const principalVisible = z > a;
    if (principalVisible) {
      visibles.push({
        tipo: 'deadline',
        a,
        z,
        fila,
        etiqueta: `${x.a < 0 ? '… ' : ''}${x.d.tipo === 'proyecto' ? '◆ ' : ''}${x.d.titulo}`,
        cortadaIni: x.a < 0,
        cortadaFin: x.z > HORAS_SEMANA || conAtraso,
        vencido: x.vencido,
        deadline: x.d,
      });
    }
    if (conAtraso) {
      const ta = Math.max(x.z, 0);
      const tz = Math.min(x.zt, HORAS_SEMANA);
      if (tz > ta) {
        visibles.push({
          tipo: 'atraso',
          a: ta,
          z: tz,
          fila,
          etiqueta: principalVisible ? 'atrasado' : `Atrasado · ${x.d.titulo}`,
          cortadaIni: principalVisible || x.z < 0,
          cortadaFin: x.zt > HORAS_SEMANA,
          vencido: true,
          deadline: x.d,
        });
      }
    }
  }
  return { barras: visibles, filas: filasTurnos + usados, mas };
}

export interface SegmentoTurno {
  a: number;
  b: number;
  codigo: CodigoTurno;
  etiqueta: string;
}

/** Tramos de turno dentro de un día (horas 0–24): la Noche anterior sigue hasta las 08:00. */
export function segmentosTurnoDia(
  hoy: CodigoTurno | undefined,
  ayer: CodigoTurno | undefined,
): SegmentoTurno[] {
  const out: SegmentoTurno[] = [];
  if (ayer === 'N') out.push({ a: 0, b: 8, codigo: 'N', etiqueta: 'Noche · sale 08:00' });
  if (hoy === 'L') out.push({ a: 8, b: 20, codigo: 'L', etiqueta: 'Largo' });
  if (hoy === 'N') out.push({ a: 20, b: 24, codigo: 'N', etiqueta: 'Noche' });
  return out;
}
