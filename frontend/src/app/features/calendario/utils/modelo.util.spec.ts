import { CalendarioRango } from '../data/calendario.model';
import { construirDias, resumenFranja } from './modelo.util';

const rango: CalendarioRango = {
  desde: '2026-11-16',
  hasta: '2026-11-22',
  ocultar_deadlines: false,
  calendarios: [
    {
      id: 1,
      nombre: 'Turnos mamá',
      color: '#c297ff',
      tipo: 'turnos',
      oculto: false,
      disponibilidad: 'contexto',
    },
    {
      id: 2,
      nombre: 'Hijo',
      color: '#58a6ff',
      tipo: 'actividades',
      oculto: false,
      disponibilidad: 'ocupa',
    },
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
  bloques: [
    {
      id: 7,
      tarea_id: 10,
      tarea: 'Uniforme',
      proyecto_id: 1,
      proyecto_nombre: 'Colegio',
      estado: 'Abierto',
      fecha: '2026-11-18',
      hora_inicio: '16:30',
      hora_fin: '18:00',
      origen: 'mcp',
    },
  ],
};

describe('construirDias', () => {
  it('reparte deadlines en curso y el día que vencen, con turnos y choques', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true, planificado: true },
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
    const dias = construirDias(
      rango,
      { calendarios: new Set(), deadlines: true, planificado: true },
      '2026-11-16',
    );
    const conContribuciones = [...dias.values()].filter((d) =>
      d.deadlines.some((x) => x.deadline.titulo === 'Contribuciones'),
    );
    // Vence el 12, antes del rango: no se reparte como "en curso" por la semana.
    expect(conContribuciones).toEqual([]);
  });

  it('respeta las capas ocultas', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1]), deadlines: false, planificado: true },
      '2026-11-16',
    );
    const martes = dias.get('2026-11-17')!;
    expect(martes.deadlines).toEqual([]);
    expect(martes.actividades).toEqual([]);
    expect(martes.turnos).toHaveLength(1);
  });
});

describe('bloques de trabajo', () => {
  it('se dibujan como actividades de la capa Planificado, con sus choques', () => {
    const conTerapia = {
      ...rango,
      ocurrencias: [{ ...rango.ocurrencias[0], fecha: '2026-11-18', actividad_id: 3 }],
    };
    const dias = construirDias(
      conTerapia,
      { calendarios: new Set([2]), deadlines: false, planificado: true },
      '2026-11-16',
    );
    const [terapia, bloque] = dias.get('2026-11-18')!.actividades;
    expect(bloque).toMatchObject({
      actividad_id: -7,
      titulo: 'Uniforme',
      calendario: 'Planificado',
      color: 'var(--theme-primary)',
      choques: ['Terapia'],
    });
    expect(bloque.trabajo?.tarea_id).toBe(10);
    expect(terapia.choques).toEqual(['Uniforme']);
    expect(terapia.trabajo).toBeUndefined();
  });

  it('desaparecen al ocultar la capa', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true, planificado: false },
      '2026-11-16',
    );
    expect(dias.get('2026-11-18')?.actividades ?? []).toEqual([]);
  });
});

describe('resumenFranja', () => {
  it('cuenta vencidos, próximos y choques de la semana', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true, planificado: true },
      '2026-11-16',
    );
    const r = resumenFranja(rango, dias, '2026-11-16');
    expect(r.vencidos.map((d) => d.titulo)).toEqual(['Contribuciones']);
    expect(r.proximos.map((d) => d.titulo)).toEqual(['Uniforme']);
    expect(r.choques).toEqual([{ fecha: '2026-11-17', titulo: 'Terapia ↔ Reunión' }]);
  });
});
