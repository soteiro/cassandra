const DIA = 24 * 60 * 60 * 1000;

/** Medianoche local del día de `fecha`. */
function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Lunes 00:00 (hora local) de la semana de `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  const dia = inicioDelDia(fecha);
  const desdeLunes = (dia.getDay() + 6) % 7; // getDay: 0 = domingo
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - desdeLunes);
}

/** Suma semanas respetando la hora local (sin saltos por cambio de horario). */
export function sumarSemanas(fecha: Date, semanas: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + semanas * 7);
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas", "hace 4 meses", "hace 1 año". */
export function haceCuanto(
  fecha: string | Date | null | undefined,
  ahora: Date = new Date(),
): string {
  if (!fecha) return '';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return '';
  const dias = Math.round((inicioDelDia(ahora).getTime() - inicioDelDia(d).getTime()) / DIA);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
}
