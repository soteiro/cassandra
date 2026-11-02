/** Monto en pesos chilenos, sin decimales: 1500 → "$1.500". Valores vacíos cuentan como 0. */
export function formatCLP(val: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(val || 0);
}
