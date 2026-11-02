import { fechaProbable, formatoFactor, rangoSemanas } from './pronostico.util';

describe('pronósticos', () => {
  it('formatoFactor usa coma decimal', () => {
    expect(formatoFactor(2.5)).toBe('2,5');
    expect(formatoFactor(3)).toBe('3,0');
  });

  it('fechaProbable multiplica el plazo por el factor', () => {
    const inicio = new Date(2026, 0, 1);
    expect(fechaProbable(inicio, new Date(2026, 0, 11), 2)).toEqual(new Date(2026, 0, 21));
    expect(fechaProbable(inicio, new Date(2025, 11, 1), 2)).toBeNull();
  });

  it('rangoSemanas', () => {
    expect(rangoSemanas(3, 6)).toBe('entre 3 y 6 semanas');
    expect(rangoSemanas(4, 4)).toBe('unas 4 semanas');
    expect(rangoSemanas(1, 1)).toBe('una semana');
  });
});
