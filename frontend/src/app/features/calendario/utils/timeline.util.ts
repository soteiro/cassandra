import { Calendario } from '../data/calendario.model';
import { horaANumero, sumarDias } from './dias.util';
import { fondo } from './estilo.util';
import { asignarCarriles, segmentosTurnoDia, SegmentoTurno } from './layout.util';
import { ActividadDia, DiaInfo, diaVacio } from './modelo.util';

export interface Bloque {
  clave: string;
  actividad: ActividadDia;
  inicio: number;
  fin: number;
  col: number;
  /** Dura menos de una hora: título y hora van en una sola línea. */
  corto: boolean;
  aria: string;
}

/** Actividades de un día con su nivel de solapamiento (las que se cruzan se montan). */
export function bloquesDelDia(info: DiaInfo): Bloque[] {
  const items = info.actividades.map((a) => {
    const inicio = horaANumero(a.hora_inicio);
    return { a: inicio, b: Math.max(horaANumero(a.hora_fin), inicio + 0.5), actividad: a };
  });
  return asignarCarriles(items).map((x) => ({
    clave: `${info.fecha}|${x.actividad.actividad_id}`,
    actividad: x.actividad,
    inicio: x.a,
    fin: x.b,
    col: x.col,
    corto: x.b - x.a < 1,
    aria:
      `${x.actividad.titulo}, ${x.actividad.hora_inicio} a ${x.actividad.hora_fin}` +
      (x.actividad.cancelada ? ', no ocurre este día' : '') +
      (x.actividad.choques.length ? `, choca con ${x.actividad.choques.join(' y ')}` : ''),
  }));
}

/**
 * Estilos de un bloque en la línea de tiempo. La altura de una hora es var(--h) y el
 * corrimiento por nivel, var(--ind): cambian con el ancho de la pantalla.
 */
export function estiloBloque(
  b: Bloque,
  izquierda: number,
  alFrente: boolean,
): Record<string, string> {
  const a = b.actividad;
  const borde = a.choques.length && !a.cancelada ? 'var(--theme-danger)' : a.color;
  return {
    top: `calc(var(--h) * ${b.inicio} + 1px)`,
    height: `max(calc(var(--h) * ${b.fin - b.inicio} - 2px), 14px)`,
    left: `calc(${izquierda}px + var(--ind) * ${b.col})`,
    'z-index': String(alFrente ? 40 : 2 + b.col),
    background: fondo(a.color, a.cancelada ? 12 : 32),
    border: `1px ${a.cancelada ? 'dashed' : 'solid'} ${borde}`,
    'box-shadow':
      b.col > 0 || alFrente
        ? '-3px 0 0 var(--theme-background), 0 4px 12px rgb(0 0 0 / 0.45)'
        : 'none',
    outline: alFrente ? '2px solid var(--theme-text-main)' : 'none',
    'outline-offset': '-1px',
    opacity: a.cancelada ? '0.65' : '1',
  };
}

export interface TramoTurno extends SegmentoTurno {
  calendario: Calendario;
  /** Posición de la columna del calendario de turnos (0, 1…). */
  columna: number;
}

/** Tramos de turno de un día por calendario visible, incluida la noche que viene de ayer. */
export function tramosTurno(
  fecha: string,
  dias: Map<string, DiaInfo>,
  turnosVisibles: Calendario[],
): TramoTurno[] {
  const hoy = dias.get(fecha) ?? diaVacio(fecha);
  const ayer = dias.get(sumarDias(fecha, -1)) ?? diaVacio(fecha);
  return turnosVisibles.flatMap((cal, columna) => {
    const codigoHoy = hoy.turnos.find((t) => t.calendario.id === cal.id)?.turno.codigo;
    const codigoAyer = ayer.turnos.find((t) => t.calendario.id === cal.id)?.turno.codigo;
    return segmentosTurnoDia(codigoHoy, codigoAyer).map((s) => ({
      ...s,
      calendario: cal,
      columna,
    }));
  });
}

export const HORAS_DIA = Array.from({ length: 24 }, (_, h) => h);
