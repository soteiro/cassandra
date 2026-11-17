import { marcaAhora } from './timeline.util';

describe('timeline.util', () => {
  it('marca la hora actual solo en el día de hoy', () => {
    const ahora = new Date(2026, 10, 17, 16, 30);
    expect(marcaAhora('2026-11-17', ahora)).toEqual({ hora: 16.5, etiqueta: '16:30' });
    expect(marcaAhora('2026-11-18', ahora)).toBeNull();
  });

  it('usa el día local cerca de medianoche', () => {
    expect(marcaAhora('2026-11-17', new Date(2026, 10, 17, 23, 59))?.etiqueta).toBe('23:59');
    expect(marcaAhora('2026-11-18', new Date(2026, 10, 18, 0, 5))?.hora).toBeCloseTo(5 / 60);
  });
});
