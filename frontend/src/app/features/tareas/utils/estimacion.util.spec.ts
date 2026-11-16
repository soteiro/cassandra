import { formatoEstimacion, opcionesEstimacion } from './estimacion.util';

describe('estimación de tareas', () => {
  it('formatea minutos y horas', () => {
    expect(formatoEstimacion(45)).toBe('45 min');
    expect(formatoEstimacion(60)).toBe('1 h');
    expect(formatoEstimacion(90)).toBe('1 h 30 min');
  });

  it('incluye una estimación hecha por el asistente aunque no sea típica', () => {
    const valores = opcionesEstimacion(100).map((o) => o.valor);
    expect(valores).toContain(100);
    expect(valores.indexOf(100)).toBe(valores.indexOf(90) + 1);
    expect(opcionesEstimacion(null).map((o) => o.valor)).not.toContain(100);
  });
});
