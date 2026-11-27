/**
 * API simulada: responde las mismas rutas que el backend Go (backend/server/router.go) con
 * la base de la demo. Reproduce el comportamiento que la UI necesita, no cada validación.
 */
import type { ProjectResponse } from '../../app/features/proyectos/data/project.model';
import type { Task } from '../../app/features/tareas/data/task.model';
import type {
  EventoActividad,
  ResumenActividad,
} from '../../app/features/actividad/data/actividad.model';
import type {
  CalendarioRango,
  Calendario,
  BloqueTrabajo,
} from '../../app/features/calendario/data/calendario.model';
import type { APIKey } from '../../app/features/configuracion/data/api-key.model';
import type { CambioEvento } from '../../app/features/actividad/data/actividad.model';
import {
  getDB,
  guardar,
  nuevoId,
  type BloqueRow,
  type CalendarioRow,
  type EventoRow,
  type NotaRow,
  type ProyectoRow,
  type TareaRow,
} from './db';
import { huecos, minutosDesde, ocurrencias, ordenarFranjas, turnos } from './calendario';
import { ahoraISO, diaRelativo, parseDia } from './fechas';

export { restablecer } from './db';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

type Body = Record<string, unknown>;
type Handler = (req: MockRequest, params: string[]) => MockResponse;

const ok = (body: unknown, status = 200): MockResponse => ({ status, body });
const noContent = (): MockResponse => ({ status: 204, body: null });
const notFound = (msg = 'No encontrado'): MockResponse => ({ status: 404, body: msg });
const badRequest = (msg: string): MockResponse => ({ status: 400, body: msg });

const USER = 1;
const TERMINADOS = ['Terminado', 'Completado'];

function body(req: MockRequest): Body {
  return req.body && typeof req.body === 'object' ? (req.body as Body) : {};
}

// ------------------------------------------------------------------ eventos (actividad)

function registrar(
  entidad: string,
  entidadId: number,
  proyectoId: number | null,
  accion: EventoRow['accion'],
  cambios: Record<string, CambioEvento> = {},
) {
  getDB().eventos.push({
    id: nuevoId(),
    entidad,
    entidad_id: entidadId,
    proyecto_id: proyectoId,
    accion,
    cambios,
    origen: 'app',
    ocurrido_en: ahoraISO(),
  });
}

const CAMPOS_LARGOS = new Set([
  'descripcion',
  'comentario',
  'contenido',
  'contenido_raw',
  'nota',
  'por_que',
  'para_que',
  'criterio_finalizacion',
  'premortem',
]);

/** Aplica `cambios` a `row` y devuelve el diff para la actividad. */
function aplicar<T extends object>(row: T, cambios: Partial<T>): Record<string, CambioEvento> {
  const diff: Record<string, CambioEvento> = {};
  const r = row as Record<string, unknown>;
  for (const [campo, valor] of Object.entries(cambios)) {
    if (valor === undefined || r[campo] === valor) continue;
    diff[campo] = CAMPOS_LARGOS.has(campo)
      ? { modificado: true }
      : { antes: r[campo] ?? null, despues: valor };
    r[campo] = valor;
  }
  return diff;
}

// ------------------------------------------------------------------ proyectos

const proyectosVivos = () => getDB().proyectos.filter((p) => !p.eliminado);

function proyectoResponse(p: ProyectoRow): ProjectResponse {
  const db = getDB();
  const { eliminado: _e, ...rest } = p;
  const eventos = db.eventos.filter((e) => e.proyecto_id === p.id);
  return {
    ...rest,
    subproyectos_count: proyectosVivos().filter((s) => s.proyecto_padre_id === p.id).length,
    nombre_padre: p.proyecto_padre_id
      ? db.proyectos.find((x) => x.id === p.proyecto_padre_id)?.nombre
      : undefined,
    ultima_actividad: eventos.reduce<string | undefined>(
      (max, e) => (!max || e.ocurrido_en > max ? e.ocurrido_en : max),
      undefined,
    ),
  };
}

function buscarProyecto(id: string | number): ProyectoRow | undefined {
  return proyectosVivos().find((p) => p.id === Number(id));
}

const proyectoCampos = [
  'nombre',
  'descripcion',
  'comentario',
  'estado',
  'por_que',
  'para_que',
  'criterio_finalizacion',
  'premortem',
  'prioridad',
  'fecha_limite',
  'fecha_inicio',
  'proyecto_padre_id',
] as const;

function crearProyecto(req: MockRequest): MockResponse {
  const b = body(req);
  const nombre = String(b['nombre'] ?? '').trim();
  if (!nombre) return badRequest('El nombre es obligatorio');
  const ahora = ahoraISO();
  const p: ProyectoRow = {
    id: nuevoId(),
    nombre,
    descripcion: String(b['descripcion'] ?? ''),
    comentario: String(b['comentario'] ?? ''),
    estado: 'No Listado',
    por_que: String(b['por_que'] ?? ''),
    para_que: String(b['para_que'] ?? ''),
    criterio_finalizacion: String(b['criterio_finalizacion'] ?? ''),
    premortem: String(b['premortem'] ?? ''),
    prioridad: String(b['prioridad'] || 'Media'),
    fecha_limite: (b['fecha_limite'] as string) || undefined,
    fecha_inicio: (b['fecha_inicio'] as string) || undefined,
    proyecto_padre_id: (b['proyecto_padre_id'] as number | null) ?? null,
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
    fecha_terminado: null,
    eliminado: false,
  };
  getDB().proyectos.push(p);
  registrar('proyecto', p.id, p.id, 'creado');
  return ok(proyectoResponse(p), 201);
}

