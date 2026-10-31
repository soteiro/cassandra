import { haceCuanto, inicioDeSemana, sumarSemanas } from './fecha.util';

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
