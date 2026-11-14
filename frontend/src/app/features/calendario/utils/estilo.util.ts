/** Colores del calendario: mezclados con el fondo del tema para que sirvan en claro y oscuro. */

export const COLOR_DEADLINE = 'var(--theme-warning)';
export const COLOR_VENCIDO = 'var(--theme-danger)';

/** Fondo opaco: `pct` % del color sobre el fondo de la página. */
export function fondo(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, var(--theme-background))`;
}

/** Texto con el tono del color pero legible sobre su fondo mezclado. */
export function textoTono(color: string): string {
  return `color-mix(in srgb, ${color} 45%, var(--theme-text-main))`;
}