function actualizarProyecto(req: MockRequest, [id]: string[]): MockResponse {
  const p = buscarProyecto(id);
  if (!p) return notFound('Proyecto no encontrado');
  const b = body(req);
  const cambios: Partial<ProyectoRow> = {};
  for (const campo of proyectoCampos) {
    if (b[campo] !== undefined) (cambios as Record<string, unknown>)[campo] = b[campo];
  }
  if (b['clear_fecha_inicio']) cambios.fecha_inicio = undefined;
  if (b['clear_fecha_limite']) cambios.fecha_limite = undefined;
  const diff = aplicar(p, cambios);
  if (b['clear_fecha_inicio'] && p.fecha_inicio) {
    diff['fecha_inicio'] = { antes: p.fecha_inicio, despues: null };
    p.fecha_inicio = undefined;
  }
  if (b['clear_fecha_limite'] && p.fecha_limite) {
    diff['fecha_limite'] = { antes: p.fecha_limite, despues: null };
    p.fecha_limite = undefined;
  }
  if (cambios.estado !== undefined) {
    p.fecha_terminado = TERMINADOS.includes(p.estado) ? (p.fecha_terminado ?? ahoraISO()) : null;
  }
  p.fecha_actualizacion = ahoraISO();
  if (Object.keys(diff).length) registrar('proyecto', p.id, p.id, 'modificado', diff);
  return ok(proyectoResponse(p));
}

function eliminarProyecto(_req: MockRequest, [id]: string[]): MockResponse {
  const p = buscarProyecto(id);
  if (!p) return notFound('Proyecto no encontrado');
  p.eliminado = true;
  registrar('proyecto', p.id, p.id, 'eliminado');
  return noContent();
}

// ------------------------------------------------------------------ tareas

const tareasVivas = () => getDB().tareas.filter((t) => !t.eliminado);

function tareaResponse(t: TareaRow): Task {
  return {
    ...t,
    proyecto_nombre: getDB().proyectos.find((p) => p.id === t.proyect_id)?.nombre ?? '',
  };
}

function buscarTarea(id: string | number): TareaRow | undefined {
  return tareasVivas().find((t) => t.id === Number(id));
}

function crearTarea(req: MockRequest): MockResponse {
  const b = body(req);
  const nombre = String(b['nombre'] ?? '').trim();
  const proyecto = buscarProyecto(b['proyect_id'] as number);
  if (!nombre) return badRequest('El nombre es obligatorio');
  if (!proyecto) return badRequest('Proyecto inválido');
  const estado = String(b['estado'] || 'Abierto');
  const ahora = ahoraISO();
  const t: TareaRow = {
    id: nuevoId(),
    nombre,
    descripcion: String(b['descripcion'] ?? ''),
    comentario: String(b['comentario'] ?? ''),
    estado,
    prioridad: String(b['prioridad'] || 'normal'),
    eliminado: false,
    user_id: USER,
    proyect_id: proyecto.id,
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
    fecha_terminado: TERMINADOS.includes(estado) ? ahora : null,
    tarea_padre_id: (b['tarea_padre_id'] as number | null) ?? null,
    fecha_inicio: (b['fecha_inicio'] as string) || null,
    fecha_limite: (b['fecha_limite'] as string) || null,
    estimacion_min: (b['estimacion_min'] as number) || null,
  };
  getDB().tareas.push(t);
  registrar('tarea', t.id, t.proyect_id, 'creado');
  return ok(tareaResponse(t), 201);
}

function actualizarTarea(req: MockRequest, [id]: string[]): MockResponse {
  const t = buscarTarea(id);
  if (!t) return notFound('Tarea no encontrada');
  const b = body(req);
  const cambios: Partial<TareaRow> = {};
  for (const campo of [
    'nombre',
    'descripcion',
    'comentario',
    'estado',
    'prioridad',
    'tarea_padre_id',
    'fecha_inicio',
    'fecha_limite',
    'estimacion_min',
  ] as const) {
    if (b[campo] !== undefined) (cambios as Record<string, unknown>)[campo] = b[campo];
  }
  if (b['proyect_id'] !== undefined && buscarProyecto(b['proyect_id'] as number)) {
    cambios.proyect_id = b['proyect_id'] as number;
  }
  if (b['clear_fecha_inicio']) cambios.fecha_inicio = null;
  if (b['clear_fecha_limite']) cambios.fecha_limite = null;
  if (b['clear_estimacion']) cambios.estimacion_min = null;
  const diff = aplicar(t, cambios);
  const ahora = ahoraISO();
  if (cambios.estado !== undefined) {
    if (TERMINADOS.includes(t.estado)) {
      t.fecha_terminado = t.fecha_terminado ?? ahora;
      // Completar una tarea completa sus subtareas y libera sus bloques futuros.
      for (const s of tareasVivas().filter(
        (s) => s.tarea_padre_id === t.id && !TERMINADOS.includes(s.estado),
      )) {
        s.estado = t.estado;
        s.fecha_terminado = ahora;
        s.fecha_actualizacion = ahora;
      }
      const hoy = diaRelativo(0);
      for (const bl of getDB().bloques.filter((bl) => bl.tarea_id === t.id && bl.fecha >= hoy))
        bl.liberado = true;
    } else {
      t.fecha_terminado = null;
    }
  }
  t.fecha_actualizacion = ahora;
  if (Object.keys(diff).length) registrar('tarea', t.id, t.proyect_id, 'modificado', diff);
  return ok(tareaResponse(t));
}

function eliminarTarea(_req: MockRequest, [id]: string[]): MockResponse {
  const t = buscarTarea(id);
  if (!t) return notFound('Tarea no encontrada');
  t.eliminado = true;
  for (const s of tareasVivas().filter((s) => s.tarea_padre_id === t.id)) s.eliminado = true;
  registrar('tarea', t.id, t.proyect_id, 'eliminado');
  return noContent();
}

function tareasDeProyecto(_req: MockRequest, [id]: string[]): MockResponse {
  const todas = tareasVivas()
    .filter((t) => t.proyect_id === Number(id))
    .sort((a, b) => b.id - a.id)
    .map(tareaResponse);
  const porId = new Map(todas.map((t) => [t.id, { ...t, subtareas: [] as Task[] }]));
  const raiz: Task[] = [];
  for (const t of porId.values()) {
    const padre = t.tarea_padre_id ? porId.get(t.tarea_padre_id) : undefined;
    if (padre) padre.subtareas!.push(t);
    else raiz.push(t);
  }
  return ok(raiz);
}

// ------------------------------------------------------------------ notas, documentos y logs

function notaResponse(n: NotaRow) {
  return {
    ...n,
    tarea_nombre: n.tarea_id ? getDB().tareas.find((t) => t.id === n.tarea_id)?.nombre : undefined,
  };
}

const notasVivas = () =>
  getDB()
    .notas.filter((n) => !n.eliminado)
    .sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion));

