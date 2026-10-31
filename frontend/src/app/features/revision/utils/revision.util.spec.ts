import { semanaARevisar, tocaRevision, ultimoDiaDeRevision } from './revision.util';

describe('revisión semanal', () => {
  // Jueves 8 de octubre de 2026, 10:00.
  const jueves = new Date(2026, 9, 8, 10, 0);

  it('ultimoDiaDeRevision busca hacia atrás', () => {
    expect(ultimoDiaDeRevision(0, jueves)).toEqual(new Date(2026, 9, 4)); // domingo anterior
    expect(ultimoDiaDeRevision(4, jueves)).toEqual(new Date(2026, 9, 8)); // hoy es jueves
    expect(ultimoDiaDeRevision(5, jueves)).toEqual(new Date(2026, 9, 2)); // viernes anterior
  });

  it('toca si no revisaste desde el último día elegido', () => {
    expect(tocaRevision(0, new Date(2026, 9, 3, 20, 0), jueves)).toBe(true); // sábado, antes del domingo
    expect(tocaRevision(0, new Date(2026, 9, 4, 9, 0), jueves)).toBe(false); // el mismo domingo
    expect(tocaRevision(0, new Date(2026, 9, 6), jueves)).toBe(false); // después del domingo
  });

  it('sin revisiones previas toca desde el día elegido', () => {
    expect(tocaRevision(4, null, jueves)).toBe(true);
  });

  it('semanaARevisar es la semana que cierra en el último día de revisión', () => {
    const lunes = new Date(2026, 9, 5, 9, 0); // lunes 5 de octubre
    expect(semanaARevisar(0, lunes)).toEqual(new Date(2026, 8, 28)); // domingo ayer: semana pasada
    expect(semanaARevisar(0, jueves)).toEqual(new Date(2026, 8, 28));
    expect(semanaARevisar(4, jueves)).toEqual(new Date(2026, 9, 5)); // jueves hoy: semana en curso
    expect(semanaARevisar(5, lunes)).toEqual(new Date(2026, 8, 28)); // viernes anterior
  });
});
