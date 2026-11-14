import { Deadline, OcurrenciaDia, TurnoDia } from '../data/calendario.model';
import { asignarCarriles, barrasSemana, choquesDelDia, segmentosTurnoDia } from './layout.util';

function ocurrencia(id: number, titulo: string, ini: string, fin: string): OcurrenciaDia {
  return {
    actividad_id: id,
    calendario_id: 1,
    fecha: '2026-11-17',
    titulo,
    hora_inicio: ini,
    hora_fin: fin,
    semanal: false,
    cancelada: false,
  };
}

function deadline(titulo: string, limite: string, inicio?: string): Deadline {
  return {
    tipo: 'tarea',
    id: 1,
    titulo,
    proyecto_id: 1,
    proyecto_nombre: 'P',
    estado: 'Abierto',
    fecha_inicio: inicio ?? null,
    fecha_limite: limite,
  };
}

describe('asignarCarriles', () => {
  it('monta lo que se solapa en niveles y deja solo lo que no', () => {
    const r = asignarCarriles([
      { id: 'terapia', a: 16, b: 17 },
      { id: 'reunion', a: 16.5, b: 17.5 },
      { id: 'colegio', a: 8, b: 13 },
    ]);
    const por = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(por['colegio']).toMatchObject({ col: 0, cols: 1 });
    expect(por['terapia']).toMatchObject({ col: 0, cols: 2 });
    expect(por['reunion']).toMatchObject({ col: 1, cols: 2 });
  });

  it('reutiliza el nivel libre dentro del grupo', () => {
    const r = asignarCarriles([
      { id: 'a', a: 9, b: 12 },
      { id: 'b', a: 10, b: 11 },
      { id: 'c', a: 11, b: 12 },
    ]);
    expect(r.find((x) => x.id === 'c')?.col).toBe(1);
  });
});

describe('choquesDelDia', () => {
  it('lista con qué choca cada actividad e ignora las canceladas', () => {
    const cancelada = { ...ocurrencia(3, 'Cancelada', '16:00', '18:00'), cancelada: true };
    const m = choquesDelDia([
      ocurrencia(1, 'Terapia', '16:00', '17:00'),
      ocurrencia(2, 'Reunión', '16:30', '17:30'),
      cancelada,
      ocurrencia(4, 'Colegio', '08:00', '13:00'),
    ]);
    expect(m.get(1)).toEqual(['Reunión']);
    expect(m.get(2)).toEqual(['Terapia']);
    expect(m.has(3)).toBe(false);
    expect(m.has(4)).toBe(false);
  });
});

describe('barrasSemana', () => {
  const lunes = '2026-11-16';

  it('dibuja el turno a su hora real y la Noche cruzando la medianoche', () => {
    const turnos: TurnoDia[] = [
      { calendario_id: 7, fecha: '2026-11-15', codigo: 'N', base: 'N', cambio: false },
      { calendario_id: 7, fecha: '2026-11-18', codigo: 'L', base: 'L', cambio: false },
      { calendario_id: 7, fecha: '2026-11-19', codigo: 'N', base: 'N', cambio: false },
    ];
    const { barras, filas } = barrasSemana(lunes, {
      deadlines: [],
      calendariosTurnos: [7],
      turnos,
      hoy: '2026-11-14',
      maxCarriles: 2,
    });
    expect(filas).toBe(1);
    // Noche del domingo anterior: llega hasta el lunes 08:00, cortada al inicio.
    expect(barras[0]).toMatchObject({ codigo: 'N', a: 0, z: 8, cortadaIni: true });
    expect(barras[1]).toMatchObject({ codigo: 'L', a: 2 * 24 + 8, z: 2 * 24 + 20 });
    expect(barras[2]).toMatchObject({ codigo: 'N', a: 3 * 24 + 20, z: 4 * 24 + 8 });
  });

  it('une vacaciones seguidas en una sola barra', () => {
    const turnos: TurnoDia[] = ['2026-11-17', '2026-11-18', '2026-11-19'].map((fecha) => ({
      calendario_id: 7,
      fecha,
      codigo: 'V',
      base: 'L',
      cambio: true,
    }));
    const { barras } = barrasSemana(lunes, {
      deadlines: [],
      calendariosTurnos: [7],
      turnos,
      hoy: '2026-11-14',
      maxCarriles: 2,
    });
    expect(barras).toHaveLength(1);
    expect(barras[0]).toMatchObject({ etiqueta: 'Vacaciones', a: 24, z: 4 * 24 });
  });

  it('extiende el deadline desde su inicio y deja el atraso hasta hoy', () => {
    const { barras, filas } = barrasSemana(lunes, {
      deadlines: [
        deadline('Uniforme', '2026-11-17', '2026-11-10'),
        deadline('Contribuciones', '2026-11-12', '2026-11-05'),
      ],
      calendariosTurnos: [],
      turnos: [],
      hoy: '2026-11-19',
      maxCarriles: 2,
    });
    expect(filas).toBe(2);
    const uniforme = barras.find((b) => b.tipo === 'deadline' && b.deadline?.titulo === 'Uniforme');
    expect(uniforme).toMatchObject({ a: 0, z: 48, cortadaIni: true, etiqueta: '… Uniforme' });
    const atrasoUniforme = barras.find(
      (b) => b.tipo === 'atraso' && b.deadline?.titulo === 'Uniforme',
    );
    expect(atrasoUniforme).toMatchObject({ a: 48, z: 4 * 24, etiqueta: 'atrasado' });
    // Contribuciones venció la semana anterior: solo se ve su atraso.
    const contribuciones = barras.filter((b) => b.deadline?.titulo === 'Contribuciones');
    expect(contribuciones).toHaveLength(1);
    expect(contribuciones[0]).toMatchObject({
      tipo: 'atraso',
      a: 0,
      etiqueta: 'Atrasado · Contribuciones',
    });
  });

  it('cuenta por día los deadlines que no caben', () => {
    const { mas, filas } = barrasSemana(lunes, {
      deadlines: [
        deadline('A', '2026-11-17'),
        deadline('B', '2026-11-17'),
        deadline('C', '2026-11-17'),
      ],
      calendariosTurnos: [],
      turnos: [],
      hoy: '2026-11-14',
      maxCarriles: 2,
    });
    expect(filas).toBe(2);
    expect(mas).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });
});

describe('barrasSemana sin turnos esa semana', () => {
  it('no reserva fila para un calendario de turnos sin días en la semana', () => {
    const { filas, barras } = barrasSemana('2026-11-16', {
      deadlines: [deadline('A', '2026-11-17')],
      calendariosTurnos: [7, 8],
      turnos: [{ calendario_id: 8, fecha: '2026-11-18', codigo: 'L', base: 'L', cambio: false }],
      hoy: '2026-11-14',
      maxCarriles: 2,
    });
    expect(filas).toBe(2);
    expect(barras.find((b) => b.tipo === 'turno')?.fila).toBe(1);
    expect(barras.find((b) => b.tipo === 'deadline')?.fila).toBe(2);
  });
});

describe('segmentosTurnoDia', () => {
  it('incluye la salida de la noche anterior', () => {
    expect(segmentosTurnoDia('S', 'N')).toEqual([
      { a: 0, b: 8, codigo: 'N', etiqueta: 'Noche · sale 08:00' },
    ]);
    expect(segmentosTurnoDia('N', 'L')).toEqual([{ a: 20, b: 24, codigo: 'N', etiqueta: 'Noche' }]);
  });
});