function crearNota(
  req: MockRequest,
  params: string[],
  via: 'proyecto' | 'tarea' | 'libre',
): MockResponse {
  const b = body(req);
  const texto = String(b['nota'] ?? '').trim();
  if (!texto) return badRequest('La nota está vacía');
  let proyectoId = Number(b['proyecto_id'] ?? 0);
  let tareaId = (b['tarea_id'] as number | null) ?? null;
  if (via === 'proyecto') proyectoId = Number(params[0]);
  if (via === 'tarea') {
    const t = buscarTarea(params[0]);
    if (!t) return notFound('Tarea no encontrada');
    tareaId = t.id;
    proyectoId = t.proyect_id;
  }
  if (!buscarProyecto(proyectoId)) return badRequest('Proyecto inválido');
  const n = {
    id: nuevoId(),
    proyecto_id: proyectoId,
    user_id: USER,
    tarea_id: tareaId,
    nota: texto,
    fecha_creacion: ahoraISO(),
    eliminado: false,
  };
  getDB().notas.push(n);
  registrar('nota', n.id, proyectoId, 'creado');
  return ok(notaResponse(n), 201);
}

function actualizarNota(req: MockRequest, [id]: string[]): MockResponse {
  const n = getDB().notas.find((x) => x.id === Number(id));
  if (!n) return notFound('Nota no encontrada');
  const b = body(req);
  const cambios: Body = {};
  if (b['nota'] !== undefined) cambios['nota'] = b['nota'];
  if (b['tarea_id'] !== undefined) cambios['tarea_id'] = b['tarea_id'];
  if (b['clear_tarea_id']) cambios['tarea_id'] = null;
  if (b['eliminado'] !== undefined) cambios['eliminado'] = b['eliminado'];
  const diff = aplicar(n, cambios);
  if (diff['nota']) {
    delete diff['nota'];
    diff['nota_proyecto'] = { modificado: true };
  }
  if (Object.keys(diff).length)
    registrar(
      'nota',
      n.id,
      n.proyecto_id,
      b['eliminado'] === false ? 'restaurado' : 'modificado',
      diff,
    );
  return ok(notaResponse(n));
}

function eliminarNota(_req: MockRequest, [id]: string[]): MockResponse {
  const n = getDB().notas.find((x) => x.id === Number(id) && !x.eliminado);
  if (!n) return notFound('Nota no encontrada');
  n.eliminado = true;
  registrar('nota', n.id, n.proyecto_id, 'eliminado');
  return noContent();
}

const docsVivos = () => getDB().documentos.filter((d) => !d.eliminado);

function crearDocumento(req: MockRequest, [pid]: string[]): MockResponse {
  const b = body(req);
  if (!buscarProyecto(pid)) return notFound('Proyecto no encontrado');
  const titulo = String(b['titulo'] ?? '').trim();
  if (!titulo) return badRequest('El título es obligatorio');
  const ahora = ahoraISO();
  const d = {
    id: nuevoId(),
    proyecto_id: Number(pid),
    user_id: USER,
    titulo,
    contenido: String(b['contenido'] ?? ''),
    tipo: (b['tipo'] as never) || 'general',
    tags: String(b['tags'] ?? ''),
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
    eliminado: false,
    gestionado: false,
  };
  getDB().documentos.push(d);
  registrar('documento', d.id, d.proyecto_id, 'creado');
  return ok(d, 201);
}

function actualizarDocumento(req: MockRequest, [id]: string[]): MockResponse {
  const d = docsVivos().find((x) => x.id === Number(id));
  if (!d) return notFound('Documento no encontrado');
  const b = body(req);
  const cambios: Body = {};
  for (const campo of ['titulo', 'contenido', 'tipo', 'tags'])
    if (b[campo] !== undefined) cambios[campo] = b[campo];
  const diff = aplicar(d, cambios);
  d.fecha_actualizacion = ahoraISO();
  if (Object.keys(diff).length) registrar('documento', d.id, d.proyecto_id, 'modificado', diff);
  return ok(d);
}

function eliminarDocumento(_req: MockRequest, [id]: string[]): MockResponse {
  const d = docsVivos().find((x) => x.id === Number(id));
  if (!d) return notFound('Documento no encontrado');
  d.eliminado = true;
  registrar('documento', d.id, d.proyecto_id, 'eliminado');
  return noContent();
}

const logsVivos = () => getDB().logs.filter((l) => !l.eliminado);

function logsDeProyecto(req: MockRequest, [pid]: string[]): MockResponse {
  const q = (req.query.get('q') ?? '').trim().toLowerCase();
  const offset = Number(req.query.get('offset') ?? 0);
  const limit = Number(req.query.get('limit') ?? 30);
  const lista = logsVivos()
    .filter((l) => l.proyecto_id === Number(pid))
    .filter((l) => !q || `${l.titulo} ${l.contenido_raw}`.toLowerCase().includes(q))
    .sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion));
  return ok(lista.slice(offset, offset + limit));
}

function crearLog(req: MockRequest, [pid]: string[]): MockResponse {
  const b = body(req);
  if (!buscarProyecto(pid)) return notFound('Proyecto no encontrado');
  const ahora = ahoraISO();
  const l = {
    id: nuevoId(),
    proyecto_id: Number(pid),
    user_id: USER,
    titulo: String(b['titulo'] ?? ''),
    contenido_raw: String(b['contenido_raw'] ?? ''),
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
    eliminado: false,
    gestionado: false,
  };
  getDB().logs.push(l);
  registrar('log', l.id, l.proyecto_id, 'creado');
  return ok(l, 201);
}

function actualizarLog(req: MockRequest, [id]: string[]): MockResponse {
  const l = logsVivos().find((x) => x.id === Number(id));
  if (!l) return notFound('Log no encontrado');
  const b = body(req);
  const cambios: Body = {};
  for (const campo of ['titulo', 'contenido_raw'])
    if (b[campo] !== undefined) cambios[campo] = b[campo];
  const diff = aplicar(l, cambios);
  l.fecha_actualizacion = ahoraISO();
  if (Object.keys(diff).length) registrar('log', l.id, l.proyecto_id, 'modificado', diff);
  return ok(l);
}

