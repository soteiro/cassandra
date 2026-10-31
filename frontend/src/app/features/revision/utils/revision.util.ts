/** Días de la semana como los guarda el backend (0 = domingo). */
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Medianoche local del último `dia` (0 = domingo) igual o anterior a `ahora`. */
export function ultimoDiaDeRevision(dia: number, ahora: Date): Date {
  const atras = (ahora.getDay() - dia + 7) % 7;
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - atras);
}

/**
 * Lunes de la semana que se revisa: la que contiene el último día de revisión. Si toca
 * el domingo y revisas el lunes, es la semana que acaba de terminar, no la nueva.
 */
export function semanaARevisar(dia: number, ahora: Date): Date {
  const ultimo = ultimoDiaDeRevision(dia, ahora);
  return new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() - ((ultimo.getDay() + 6) % 7));
}

/**
 * Toca revisar desde el día elegido hasta hacerlo; se vuelve a pedir la semana
 * siguiente. Sin revisiones previas, toca el día elegido en adelante.
 */
export function tocaRevision(dia: number, ultima: Date | null, ahora: Date): boolean {
  const desde = ultimoDiaDeRevision(dia, ahora);
  return !ultima || ultima < desde;
}
