import { BarraSemana } from './layout.util';
import { COLOR_DEADLINE, COLOR_VENCIDO, fondo, textoTono } from './estilo.util';

/** Estilos de una barra de la grilla de 168 horas de una semana. */
export function estiloBarra(b: BarraSemana, colores: Map<number, string>): Record<string, string> {
  const radio = (cortada: boolean) => (cortada ? '0' : '4px');
  const base: Record<string, string> = {
    'grid-column': `${b.a + 1} / ${b.z + 1}`,
    'grid-row': String(b.fila),
    'border-radius': `${radio(b.cortadaIni)} ${radio(b.cortadaFin)} ${radio(b.cortadaFin)} ${radio(b.cortadaIni)}`,
  };
  if (b.tipo === 'turno') {
    const color = colores.get(b.calendarioId ?? 0) ?? '#c297ff';
    const diaCompleto = b.codigo === 'V' || b.codigo === 'M';
    return {
      ...base,
      height: '13px',
      background: diaCompleto ? 'transparent' : fondo(color, b.codigo === 'N' ? 60 : 35),
      border: diaCompleto ? `1px dashed ${color}` : 'none',
      outline: b.cambio ? '1px dashed var(--theme-text-main)' : 'none',
      'outline-offset': '-1px',
      color: 'var(--theme-text-main)',
    };
  }
  const color = b.vencido ? COLOR_VENCIDO : COLOR_DEADLINE;
  if (b.tipo === 'atraso') {
    return {
      ...base,
      height: '16px',
      background: fondo(COLOR_VENCIDO, 8),
      border: `1px dashed ${COLOR_VENCIDO}`,
      color: textoTono(COLOR_VENCIDO),
      'font-style': 'italic',
    };
  }
  return {
    ...base,
    height: '16px',
    background: fondo(color, 22),
    border: `1px solid ${color}`,
    color: textoTono(color),
  };
}
