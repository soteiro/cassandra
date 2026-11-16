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
  tiempo_libre: [{ fecha: '2026-11-17', hora_inicio: '07:00', hora_fin: '11:30', minutos: 270 }],
};

describe('construirDias', () => {
  it('reparte deadlines en curso y el día que vencen, con turnos y choques', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true, planificado: true, libre: true },
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
      { calendarios: new Set(), deadlines: true, planificado: true, libre: true },
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
      { calendarios: new Set([1]), deadlines: false, planificado: true, libre: true },
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
      { calendarios: new Set([2]), deadlines: false, planificado: true, libre: true },
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
      { calendarios: new Set([1, 2]), deadlines: true, planificado: false, libre: true },
      '2026-11-16',
    );
    expect(dias.get('2026-11-18')?.actividades ?? []).toEqual([]);
  });
});

describe('actividades que cruzan la medianoche', () => {
  it('se dibujan en dos tramos y la madrugada no se cuenta dos veces', () => {
    const dormir = {
      actividad_id: 9,
      calendario_id: 2,
      fecha: '2026-11-16',
      titulo: 'Dormir',
      hora_inicio: '22:30',
      hora_fin: '07:00',
      semanal: true,
      cancelada: false,
    };
    // La del día anterior al rango solo aporta su madrugada.
    const conNoche = {
      ...rango,
      ocurrencias: [{ ...dormir, fecha: '2026-11-15' }, dormir],
      bloques: [],
    };
    const dias = construirDias(
      conNoche,
      { calendarios: new Set([2]), deadlines: false, planificado: true, libre: true },
      '2026-11-16',
    );
    expect(dias.has('2026-11-15')).toBe(false);
    const lunes = dias.get('2026-11-16')!.actividades;
    expect(lunes.map((a) => [a.clave, a.desde, a.hasta, a.parte])).toEqual([
      ['9v', 0, 7, 'viene'],
      ['9', 22.5, 24, 'sigue'],
    ]);
    expect(lunes[0].horas).toBe('22:30–07:00');
    expect(lunes[0].fecha).toBe('2026-11-15');
    expect(dias.get('2026-11-17')!.actividades[0]).toMatchObject({
      clave: '9v',
      desde: 0,
      hasta: 7,
    });
  });
});

describe('choques del mismo dueño', () => {
  const conCalendarios = {
    ...rango,
    calendarios: [
      ...rango.calendarios,
      {
        id: 3,
        nombre: 'Traslados',
        color: '#ff9e64',
        tipo: 'actividades' as const,
        oculto: false,
        disponibilidad: 'ocupa' as const,
      },
      {
        id: 4,
        nombre: 'Colegio',
        color: '#7ee787',
        tipo: 'actividades' as const,
        oculto: false,
        disponibilidad: 'libera' as const,
      },
    ],
    bloques: [],
  };
  const oc = (id: number, cal: number, titulo: string, ini: string, fin: string) => ({
    actividad_id: id,
    calendario_id: cal,
    fecha: '2026-11-17',
    titulo,
    hora_inicio: ini,
    hora_fin: fin,
    semanal: false,
    cancelada: false,
  });
  const choquesDe = (ocurrencias: ReturnType<typeof oc>[]) => {
    const dias = construirDias(
      { ...conCalendarios, ocurrencias },
      { calendarios: new Set([2, 3, 4]), deadlines: false, planificado: true, libre: true },
      '2026-11-16',
    );
    return Object.fromEntries(
      dias.get('2026-11-17')!.actividades.map((a) => [a.titulo, a.choques]),
    );
  };

  it('el colegio (libera) no choca con un traslado tuyo (ocupa)', () => {
    expect(
      choquesDe([oc(1, 4, 'Colegio', '14:30', '17:45'), oc(2, 3, 'Traslado', '13:40', '15:00')]),
    ).toEqual({ Colegio: [], Traslado: [] });
  });

  it('dos cosas que te ocupan a ti sí chocan, aunque sean de calendarios distintos', () => {
    expect(
      choquesDe([oc(1, 2, 'Terapia', '16:00', '17:00'), oc(2, 3, 'Traslado', '16:30', '17:30')]),
    ).toEqual({ Terapia: ['Traslado'], Traslado: ['Terapia'] });
  });

  it('dos cosas del mismo calendario chocan aunque no te ocupen', () => {
    expect(
      choquesDe([oc(1, 4, 'Colegio', '08:00', '13:00'), oc(2, 4, 'Acto', '12:00', '14:00')]),
    ).toEqual({ Colegio: ['Acto'], Acto: ['Colegio'] });
  });
});

describe('tiempo para trabajar', () => {
  it('se reparte por día y se oculta con su capa', () => {
    const vis = { calendarios: new Set([1, 2]), deadlines: true, planificado: true, libre: true };
    expect(construirDias(rango, vis, '2026-11-16').get('2026-11-17')!.libre).toEqual([
      { desde: 7, hasta: 11.5, horas: '07:00–11:30' },
    ]);
    const oculto = construirDias(rango, { ...vis, libre: false }, '2026-11-16');
    expect(oculto.get('2026-11-17')!.libre).toEqual([]);
  });
});

describe('resumenFranja', () => {
  it('cuenta vencidos, próximos y choques de la semana', () => {
    const dias = construirDias(
      rango,
      { calendarios: new Set([1, 2]), deadlines: true, planificado: true, libre: true },
      '2026-11-16',
    );
    const r = resumenFranja(rango, dias, '2026-11-16');
    expect(r.vencidos.map((d) => d.titulo)).toEqual(['Contribuciones']);
    expect(r.proximos.map((d) => d.titulo)).toEqual(['Uniforme']);
    expect(r.choques).toEqual([{ fecha: '2026-11-17', titulo: 'Terapia ↔ Reunión' }]);
  });
});
