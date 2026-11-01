import {
  EstadoFinanzas,
  FinanzasPlantillaItem,
  TipoMovimientoFinanzas,
} from '../data/finanzas.model';

export type FinanzasGroupMode = 'categoria' | 'banco' | 'mecanismo' | 'estado' | 'ninguno';

export type FiltroEstadoFinanzas = 'all' | 'pendientes' | 'en_proceso' | 'completados';

export interface FinanzasGroup {
  key: string;
  title: string;
  items: FinanzasPlantillaItem[];
  total: number;
  totalCompletado: number;
  totalEnProceso: number;
  totalPendiente: number;
  porcentajeCompletado: number;
}

const ESTADO_POR_FILTRO: Record<Exclude<FiltroEstadoFinanzas, 'all'>, EstadoFinanzas> = {
  pendientes: 'pendiente',
  en_proceso: 'en proceso',
  completados: 'completado',
};

/**
 * Movimientos de un tipo que coinciden con la búsqueda y el filtro de estado.
 * Los ingresos se buscan por nombre y banco; los egresos también por categoría y mecanismo.
 */
export function filtrarMovimientos(
  items: FinanzasPlantillaItem[],
  tipo: TipoMovimientoFinanzas,
  busqueda: string,
  filtroEstado: FiltroEstadoFinanzas,
): FinanzasPlantillaItem[] {
  let list = items.filter((i) => i.tipo === tipo);
  const query = busqueda.toLowerCase().trim();
  if (query) {
    list = list.filter((i) => {
      const campos =
        tipo === 'egreso'
          ? [i.nombre, i.banco_nombre, i.grupo_item_nombre, i.movimiento_esperado_nombre]
          : [i.nombre, i.banco_nombre];
      return campos.some((c) => c && c.toLowerCase().includes(query));
    });
  }
  if (filtroEstado !== 'all') {
    const estado = ESTADO_POR_FILTRO[filtroEstado];
    list = list.filter((i) => i.estado === estado);
  }
  return list;
}

function sumarMontos(items: FinanzasPlantillaItem[], estado?: EstadoFinanzas): number {
  return items
    .filter((i) => !estado || i.estado === estado)
    .reduce((acc, i) => acc + (i.monto || 0), 0);
}

function crearGrupo(key: string, title: string, items: FinanzasPlantillaItem[]): FinanzasGroup {
  const total = sumarMontos(items);
  const totalCompletado = sumarMontos(items, 'completado');
  return {
    key,
    title,
    items,
    total,
    totalCompletado,
    totalEnProceso: sumarMontos(items, 'en proceso'),
    totalPendiente: sumarMontos(items, 'pendiente'),
    porcentajeCompletado: total > 0 ? Math.round((totalCompletado / total) * 100) : 0,
  };
}

function claveYTitulo(
  item: FinanzasPlantillaItem,
  mode: Exclude<FinanzasGroupMode, 'ninguno'>,
): [string, string] {
  switch (mode) {
    case 'categoria':
      return [
        item.grupo_item_id ? `cat_${item.grupo_item_id}` : 'sin_categoria',
        item.grupo_item_nombre || 'Sin categoría',
      ];
    case 'banco':
      return [
        item.banco_id ? `banco_${item.banco_id}` : 'sin_banco',
        item.banco_nombre || 'Sin cuenta / banco',
      ];
    case 'mecanismo':
      return [
        item.movimiento_esperado_id ? `mec_${item.movimiento_esperado_id}` : 'sin_mecanismo',
        item.movimiento_esperado_nombre || 'Sin mecanismo',
      ];
    case 'estado':
      return [
        `estado_${item.estado}`,
        item.estado === 'completado'
          ? 'Completados'
          : item.estado === 'en proceso'
            ? 'En Proceso'
            : 'Pendientes',
      ];
  }
}

/** Agrupa los movimientos con subtotales por estado, del grupo de mayor a menor total. */
export function agruparMovimientos(
  items: FinanzasPlantillaItem[],
  mode: FinanzasGroupMode,
  tipo: TipoMovimientoFinanzas,
): FinanzasGroup[] {
  if (mode === 'ninguno') {
    const title = tipo === 'egreso' ? 'Todos los gastos' : 'Todos los ingresos';
    return [crearGrupo('todos', title, items)];
  }

  const map = new Map<string, { title: string; items: FinanzasPlantillaItem[] }>();
  for (const item of items) {
    const [key, title] = claveYTitulo(item, mode);
    if (!map.has(key)) {
      map.set(key, { title, items: [] });
    }
    map.get(key)!.items.push(item);
  }

  return [...map]
    .map(([key, value]) => crearGrupo(key, value.title, value.items))
    .sort((a, b) => b.total - a.total);
}

/** pendiente → en proceso → completado → pendiente. */
export function siguienteEstado(estado: EstadoFinanzas): EstadoFinanzas {
  if (estado === 'pendiente') return 'en proceso';
  if (estado === 'en proceso') return 'completado';
  return 'pendiente';
}

export function getRowClass(item: FinanzasPlantillaItem, selected: boolean): string {
  if (selected) {
    return 'bg-primary/10 border-primary/40 ring-1 ring-primary/30';
  }
  if (item.estado === 'completado') {
    return 'bg-positive/10 border-positive/30 hover:bg-positive/15';
  }
  if (item.estado === 'en proceso') {
    return 'bg-warning/10 border-warning/30 hover:bg-warning/15';
  }
  return 'bg-surface border-surface-border hover:bg-surface-border/40';
}

export function getStatusBadgeClass(item: FinanzasPlantillaItem): string {
  if (item.estado === 'completado') {
    return 'bg-positive/20 text-positive-text border-positive/40 hover:bg-positive/30';
  }
  if (item.estado === 'en proceso') {
    return 'bg-warning/20 text-warning-text border-warning/40 hover:bg-warning/30';
  }
  return 'bg-surface-border/40 text-text-muted hover:text-text-main border-surface-border hover:bg-surface-border/60';
}

export function getMontoColorClass(item: FinanzasPlantillaItem): string {
  if (item.estado === 'completado') {
    return 'text-positive-text font-bold font-mono';
  }
  if (item.estado === 'en proceso') {
    return 'text-warning-text font-bold font-mono';
  }
  return item.tipo === 'egreso'
    ? 'text-danger font-semibold font-mono'
    : 'text-success font-semibold font-mono';
}

export function formatCLP(val: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(val || 0);
}