function eliminarLog(_req: MockRequest, [id]: string[]): MockResponse {
  const l = logsVivos().find((x) => x.id === Number(id));
  if (!l) return notFound('Log no encontrado');
  l.eliminado = true;
  registrar('log', l.id, l.proyecto_id, 'eliminado');
  return noContent();
}

// ------------------------------------------------------------------ actividad y pronósticos

function nombreEntidad(e: EventoRow): { nombre?: string; eliminado: boolean } {
  const db = getDB();
  switch (e.entidad) {
    case 'proyecto': {
      const p = db.proyectos.find((x) => x.id === e.entidad_id);
      return { nombre: p?.nombre, eliminado: !!p?.eliminado };
    }
    case 'tarea': {
      const t = db.tareas.find((x) => x.id === e.entidad_id);
      return { nombre: t?.nombre, eliminado: !!t?.eliminado };
    }
    case 'documento': {
      const d = db.documentos.find((x) => x.id === e.entidad_id);
      return { nombre: d?.titulo, eliminado: !!d?.eliminado };
    }
    case 'log': {
      const l = db.logs.find((x) => x.id === e.entidad_id);
      return { nombre: l?.titulo, eliminado: !!l?.eliminado };
    }
    case 'nota':
      return { eliminado: !!db.notas.find((x) => x.id === e.entidad_id)?.eliminado };
  }
  return { eliminado: false };
}

function actividadProyecto(req: MockRequest, [pid]: string[]): MockResponse {
  const limit = Number(req.query.get('limit') ?? 50);
  const eventos: EventoActividad[] = getDB()
    .eventos.filter((e) => e.proyecto_id === Number(pid))
    .sort((a, b) => b.ocurrido_en.localeCompare(a.ocurrido_en) || b.id - a.id)
    .slice(0, limit)
    .map(({ proyecto_id: _p, ...e }) => ({ ...e, ...nombreEntidad({ proyecto_id: _p, ...e }) }));
  return ok(eventos);
}

function resumenActividad(req: MockRequest): MockResponse {
  const desde = req.query.get('desde') ?? '';
  const hasta = req.query.get('hasta') ?? '';
  const enRango = (f?: string | null) =>
    !!f && new Date(f) >= new Date(desde) && new Date(f) < new Date(hasta);
  const db = getDB();
  const terminadas = tareasVivas().filter(
    (t) => t.estado === 'Terminado' && enRango(t.fecha_terminado),
  );
  const res: ResumenActividad = {
    desde,
    hasta,
    tareas_terminadas: terminadas
      .sort((a, b) => (b.fecha_terminado ?? '').localeCompare(a.fecha_terminado ?? ''))
      .map((t) => ({
        id: t.id,
        nombre: t.nombre,
        prioridad: t.prioridad,
        proyecto_id: t.proyect_id,
        proyecto_nombre: db.proyectos.find((p) => p.id === t.proyect_id)?.nombre ?? '',
        tarea_padre_id: t.tarea_padre_id ?? undefined,
        fecha_terminado: t.fecha_terminado!,
      })),
    proyectos_completados: proyectosVivos()
      .filter((p) => p.estado === 'Completado' && enRango(p.fecha_terminado))
      .map((p) => ({ id: p.id, nombre: p.nombre, fecha_terminado: p.fecha_terminado! })),
    flujo: {
      creadas: tareasVivas().filter((t) => enRango(t.fecha_creacion)).length,
      terminadas: terminadas.length,
    },
    otros: {
      interacciones: 0,
      personas_contactadas: 0,
      reflexiones: 0,
      notas: db.notas.filter((n) => !n.eliminado && enRango(n.fecha_creacion)).length,
    },
  };
  return ok(res);
}

const SEMANAS_VENTANA = 8;

function pronosticoProyecto(_req: MockRequest, [pid]: string[]): MockResponse {
  const id = Number(pid);
  const tareas = tareasVivas().filter((t) => t.proyect_id === id);
  const abiertas = tareas.filter((t) => !TERMINADOS.includes(t.estado)).length;
  const ahora = Date.now();
  const porSemana = Array.from({ length: SEMANAS_VENTANA }, () => 0);
  for (const t of tareas) {
    if (!t.fecha_terminado) continue;
    const semana = Math.floor((ahora - new Date(t.fecha_terminado).getTime()) / (7 * 86_400_000));
    if (semana >= 0 && semana < SEMANAS_VENTANA) porSemana[semana]++;
  }
  const total = porSemana.reduce((a, b) => a + b, 0);
  const rango = simularSemanas(abiertas, porSemana, id);
  return ok({
    tareas_abiertas: abiertas,
    terminadas_ventana: total,
    semanas_ventana: SEMANAS_VENTANA,
    ...(rango ?? {}),
    cambios_fecha_limite: getDB().eventos.filter(
      (e) => e.entidad === 'proyecto' && e.entidad_id === id && e.cambios['fecha_limite'],
    ).length,
  });
}

/** Monte Carlo como internal/pronostico: semanas para terminar las abiertas (percentiles 15–85). */
function simularSemanas(abiertas: number, porSemana: number[], semilla: number) {
  const total = porSemana.reduce((a, b) => a + b, 0);
  if (abiertas <= 0 || total < 3) return null;
  let s = semilla * 2654435761 + abiertas;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const resultados: number[] = [];
  for (let i = 0; i < 2000; i++) {
    let pendientes = abiertas;
    let semanas = 0;
    while (pendientes > 0 && semanas < 520) {
      pendientes -= porSemana[Math.floor(rand() * porSemana.length)];
      semanas++;
    }
    resultados.push(semanas);
  }
  resultados.sort((a, b) => a - b);
  return { semanas_min: resultados[300], semanas_max: resultados[1700] };
}

function planificacion(): MockResponse {
  const completados = proyectosVivos().filter(
    (p) => p.estado === 'Completado' && p.fecha_inicio && p.fecha_limite && p.fecha_terminado,
  );
  const factores = completados.map((p) => {
    const ini = new Date(p.fecha_inicio!).getTime();
    return (
      (new Date(p.fecha_terminado!).getTime() - ini) /
      Math.max(1, new Date(p.fecha_limite!).getTime() - ini)
    );
  });
  const aTiempo = completados.filter(
    (p) => p.fecha_terminado!.slice(0, 10) <= p.fecha_limite!.slice(0, 10),
  ).length;
  const ordenados = [...factores].sort((a, b) => a - b);
  const n = ordenados.length;
  const mediana = n % 2 ? ordenados[(n - 1) / 2] : (ordenados[n / 2 - 1] + ordenados[n / 2]) / 2;
  return ok({
    proyectos: n,
    a_tiempo: aTiempo,
    ...(n >= 3 ? { factor: Math.round(mediana * 100) / 100 } : {}),
  });
}

