import { describirEvento } from './actividad.util';
import { EventoActividad } from '../data/actividad.model';

function evento(over: Partial<EventoActividad>): EventoActividad {
  return {
    id: 1,
    entidad: 'tarea',
    entidad_id: 1,
    accion: 'modificado',
    cambios: {},
    origen: 'app',
    ocurrido_en: '2026-10-08T12:00:00Z',
    eliminado: false,
    ...over,
  };
}

describe('describirEvento', () => {
  it('cambio de estado de una tarea', () => {
    const e = evento({ nombre: 'Deploy', cambios: { estado: { antes: 'Abierto', despues: 'En Curso' } } });
    expect(describirEvento(e)).toBe('Tarea «Deploy»: estado Abierto → En Curso');
  });

  it('oculta los campos derivados del estado', () => {
    const e = evento({
      nombre: 'Deploy',
      cambios: {
        estado: { antes: 'En Curso', despues: 'Terminado' },
        fecha_terminado: { antes: null, despues: '2026-10-08T12:00:00Z' },
      },
    });
    expect(describirEvento(e)).toBe('Tarea «Deploy»: estado En Curso → Terminado');
  });

  it('texto libre: dice que se editó, sin contenido', () => {
    const e = evento({ entidad: 'proyecto', nombre: 'Casa', cambios: { por_que: { modificado: true } } });
    expect(describirEvento(e)).toBe('Proyecto «Casa»: editó por qué');
  });

  it('relleno histórico: solo el valor final', () => {
    const e = evento({ nombre: 'Flete', origen: 'backfill', cambios: { estado: { despues: 'Terminado' } } });
    expect(describirEvento(e)).toBe('Tarea «Flete»: estado: Terminado');
  });

  it('altas y bajas con el género de la entidad', () => {
    expect(describirEvento(evento({ accion: 'creado', nombre: 'Flete' }))).toBe('Tarea «Flete» creada');
    expect(describirEvento(evento({ accion: 'creado', entidad: 'documento', nombre: 'ADR' }))).toBe(
      'Documento «ADR» creado',
    );
    expect(describirEvento(evento({ accion: 'eliminado', nombre: 'Flete' }))).toBe('Tarea «Flete» eliminada');
    expect(describirEvento(evento({ accion: 'restaurado', entidad: 'log', nombre: 'L' }))).toBe('Log «L» restaurado');
  });

  it('las notas no repiten su extracto en el título', () => {
    expect(describirEvento(evento({ accion: 'creado', entidad: 'nota', nombre: 'texto largo…' }))).toBe(
      'Nota agregada',
    );
    expect(describirEvento(evento({ entidad: 'nota', cambios: { nota_proyecto: { modificado: true } } }))).toBe(
      'Nota: editó texto',
    );
  });

  it('modificación sin cambios visibles', () => {
    expect(describirEvento(evento({ entidad: 'documento', nombre: 'ADR', cambios: {} }))).toBe(
      'Documento «ADR» editado',
    );
  });
});
