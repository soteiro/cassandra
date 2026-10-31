import { EventoActividad } from '../data/actividad.model';

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
