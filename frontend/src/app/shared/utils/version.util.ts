/**
 * Utilidades de versiones semánticas (vX.Y.Z) para comparar la app instalada
 * con la última release publicada.
 */

/** Convierte "v1.2.3" o "1.2.3-dev" en [1, 2, 3]. Devuelve null si no es válida. */
export function parseVersion(version: string | null | undefined): [number, number, number] | null {
  const match = version?.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** true si `candidate` es estrictamente más nueva que `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
