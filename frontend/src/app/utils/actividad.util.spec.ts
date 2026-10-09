import { describirEvento, haceCuanto, inicioDeSemana, sumarSemanas } from './actividad.util';
import { EventoActividad } from '../models/actividad.model';

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

describe('inicioDeSemana', () => {
  it('devuelve el lunes 00:00 local', () => {
    const jueves = new Date(2026, 9, 8, 15, 30);
    expect(inicioDeSemana(jueves)).toEqual(new Date(2026, 9, 5));
  });

  it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(inicioDeSemana(new Date(2026, 9, 11, 23, 0))).toEqual(new Date(2026, 9, 5));
  });

  it('el lunes es su propio inicio', () => {
    expect(inicioDeSemana(new Date(2026, 9, 5, 0, 0))).toEqual(new Date(2026, 9, 5));
  });

  it('sumarSemanas mueve de lunes a lunes', () => {
    expect(sumarSemanas(new Date(2026, 9, 5), -1)).toEqual(new Date(2026, 8, 28));
    expect(sumarSemanas(new Date(2026, 9, 5), 1)).toEqual(new Date(2026, 9, 12));
  });
});

describe('haceCuanto', () => {
  const ahora = new Date(2026, 9, 8, 10, 0);

  it.each([
    [new Date(2026, 9, 8, 1, 0), 'hoy'],
    [new Date(2026, 9, 7, 23, 0), 'ayer'],
    [new Date(2026, 9, 5, 12, 0), 'hace 3 días'],
    [new Date(2026, 8, 24), 'hace 2 semanas'],
    [new Date(2026, 5, 8), 'hace 4 meses'],
    [new Date(2025, 9, 1), 'hace 1 año'],
    [new Date(2023, 9, 1), 'hace 3 años'],
  ])('%s → %s', (fecha, esperado) => {
    expect(haceCuanto(fecha, ahora)).toBe(esperado);
  });

  it('una fecha futura cuenta como hoy', () => {
    expect(haceCuanto(new Date(2026, 9, 9), ahora)).toBe('hoy');
  });

  it('sin fecha o inválida devuelve vacío', () => {
    expect(haceCuanto(null, ahora)).toBe('');
    expect(haceCuanto('no-es-fecha', ahora)).toBe('');
  });
});

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
