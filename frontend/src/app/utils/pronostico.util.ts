/** Factor con un decimal en formato chileno: 2.5 → "2,5". */
export function formatoFactor(factor: number): string {
  return factor.toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/**
 * Fecha probable si el proyecto tarda lo que suelen tardar los tuyos: desde `inicio`,
 * el plazo hasta `limite` multiplicado por `factor`. null si el límite no es posterior.
 */
export function fechaProbable(inicio: Date, limite: Date, factor: number): Date | null {
  const plazo = limite.getTime() - inicio.getTime();
  if (plazo <= 0) return null;
  return new Date(inicio.getTime() + plazo * factor);
}

/** "entre 3 y 6 semanas" / "unas 3 semanas" / "1 semana". */
export function rangoSemanas(min: number, max: number): string {
  if (min === max) return min === 1 ? 'una semana' : `unas ${min} semanas`;
  return `entre ${min} y ${max} semanas`;
}
