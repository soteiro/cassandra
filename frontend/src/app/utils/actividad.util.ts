import { EventoActividad } from '../models/actividad.model';

const DIA = 24 * 60 * 60 * 1000;

/** Medianoche local del día de `fecha`. */
function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Lunes 00:00 (hora local) de la semana de `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  const dia = inicioDelDia(fecha);
  const desdeLunes = (dia.getDay() + 6) % 7; // getDay: 0 = domingo
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - desdeLunes);
}

/** Suma semanas respetando la hora local (sin saltos por cambio de horario). */
export function sumarSemanas(fecha: Date, semanas: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + semanas * 7);
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas", "hace 4 meses", "hace 1 año". */
export function haceCuanto(fecha: string | Date | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return '';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return '';
  const dias = Math.round((inicioDelDia(ahora).getTime() - inicioDelDia(d).getTime()) / DIA);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
}

const NOMBRE_ENTIDAD: Record<string, string> = {
  proyecto: 'Proyecto',
  tarea: 'Tarea',
  nota: 'Nota',
  documento: 'Documento',
  log: 'Log',
};

const NOMBRE_CAMPO: Record<string, string> = {
  estado: 'estado',
  prioridad: 'prioridad',
  nombre: 'nombre',
  titulo: 'título',
  tipo: 'tipo',
  tags: 'etiquetas',
  fecha_limite: 'fecha límite',
  tarea_padre_id: 'tarea padre',
  proyecto_padre_id: 'proyecto padre',
  tarea_id: 'tarea asociada',
  descripcion: 'descripción',
  comentario: 'comentario',
  por_que: 'por qué',
  para_que: 'para qué',
  criterio_finalizacion: 'criterio de finalización',
  nota_proyecto: 'texto',
  contenido: 'contenido',
  contenido_raw: 'contenido',
};

// Campos que se derivan de otros y no aportan al leer la actividad.
const CAMPOS_OCULTOS = new Set(['fecha_terminado', 'eliminado', 'proyecto_id']);

/** Texto corto de un evento: «Tarea «Deploy»: estado Abierto → En Curso». */
export function describirEvento(e: EventoActividad): string {
  const tipo = NOMBRE_ENTIDAD[e.entidad] ?? e.entidad;
  const sujeto = e.entidad === 'nota' ? tipo : e.nombre ? `${tipo} «${e.nombre}»` : tipo;

  switch (e.accion) {
    case 'creado':
      return e.entidad === 'nota' ? 'Nota agregada' : `${sujeto} ${participio('cread', e.entidad)}`;
    case 'eliminado':
      return `${sujeto} ${participio('eliminad', e.entidad)}`;
    case 'restaurado':
      return `${sujeto} ${participio('restaurad', e.entidad)}`;
  }

  const partes: string[] = [];
  for (const [campo, cambio] of Object.entries(e.cambios ?? {})) {
    if (CAMPOS_OCULTOS.has(campo)) continue;
    const etiqueta = NOMBRE_CAMPO[campo] ?? campo.replaceAll('_', ' ');
    if (cambio.modificado) {
      partes.push(`editó ${etiqueta}`);
    } else if ('antes' in cambio) {
      partes.push(`${etiqueta} ${valor(cambio.antes)} → ${valor(cambio.despues)}`);
    } else {
      partes.push(`${etiqueta}: ${valor(cambio.despues)}`);
    }
  }
  return partes.length ? `${sujeto}: ${partes.join(', ')}` : `${sujeto} ${participio('editad', e.entidad)}`;
}

/** «cread» + a/o según el género de la entidad («tarea creada», «documento creado»). */
function participio(raiz: string, entidad: string): string {
  return raiz + (entidad === 'tarea' || entidad === 'nota' ? 'a' : 'o');
}

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleDateString('es-CL');
  }
  return String(v);
}

/** Factor con un decimal en formato chileno: 2.5 → "2,5". */
export function formatoFactor(factor: number): string {
  return factor.toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/**
 * Fecha probable si el proyecto tarda lo que suelen tardar los tuyos: desde `inicio`,
 * el plazo hasta `limite` multiplicado por `factor`. null si el límite no es posterior.
 */
export function fechaProbable(inicio: Date, limite: Date, factor: number): Date | null {
  const plazo = limite.getTime() - inicio.getTime();
  if (plazo <= 0) return null;
  return new Date(inicio.getTime() + plazo * factor);
}

/** "entre 3 y 6 semanas" / "unas 3 semanas" / "1 semana". */
export function rangoSemanas(min: number, max: number): string {
  if (min === max) return min === 1 ? 'una semana' : `unas ${min} semanas`;
  return `entre ${min} y ${max} semanas`;
}