// ------------------------------------------------------------------ revisión semanal

function estancadas(req: MockRequest): MockResponse {
  const dias = Number(req.query.get('dias') ?? 14);
  const limite = Date.now() - dias * 86_400_000;
  const activos = new Map(
    proyectosVivos()
      .filter((p) => !['Idea', 'Pausado', 'Completado', 'Cancelado'].includes(p.estado))
      .map((p) => [p.id, p.nombre]),
  );
  const lista = tareasVivas()
    .filter((t) => !TERMINADOS.includes(t.estado) && activos.has(t.proyect_id))
    .filter((t) => new Date(t.fecha_actualizacion ?? t.fecha_creacion).getTime() < limite)
    .sort((a, b) => (a.fecha_actualizacion ?? '').localeCompare(b.fecha_actualizacion ?? ''))
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      estado: t.estado,
      prioridad: t.prioridad,
      proyecto_id: t.proyect_id,
      proyecto_nombre: activos.get(t.proyect_id)!,
      tarea_padre_id: t.tarea_padre_id ?? undefined,
      fecha_actualizacion: t.fecha_actualizacion!,
      dias_sin_cambios: Math.floor(
        (Date.now() - new Date(t.fecha_actualizacion!).getTime()) / 86_400_000,
      ),
    }));
  return ok(lista);
}

// ------------------------------------------------------------------ calendario

function calendarioResponse(c: CalendarioRow): Calendario {
  const { ciclos, excepciones: _x, ...rest } = c;
  const ultimo = [...ciclos].sort((a, b) => a.desde.localeCompare(b.desde)).pop();
  return { ...rest, primer_largo: ultimo?.ancla ?? null };
}

const buscarCalendario = (id: string) => getDB().calendarios.find((c) => c.id === Number(id));

function bloquesActivos(desde: string, hasta: string): BloqueRow[] {
  return getDB().bloques.filter(
    (b) => !b.liberado && b.fecha >= desde && b.fecha <= hasta && buscarTarea(b.tarea_id),
  );
}

function bloqueTrabajo(b: BloqueRow): BloqueTrabajo {
  const t = getDB().tareas.find((x) => x.id === b.tarea_id)!;
  const { liberado: _l, ...rest } = b;
  return {
    ...rest,
    tarea: t.nombre,
    proyecto_id: t.proyect_id,
    proyecto_nombre: getDB().proyectos.find((p) => p.id === t.proyect_id)?.nombre ?? '',
    estado: t.estado,
  };
}

function rango(req: MockRequest): MockResponse {
  const desde = req.query.get('desde') ?? '';
  const hasta = req.query.get('hasta') ?? '';
  const hoy = req.query.get('hoy') ?? diaRelativo(0);
  if (!desde || !hasta || hasta < desde) return badRequest('Rango inválido');
  const db = getDB();
  const dia = (f?: string | null) => (f ? f.slice(0, 10) : null);
  const visible = (inicio: string | null, limite: string) =>
    (inicio ?? limite) <= hasta && (limite >= desde || limite < hoy);

  const deadlines: CalendarioRango['deadlines'] = [];
  for (const t of tareasVivas()) {
    const limite = dia(t.fecha_limite);
    const p = buscarProyecto(t.proyect_id);
    if (!limite || !p || ['Terminado', 'Completado', 'Cancelado'].includes(t.estado)) continue;
    if (!visible(dia(t.fecha_inicio), limite)) continue;
    deadlines.push({
      tipo: 'tarea',
      id: t.id,
      titulo: t.nombre,
      proyecto_id: p.id,
      proyecto_nombre: p.nombre,
      estado: t.estado,
      fecha_inicio: dia(t.fecha_inicio),
      fecha_limite: limite,
    });
  }
  for (const p of proyectosVivos()) {
    const limite = dia(p.fecha_limite);
    if (!limite || ['Completado', 'Cancelado'].includes(p.estado)) continue;
    if (!visible(dia(p.fecha_inicio), limite)) continue;
    deadlines.push({
      tipo: 'proyecto',
      id: p.id,
      titulo: p.nombre,
      proyecto_id: p.id,
      proyecto_nombre: p.nombre,
      estado: p.estado,
      fecha_inicio: dia(p.fecha_inicio),
      fecha_limite: limite,
    });
  }
  deadlines.sort(
    (a, b) => a.fecha_limite.localeCompare(b.fecha_limite) || a.titulo.localeCompare(b.titulo),
  );

  const previo = new Date(parseDia(desde).getTime() - 86_400_000).toISOString().slice(0, 10);
  const res: CalendarioRango = {
    desde,
    hasta,
    ocultar_deadlines: db.preferencias.ocultar_deadlines,
    calendarios: db.calendarios.map(calendarioResponse),
    deadlines,
    turnos: db.calendarios
      .filter((c) => c.tipo === 'turnos')
      .flatMap((c) => turnos(c, previo, hasta)),
    ocurrencias: ocurrencias(db, desde, hasta),
    bloques: bloquesActivos(desde, hasta).map(bloqueTrabajo),
    tiempo_libre: huecos(db, desde, hasta, []),
  };
  return ok(res);
}

function crearCalendario(req: MockRequest): MockResponse {
  const b = body(req);
  const nombre = String(b['nombre'] ?? '').trim();
  if (!nombre) return badRequest('El nombre es obligatorio');
  const tipo = b['tipo'] === 'turnos' ? 'turnos' : 'actividades';
  const c: CalendarioRow = {
    id: nuevoId(),
    nombre,
    color: String(b['color'] || '#58a6ff'),
    tipo,
    oculto: false,
    disponibilidad:
      (b['disponibilidad'] as CalendarioRow['disponibilidad']) ||
      (tipo === 'turnos' ? 'contexto' : 'ocupa'),
    ciclos: [],
    excepciones: {},
  };
  getDB().calendarios.push(c);
  return ok(calendarioResponse(c), 201);
}

