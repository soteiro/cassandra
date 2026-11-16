/** Duraciones típicas para estimar una tarea, en minutos. */
export const ESTIMACIONES = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 960];

/** "45 min", "1 h", "1 h 30 min". */
export function formatoEstimacion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Opciones del selector: las típicas más la actual si no está entre ellas. */
export function opcionesEstimacion(actual: number | null): { valor: number; texto: string }[] {
  const valores =
    actual && !ESTIMACIONES.includes(actual) ? [...ESTIMACIONES, actual] : ESTIMACIONES;
  return [...valores]
    .sort((a, b) => a - b)
    .map((valor) => ({ valor, texto: formatoEstimacion(valor) }));
}
