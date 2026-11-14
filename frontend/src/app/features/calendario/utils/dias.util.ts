/**
 * Aritmética de días "YYYY-MM-DD". Se calcula en UTC para que los cambios de horario no
 * corran ningún día; la fecha local solo entra al leer "hoy".
 */

const MS_DIA = 86_400_000;

export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MESES_CORTOS = MESES.map((m) => m.slice(0, 3));

function ms(dia: string): number {
  const [y, m, d] = dia.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function aDia(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** El día local de `ahora`. */
export function hoyLocal(ahora: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

export function sumarDias(dia: string, n: number): string {
  return aDia(ms(dia) + n * MS_DIA);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((ms(hasta) - ms(desde)) / MS_DIA);
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(dia: string): number {
  return (new Date(ms(dia)).getUTCDay() + 6) % 7;
}

export function inicioSemana(dia: string): string {
  return sumarDias(dia, -diaSemana(dia));
}

export function mesDe(dia: string): number {
  return Number(dia.slice(5, 7)) - 1;
}

export function numeroDia(dia: string): number {
  return Number(dia.slice(8, 10));
}

/** Primer día del mes `n` meses después del de `dia`. */
export function sumarMeses(dia: string, n: number): string {
  const y = Number(dia.slice(0, 4));
  const m = mesDe(dia) + n;
  return aDia(Date.UTC(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1));
}

/** Semanas (lunes a domingo) que cubren el mes de `dia`. */
export function semanasDelMes(dia: string): string[][] {
  const primero = sumarMeses(dia, 0);
  const ultimo = sumarDias(sumarMeses(dia, 1), -1);
  const semanas: string[][] = [];
  for (let lunes = inicioSemana(primero); lunes <= ultimo; lunes = sumarDias(lunes, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)));
  }
  return semanas;
}

/** "08:30" → 8.5 */
export function horaANumero(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h + m / 60;
}

/** "lun 16 nov" */
export function diaCorto(dia: string): string {
  return `${DIAS_CORTOS[diaSemana(dia)]} ${numeroDia(dia)} ${MESES_CORTOS[mesDe(dia)]}`;
}

/** "Lunes 16 de noviembre" */
export function diaLargo(dia: string): string {
  return `${mayuscula(DIAS_LARGOS[diaSemana(dia)])} ${numeroDia(dia)} de ${MESES[mesDe(dia)]}`;
}

/** "Noviembre 2026" */
export function nombreMes(dia: string): string {
  return `${mayuscula(MESES[mesDe(dia)])} ${dia.slice(0, 4)}`;
}

/** "Nov – ene 2027" */
export function nombreTresMeses(dia: string): string {
  const fin = sumarMeses(dia, 2);
  return `${mayuscula(MESES_CORTOS[mesDe(dia)])} – ${MESES_CORTOS[mesDe(fin)]} ${fin.slice(0, 4)}`;
}

/** "9 – 15 nov" o "30 nov – 6 dic" */
export function nombreSemana(dia: string): string {
  const lunes = inicioSemana(dia);
  const domingo = sumarDias(lunes, 6);
  const mesLunes = mesDe(lunes) !== mesDe(domingo) ? ` ${MESES_CORTOS[mesDe(lunes)]}` : '';
  return `${numeroDia(lunes)}${mesLunes} – ${numeroDia(domingo)} ${MESES_CORTOS[mesDe(domingo)]}`;
}

/** "hoy", "ayer", "hace 3 días", "mañana" o el día corto. */
export function relativo(dia: string, hoy: string): string {
  const n = diasEntre(hoy, dia);
  if (n === 0) return 'hoy';
  if (n === -1) return 'ayer';
  if (n < 0) return `hace ${-n} días`;
  if (n === 1) return 'mañana';
  return diaCorto(dia);
}