function actualizarCalendario(req: MockRequest, [id]: string[]): MockResponse {
  const c = buscarCalendario(id);
  if (!c) return notFound('Calendario no encontrado');
  const b = body(req);
  const cambios: Body = {};
  for (const campo of ['nombre', 'color', 'oculto', 'disponibilidad'])
    if (b[campo] !== undefined) cambios[campo] = b[campo];
  aplicar(c, cambios);
  return ok(calendarioResponse(c));
}

function eliminarCalendario(_req: MockRequest, [id]: string[]): MockResponse {
  const db = getDB();
  if (!buscarCalendario(id)) return notFound('Calendario no encontrado');
  db.calendarios = db.calendarios.filter((c) => c.id !== Number(id));
  db.actividades = db.actividades.filter((a) => a.calendario_id !== Number(id));
  return noContent();
}

function fijarCiclo(req: MockRequest, [id]: string[]): MockResponse {
  const c = buscarCalendario(id);
  const primer = String(body(req)['primer_largo'] ?? '');
  if (!c) return notFound('Calendario no encontrado');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primer)) return badRequest('primer_largo inválido');
  c.ciclos = c.ciclos.filter((x) => x.desde < primer);
  c.ciclos.push({ desde: primer, ancla: primer });
  for (const f of Object.keys(c.excepciones)) if (f >= primer) delete c.excepciones[f];
  return ok(calendarioResponse(c));
}

function marcarExcepcion(req: MockRequest, [id, fecha]: string[]): MockResponse {
  const c = buscarCalendario(id);
  if (!c) return notFound('Calendario no encontrado');
  c.excepciones[fecha] = String(body(req)['codigo'] ?? 'F');
  return noContent();
}

function quitarExcepcion(_req: MockRequest, [id, fecha]: string[]): MockResponse {
  const c = buscarCalendario(id);
  if (!c) return notFound('Calendario no encontrado');
  delete c.excepciones[fecha];
  return noContent();
}

const buscarActividad = (id: string) => getDB().actividades.find((a) => a.id === Number(id));

function actividadResponse(a: ReturnType<typeof buscarActividad>) {
  if (!a) return null;
  const { cancelaciones: _c, ...rest } = a;
  return rest;
}

function datosActividad(b: Body) {
  return {
    titulo: String(b['titulo'] ?? '').trim(),
    fecha: String(b['fecha'] ?? ''),
    hora_inicio: String(b['hora_inicio'] ?? ''),
    hora_fin: String(b['hora_fin'] ?? ''),
    dias_semana: Array.isArray(b['dias_semana']) ? (b['dias_semana'] as number[]) : [],
    hasta: (b['hasta'] as string | null) ?? null,
  };
}

function crearActividad(req: MockRequest, [cid]: string[]): MockResponse {
  if (!buscarCalendario(cid)) return notFound('Calendario no encontrado');
  const datos = datosActividad(body(req));
  if (!datos.titulo) return badRequest('El título es obligatorio');
  const a = { id: nuevoId(), calendario_id: Number(cid), ...datos, cancelaciones: [] };
  getDB().actividades.push(a);
  return ok(actividadResponse(a), 201);
}

function actualizarActividad(req: MockRequest, [id]: string[]): MockResponse {
  const a = buscarActividad(id);
  if (!a) return notFound('Actividad no encontrada');
  Object.assign(a, datosActividad(body(req)));
  return ok(actividadResponse(a));
}

function eliminarActividad(_req: MockRequest, [id]: string[]): MockResponse {
  const db = getDB();
  if (!buscarActividad(id)) return notFound('Actividad no encontrada');
  db.actividades = db.actividades.filter((a) => a.id !== Number(id));
  return noContent();
}

function cancelar(cancelada: boolean): Handler {
  return (_req, [id, fecha]) => {
    const a = buscarActividad(id);
    if (!a) return notFound('Actividad no encontrada');
    a.cancelaciones = a.cancelaciones.filter((f) => f !== fecha);
    if (cancelada) a.cancelaciones.push(fecha);
    return noContent();
  };
}

function disponibilidad(req: MockRequest): MockResponse {
  const desde = req.query.get('desde') ?? diaRelativo(0);
  const hasta = req.query.get('hasta') ?? desde;
  const ahora = req.query.get('ahora');
  const inicio = ahora ? minutosDesde(desde, ahora) : 0;
  return ok({
    desde,
    hasta,
    huecos: huecos(getDB(), desde, hasta, bloquesActivos(desde, hasta), inicio),
  });
}

function planificar(req: MockRequest, [pid, tid]: string[]): MockResponse {
  const db = getDB();
  const t = buscarTarea(tid);
  if (!t || t.proyect_id !== Number(pid)) return notFound('Tarea no encontrada');
  const b = body(req);
  const op = String(b['operacion_id'] ?? '');
  const previos = op ? db.operaciones[op] : undefined;
  let creados: BloqueRow[];
  if (previos) {
    creados = db.bloques.filter((x) => previos.includes(x.id));
  } else {
    const entrada = Array.isArray(b['bloques']) ? (b['bloques'] as Body[]) : [];
    creados = entrada.map((x) => ({
      id: nuevoId(),
      tarea_id: t.id,
      fecha: String(x['fecha']),
      hora_inicio: String(x['hora_inicio']),
      hora_fin: String(x['hora_fin']),
      origen: 'app' as const,
      liberado: false,
    }));
    db.bloques.push(...creados);
    if (op) db.operaciones[op] = creados.map((x) => x.id);
  }
  return ok({
    bloques: creados.map((x) => {
      const { liberado: _l, ...rest } = x;
      return { ...rest, tarea: t.nombre, proyecto_id: t.proyect_id };
    }),
    avisos: null,
  });
}

function quitarBloque(_req: MockRequest, [id]: string[]): MockResponse {
  const db = getDB();
  const antes = db.bloques.length;
  db.bloques = db.bloques.filter((b) => b.id !== Number(id));
  return db.bloques.length < antes ? noContent() : notFound('Bloque no encontrado');
}

// ------------------------------------------------------------------ claves API

