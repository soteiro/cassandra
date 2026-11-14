import { CalendarioRango } from '../data/calendario.model';
import { construirDias, resumenFranja } from './modelo.util';

const rango: CalendarioRango = {
  desde: '2026-11-16',
  hasta: '2026-11-22',
  ocultar_deadlines: false,
  calendarios: [
    { id: 1, nombre: 'Turnos mamá', color: '#c297ff', tipo: 'turnos', oculto: false },
    { id: 2, nombre: 'Hijo', color: '#58a6ff', tipo: 'actividades', oculto: false },
  ],
  deadlines: [
    {
      tipo: 'tarea',
      id: 10,
      titulo: 'Uniforme',
      proyecto_id: 1,
      proyecto_nombre: 'Colegio',
      estado: 'Abierto',
      fecha_inicio: '2026-11-10',
      fecha_limite: '2026-11-17',
    },
    {
      tipo: 'tarea',
      id: 11,
      titulo: 'Contribuciones',
      proyecto_id: 1,
      proyecto_nombre: 'Casa',
      estado: 'Abierto',
      fecha_limite: '2026-11-12',
    },
  ],
  turnos: [{ calendario_id: 1, fecha: '2026-11-17', codigo: 'N', base: 'N', cambio: false }],
  ocurrencias: [
    {
      actividad_id: 1,
      calendario_id: 2,
      fecha: '2026-11-17',
      titulo: 'Terapia',
      hora_inicio: '16:00',
      hora_fin: '17:00',
      semanal: true,
      cancelada: false,
    },
    {
      actividad_id: 2,
      calendario_id: 2,
      fecha: '2026-11-17',
      titulo: 'Reunión',
      hora_inicio: '16:30',
      hora_fin: '17:30',
      semanal: false,
      cancelada: false,
    },
  ],
};

describe('construirDias', () => {
  it('reparte deadlines en curso y el día que vencen, con turnos y choques', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true },
      '2026-11-16',
    );
    const lunes = dias.get('2026-11-16')!;
    expect(lunes.deadlines).toEqual([
      expect.objectContaining({ momento: 'curso', vencido: false }),
    ]);
    const martes = dias.get('2026-11-17')!;
    expect(martes.deadlines[0]).toMatchObject({ momento: 'vence' });
    expect(martes.turnos[0].turno.codigo).toBe('N');
    expect(martes.actividades.find((a) => a.titulo === 'Terapia')?.choques).toEqual(['Reunión']);
  });

  it('un deadline sin inicio solo aparece el día que vence', () => {
    const dias = construirDias(rango, { calendarios: new Set(), deadlines: true }, '2026-11-16');
    const conContribuciones = [...dias.values()].filter((d) =>
      d.deadlines.some((x) => x.deadline.titulo === 'Contribuciones'),
    );
    // Vence el 12, antes del rango: no se reparte como "en curso" por la semana.
    expect(conContribuciones).toEqual([]);
  });

  it('respeta las capas ocultas', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1]), deadlines: false },
      '2026-11-16',
    );
    const martes = dias.get('2026-11-17')!;
    expect(martes.deadlines).toEqual([]);
    expect(martes.actividades).toEqual([]);
    expect(martes.turnos).toHaveLength(1);
  });
});

describe('resumenFranja', () => {
  it('cuenta vencidos, próximos y choques de la semana', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true },
      '2026-11-16',
    );
    const r = resumenFranja(rango, dias, '2026-11-16');
    expect(r.vencidos.map((d) => d.titulo)).toEqual(['Contribuciones']);
    expect(r.proximos.map((d) => d.titulo)).toEqual(['Uniforme']);
    expect(r.choques).toEqual([{ fecha: '2026-11-17', titulo: 'Terapia ↔ Reunión' }]);
  });
});
