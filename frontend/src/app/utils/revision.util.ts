/** Días de la semana como los guarda el backend (0 = domingo). */
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Medianoche local del último `dia` (0 = domingo) igual o anterior a `ahora`. */
export function ultimoDiaDeRevision(dia: number, ahora: Date): Date {
  const atras = (ahora.getDay() - dia + 7) % 7;
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - atras);
}

/**
 * Toca revisar desde el día elegido hasta hacerlo; se vuelve a pedir la semana
 * siguiente. Sin revisiones previas, toca el día elegido en adelante.
 */
export function tocaRevision(dia: number, ultima: Date | null, ahora: Date): boolean {
  const desde = ultimoDiaDeRevision(dia, ahora);
  return !ultima || ultima < desde;
}