function datosClave(b: Body): Partial<APIKey> {
  return {
    nombre: String(b['nombre'] ?? '').trim(),
    scopes: (b['scopes'] as APIKey['scopes']) ?? [],
    proyecto_ids: (b['proyecto_ids'] as number[]) ?? [],
    calendario_ids: (b['calendario_ids'] as number[]) ?? [],
    todos_proyectos: !!b['todos_proyectos'],
    todos_calendarios: !!b['todos_calendarios'],
    expira_en: (b['expira_en'] as string) || null,
  };
}

function crearClave(req: MockRequest): MockResponse {
  const datos = datosClave(body(req));
  if (!datos.nombre) return badRequest('El nombre es obligatorio');
  const sufijo = Math.random().toString(16).slice(2, 6);
  const clave: APIKey = {
    id: nuevoId(),
    prefijo: `csk_${sufijo}`,
    fecha_creacion: ahoraISO(),
    revocada_en: null,
    ultimo_uso: null,
    ...(datos as Omit<APIKey, 'id' | 'prefijo' | 'fecha_creacion' | 'revocada_en' | 'ultimo_uso'>),
  };
  getDB().apiKeys.push(clave);
  return ok({ ...clave, token: `csk_${sufijo}_demo_esta_clave_no_sirve_fuera_de_la_demo` }, 201);
}

function actualizarClave(req: MockRequest, [id]: string[]): MockResponse {
  const clave = getDB().apiKeys.find((k) => k.id === Number(id));
  if (!clave) return notFound('Clave no encontrada');
  Object.assign(clave, datosClave(body(req)));
  return ok(clave);
}

function revocarClave(_req: MockRequest, [id]: string[]): MockResponse {
  const clave = getDB().apiKeys.find((k) => k.id === Number(id));
  if (!clave) return notFound('Clave no encontrada');
  clave.revocada_en = ahoraISO();
  return noContent();
}

// ------------------------------------------------------------------ TickTick

function ticktickStatus(): MockResponse {
  const { connected } = getDB().ticktick;
  return ok({
    available: true,
    connected,
    needs_reauthorize: false,
    connected_at: connected ? new Date(Date.now() - 30 * 86_400_000).toISOString() : null,
  });
}

function ticktickToday(req: MockRequest): MockResponse {
  const { connected, tasks } = getDB().ticktick;
  return ok({
    state: connected ? 'ready' : 'not_connected',
    date: req.query.get('date') ?? diaRelativo(0),
    time_zone: req.query.get('time_zone') ?? 'America/Santiago',
    tasks: connected ? tasks : [],
    fetched_at: connected ? ahoraISO() : null,
    warnings: [],
    inbox_read: connected,
  });
}

// ------------------------------------------------------------------ tabla de rutas

const ID = '(\\d+)';
const FECHA = '(\\d{4}-\\d{2}-\\d{2})';

