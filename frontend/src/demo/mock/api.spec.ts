import { manejar, type MockResponse } from './api';
import { getDB, restablecer } from './db';
import { diaRelativo } from './fechas';
import type { Task } from '../../app/features/tareas/data/task.model';
import type { ProjectResponse } from '../../app/features/proyectos/data/project.model';
import type { CalendarioRango } from '../../app/features/calendario/data/calendario.model';

function api(method: string, ruta: string, body?: unknown): MockResponse {
  const url = new URL(ruta, 'http://demo');
  return manejar({ method, path: url.pathname, query: url.searchParams, body });
}

describe('API simulada de la demo', () => {
  beforeEach(() => {
    localStorage.clear();
    restablecer();
  });

  it('siembra datos de todos los módulos', () => {
    const db = getDB();
    expect(db.proyectos.length).toBeGreaterThan(10);
    expect(db.tareas.length).toBeGreaterThan(50);
    expect(db.notas.length).toBeGreaterThan(10);
    expect(db.documentos.length).toBeGreaterThan(5);
    expect(db.logs.length).toBeGreaterThan(5);
    expect(db.calendarios.some((c) => c.tipo === 'turnos')).toBe(true);
    expect(db.bloques.some((b) => b.origen === 'mcp')).toBe(true);
  });

  it('responde la sesión sin login real', () => {
    expect(api('GET', '/auth/me')).toEqual({ status: 200, body: { user_id: 1 } });
  });

  it('lista proyectos con subproyectos y nombre del padre', () => {
    const proyectos = api('GET', '/proyects').body as ProjectResponse[];
    const sub = proyectos.find((p) => p.proyecto_padre_id);
    expect(sub?.nombre_padre).toBeTruthy();
    const padre = proyectos.find((p) => p.id === sub!.proyecto_padre_id);
    expect(padre?.subproyectos_count).toBeGreaterThan(0);
  });

  it('crea una tarea y al terminarla completa sus subtareas', () => {
    const proyecto = getDB().proyectos[0];
    const padre = api('POST', '/tareas', { nombre: 'Padre', proyect_id: proyecto.id }).body as Task;
    api('POST', '/tareas', { nombre: 'Hija', proyect_id: proyecto.id, tarea_padre_id: padre.id });

    expect(api('PUT', `/tareas/${padre.id}`, { estado: 'Terminado' }).status).toBe(200);

    const detalle = api('GET', `/tareas/${padre.id}`).body as Task;
    expect(detalle.fecha_terminado).toBeTruthy();
    expect(detalle.subtareas?.map((s) => s.estado)).toEqual(['Terminado']);
  });

  it('filtra tareas por estado sin distinguir mayúsculas', () => {
    const enCurso = api('GET', '/tareas?estado=en curso').body as Task[];
    expect(enCurso.length).toBeGreaterThan(0);
    expect(enCurso.every((t) => t.estado === 'En Curso')).toBe(true);
  });

  it('registra la actividad de los cambios', () => {
    const tarea = getDB().tareas.find((t) => t.estado === 'Abierto')!;
    api('PUT', `/tareas/${tarea.id}`, { estado: 'En Curso' });
    const eventos = api('GET', `/proyects/${tarea.proyect_id}/actividad?limit=1`).body as {
      cambios: Record<string, unknown>;
    }[];
    expect(eventos[0].cambios['estado']).toEqual({ antes: 'Abierto', despues: 'En Curso' });
  });

  it('arma el rango del calendario con turnos, ocurrencias y tiempo libre', () => {
    const desde = diaRelativo(0);
    const hasta = diaRelativo(13);
    const rango = api('GET', `/calendario?desde=${desde}&hasta=${hasta}&hoy=${desde}`)
      .body as CalendarioRango;
    expect(rango.turnos.length).toBeGreaterThan(0);
    expect(rango.ocurrencias.length).toBeGreaterThan(0);
    expect(rango.tiempo_libre.length).toBeGreaterThan(0);
    expect(rango.deadlines.length).toBeGreaterThan(0);
  });

  it('planificar es idempotente por operacion_id', () => {
    const t = getDB().tareas.find((x) => x.estado === 'Abierto')!;
    const req = {
      operacion_id: 'op-1',
      bloques: [{ fecha: diaRelativo(1), hora_inicio: '09:00', hora_fin: '10:00' }],
    };
    const ruta = `/integrations/projects/${t.proyect_id}/tasks/${t.id}/bloques`;
    const antes = getDB().bloques.length;
    api('POST', ruta, req);
    api('POST', ruta, req);
    expect(getDB().bloques.length).toBe(antes + 1);
  });

  it('avisa que una ruta no existe en la demo', () => {
    expect(api('GET', '/finanzas/bancos').status).toBe(501);
  });

  it('persiste los cambios en localStorage', () => {
    api('POST', '/proyects', { nombre: 'Guardado' });
    expect(localStorage.getItem('cassandra.demo.db')).toContain('Guardado');
  });
});
