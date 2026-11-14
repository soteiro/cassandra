import {
  diaCorto,
  diaLargo,
  diaSemana,
  diasEntre,
  hoyLocal,
  horaANumero,
  inicioSemana,
  nombreSemana,
  nombreTresMeses,
  relativo,
  semanasDelMes,
  sumarDias,
  sumarMeses,
} from './dias.util';

describe('dias.util', () => {
  it('suma días cruzando meses y años', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
    expect(diasEntre('2026-11-14', '2026-11-17')).toBe(3);
  });

  it('usa el lunes como primer día de la semana', () => {
    expect(diaSemana('2026-11-16')).toBe(0);
    expect(diaSemana('2026-11-15')).toBe(6);
    expect(inicioSemana('2026-11-15')).toBe('2026-11-09');
  });

  it('suma meses devolviendo el primer día', () => {
    expect(sumarMeses('2026-11-14', 2)).toBe('2027-01-01');
    expect(sumarMeses('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('cubre el mes con semanas completas', () => {
    const semanas = semanasDelMes('2026-11-14');
    expect(semanas[0][0]).toBe('2026-10-26');
    expect(semanas.at(-1)?.[6]).toBe('2026-12-06');
    expect(semanas.every((s) => s.length === 7)).toBe(true);
  });

  it('lee el día local', () => {
    expect(hoyLocal(new Date(2026, 10, 14, 23, 30))).toBe('2026-11-14');
  });

  it('formatea días y periodos', () => {
    expect(diaCorto('2026-11-16')).toBe('lun 16 nov');
    expect(diaLargo('2026-11-14')).toBe('Sábado 14 de noviembre');
    expect(nombreSemana('2026-11-14')).toBe('9 – 15 nov');
    expect(nombreSemana('2026-12-02')).toBe('30 nov – 6 dic');
    expect(nombreTresMeses('2026-11-14')).toBe('Nov – ene 2027');
    expect(horaANumero('15:30')).toBe(15.5);
  });

  it('describe los días cercanos en relación con hoy', () => {
    expect(relativo('2026-11-14', '2026-11-14')).toBe('hoy');
    expect(relativo('2026-11-12', '2026-11-14')).toBe('hace 2 días');
    expect(relativo('2026-11-15', '2026-11-14')).toBe('mañana');
    expect(relativo('2026-11-17', '2026-11-14')).toBe('mar 17 nov');
  });
});