const rutas: [string, string, Handler][] = [
  ['GET', '/version', () => ok({ version: 'demo' })],
  ['GET', '/health', () => ok({ status: 'ok' })],
  ['POST', '/auth/login', () => ok({ ok: true })],
  ['POST', '/auth/logout', () => ok({ ok: true })],
  ['POST', '/auth/refresh', () => ok({ ok: true })],
  ['GET', '/auth/me', () => ok({ user_id: USER })],

  [
    'GET',
    '/proyects',
    () =>
      ok(
        proyectosVivos()
          .sort((a, b) => b.id - a.id)
          .map(proyectoResponse),
      ),
  ],
  ['POST', '/proyects', crearProyecto],
  [
    'GET',
    `/proyects/${ID}`,
    (_r, [id]) => {
      const p = buscarProyecto(id);
      return p ? ok(proyectoResponse(p)) : notFound('Proyecto no encontrado');
    },
  ],
  ['PUT', `/proyects/${ID}`, actualizarProyecto],
  ['DELETE', `/proyects/${ID}`, eliminarProyecto],
  [
    'GET',
    `/proyects/${ID}/subproyectos`,
    (_r, [id]) =>
      ok(
        proyectosVivos()
          .filter((p) => p.proyecto_padre_id === Number(id))
          .sort((a, b) => a.id - b.id)
          .map(proyectoResponse),
      ),
  ],
  ['GET', `/proyects/${ID}/tareas`, tareasDeProyecto],
  ['GET', `/proyects/${ID}/actividad`, actividadProyecto],
  ['GET', `/proyects/${ID}/pronostico`, pronosticoProyecto],
  [
    'GET',
    `/proyects/${ID}/notas`,
    (_r, [id]) =>
      ok(
        notasVivas()
          .filter((n) => n.proyecto_id === Number(id))
          .map(notaResponse),
      ),
  ],
  ['POST', `/proyects/${ID}/notas`, (r, p) => crearNota(r, p, 'proyecto')],
  [
    'GET',
    `/proyects/${ID}/documentos`,
    (r, [id]) => {
      const tipo = r.query.get('tipo');
      return ok(
        docsVivos()
          .filter((d) => d.proyecto_id === Number(id) && (!tipo || d.tipo === tipo))
          .sort((a, b) => b.fecha_actualizacion.localeCompare(a.fecha_actualizacion)),
      );
    },
  ],
  ['POST', `/proyects/${ID}/documentos`, crearDocumento],
  ['GET', `/proyects/${ID}/logs`, logsDeProyecto],
  ['POST', `/proyects/${ID}/logs`, crearLog],

  [
    'GET',
    '/tareas',
    (r) => {
      const estado = (r.query.get('estado') ?? '').trim().toLowerCase();
      return ok(
        tareasVivas()
          .filter((t) => !estado || t.estado.toLowerCase() === estado)
          .sort((a, b) => a.id - b.id)
          .map(tareaResponse),
      );
    },
  ],
  ['POST', '/tareas', crearTarea],
  [
    'GET',
    `/tareas/${ID}`,
    (_r, [id]) => {
      const t = buscarTarea(id);
      if (!t) return notFound('Tarea no encontrada');
      const subtareas = tareasVivas()
        .filter((s) => s.tarea_padre_id === t.id)
        .sort((a, b) => a.id - b.id)
        .map(tareaResponse);
      return ok({ ...tareaResponse(t), subtareas });
    },
  ],
  ['PUT', `/tareas/${ID}`, actualizarTarea],
  ['DELETE', `/tareas/${ID}`, eliminarTarea],
  [
    'GET',
    `/tareas/${ID}/notas`,
    (_r, [id]) =>
      ok(
        notasVivas()
          .filter((n) => n.tarea_id === Number(id))
          .map(notaResponse),
      ),
  ],
  ['POST', `/tareas/${ID}/notas`, (r, p) => crearNota(r, p, 'tarea')],

  ['GET', '/notas', () => ok(notasVivas().map(notaResponse))],
  ['POST', '/notas', (r, p) => crearNota(r, p, 'libre')],
  [
    'GET',
    `/notas/${ID}`,
    (_r, [id]) => {
      const n = getDB().notas.find((x) => x.id === Number(id));
      return n ? ok(notaResponse(n)) : notFound('Nota no encontrada');
    },
  ],
  ['PUT', `/notas/${ID}`, actualizarNota],
  ['DELETE', `/notas/${ID}`, eliminarNota],

  [
    'GET',
    `/documentos/${ID}`,
    (_r, [id]) => {
      const d = docsVivos().find((x) => x.id === Number(id));
      return d ? ok(d) : notFound('Documento no encontrado');
    },
  ],
  ['PUT', `/documentos/${ID}`, actualizarDocumento],
  ['DELETE', `/documentos/${ID}`, eliminarDocumento],

  [
    'GET',
    `/logs/${ID}`,
    (_r, [id]) => {
      const l = logsVivos().find((x) => x.id === Number(id));
      return l ? ok(l) : notFound('Log no encontrado');
    },
  ],
  ['PUT', `/logs/${ID}`, actualizarLog],
  ['DELETE', `/logs/${ID}`, eliminarLog],

  ['GET', '/actividad/resumen', resumenActividad],
  ['GET', '/pronosticos/planificacion', planificacion],

  ['GET', '/revision/estancadas', estancadas],
  [
    'GET',
    '/revisiones',
    (r) => {
      const limit = Number(r.query.get('limit') ?? 12);
      return ok(
        [...getDB().revisiones]
          .sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion))
          .slice(0, limit),
      );
    },
  ],
  [
    'POST',
    '/revisiones',
    (r) => {
      const b = body(r);
      const revision = {
        id: nuevoId(),
        nota: String(b['nota'] ?? ''),
        resumen: (b['resumen'] as object) ?? {},
        fecha_creacion: ahoraISO(),
      };
      getDB().revisiones.push(revision);
      return ok(revision, 201);
    },
  ],
  ['GET', '/preferencias', () => ok(getDB().preferencias)],
  [
    'PUT',
    '/preferencias',
    (r) => {
      const db = getDB();
      const b = body(r);
      for (const campo of ['dia_revision', 'limite_en_curso', 'ocultar_deadlines'] as const) {
        if (b[campo] !== undefined) (db.preferencias as Record<string, unknown>)[campo] = b[campo];
      }
      return ok(db.preferencias);
    },
  ],

  ['GET', '/calendario', rango],
  ['GET', '/calendarios', () => ok(getDB().calendarios.map(calendarioResponse))],
  ['POST', '/calendarios', crearCalendario],
  ['PUT', `/calendarios/${ID}`, actualizarCalendario],
  ['DELETE', `/calendarios/${ID}`, eliminarCalendario],
  ['PUT', `/calendarios/${ID}/ciclo`, fijarCiclo],
  ['PUT', `/calendarios/${ID}/excepciones/${FECHA}`, marcarExcepcion],
  ['DELETE', `/calendarios/${ID}/excepciones/${FECHA}`, quitarExcepcion],
  ['POST', `/calendarios/${ID}/actividades`, crearActividad],
  [
    'GET',
    `/calendario/actividades/${ID}`,
    (_r, [id]) => {
      const a = actividadResponse(buscarActividad(id));
      return a ? ok(a) : notFound('Actividad no encontrada');
    },
  ],
  ['PUT', `/calendario/actividades/${ID}`, actualizarActividad],
  ['DELETE', `/calendario/actividades/${ID}`, eliminarActividad],
  ['PUT', `/calendario/actividades/${ID}/cancelaciones/${FECHA}`, cancelar(true)],
  ['DELETE', `/calendario/actividades/${ID}/cancelaciones/${FECHA}`, cancelar(false)],
  ['GET', '/calendario/horario-base', () => ok(ordenarFranjas(getDB().horarioBase))],
  [
    'PUT',
    '/calendario/horario-base',
    (r) => {
      const db = getDB();
      const franjas = body(r)['franjas'];
      db.horarioBase = Array.isArray(franjas)
        ? ordenarFranjas(franjas as typeof db.horarioBase)
        : [];
      return ok(db.horarioBase);
    },
  ],
  ['DELETE', `/calendario/bloques/${ID}`, quitarBloque],
  ['GET', '/integrations/calendar', disponibilidad],
  ['POST', `/integrations/projects/${ID}/tasks/${ID}/bloques`, planificar],

  ['GET', '/api-keys', () => ok([...getDB().apiKeys].sort((a, b) => b.id - a.id))],
  ['POST', '/api-keys', crearClave],
  ['PUT', `/api-keys/${ID}`, actualizarClave],
  ['DELETE', `/api-keys/${ID}`, revocarClave],

  ['GET', '/connections/ticktick', ticktickStatus],
  [
    'POST',
    '/connections/ticktick/authorize',
    () => {
      getDB().ticktick.connected = true;
      return ok({ authorization_url: '/configuracion/ticktick' });
    },
  ],
  [
    'DELETE',
    '/connections/ticktick',
    () => {
      getDB().ticktick.connected = false;
      return ticktickStatus();
    },
  ],
  ['GET', '/ticktick/tasks/today', ticktickToday],
];

const compiladas = rutas.map(([method, patron, handler]) => ({
  method,
  regex: new RegExp(`^${patron}/?$`),
  handler,
}));

/** Resuelve una petición a /api/*. `path` viene sin el prefijo /api. */
export function manejar(req: MockRequest): MockResponse {
  for (const ruta of compiladas) {
    if (ruta.method !== req.method) continue;
    const m = ruta.regex.exec(req.path);
    if (!m) continue;
    const res = ruta.handler(req, m.slice(1));
    if (req.method !== 'GET') guardar();
    return res;
  }
  return { status: 501, body: 'Esta función no está disponible en la demo.' };
}
