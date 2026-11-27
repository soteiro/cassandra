/** Fechas del mock. Los días van como "YYYY-MM-DD" en hora local, igual que en la app. */

const dos = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" de una fecha en hora local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Día local desplazado `dias` desde hoy, como "YYYY-MM-DD". */
export function diaRelativo(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return ymd(d);
}

/** Medianoche UTC del día (así guarda el backend fecha_inicio y fecha_limite). */
export function medianocheUTC(dia: string): string {
  return `${dia}T00:00:00Z`;
}

/** Instante ISO de hace `dias` días a la hora local indicada. */
export function haceDias(dias: number, hora = 10, minuto = 0, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dias, hora, minuto);
  return d.toISOString();
}

/** Parsea "YYYY-MM-DD" como medianoche UTC (para contar días sin zona horaria). */
export function parseDia(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00Z`);
}

/** Suma días a "YYYY-MM-DD". */
export function sumarDias(s: string, dias: number): string {
  const d = parseDia(s);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días de a hasta b (negativo si b es anterior). */
export function diasEntre(a: string, b: string): number {
  return Math.round((parseDia(b).getTime() - parseDia(a).getTime()) / 86_400_000);
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(s: string): number {
  return (parseDia(s).getUTCDay() + 6) % 7;
}

/** "HH:MM" → minutos del día ("24:00" = 1440). */
export function minutos(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

export function formatoHora(m: number): string {
  return `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;
}

export const ahoraISO = () => new Date().toISOString();
