import { FinanzasPlantillaItem } from '../data/finanzas.model';
import {
  agruparMovimientos,
  filtrarMovimientos,
  formatCLP,
  getMontoColorClass,
  getRowClass,
  getStatusBadgeClass,
  siguienteEstado,
} from './presupuesto.util';

function item(partial: Partial<FinanzasPlantillaItem>): FinanzasPlantillaItem {
  return {
    id: 1,
    user_id: 1,
    tipo: 'egreso',
    fecha_creacion: '',
    estado: 'pendiente',
    mes: 5,
    anio: 2026,
    eliminado: false,
    nombre: 'x',
    monto: 0,
    ...partial,
  };
}

const items: FinanzasPlantillaItem[] = [
  item({
    id: 1,
    tipo: 'ingreso',
    nombre: 'Sueldo',
    monto: 2000,
    estado: 'completado',
    banco_id: 1,
    banco_nombre: 'BCI',
  }),
  item({ id: 2, tipo: 'ingreso', nombre: 'Freelance', monto: 500, estado: 'pendiente' }),
  item({
    id: 10,
    nombre: 'Arriendo',
    monto: 600,
    estado: 'completado',
    grupo_item_id: 100,
    grupo_item_nombre: 'Casa',
    banco_id: 1,
    banco_nombre: 'BCI',
    movimiento_esperado_id: 7,
    movimiento_esperado_nombre: 'PAC',
  }),
  item({
    id: 11,
    nombre: 'Luz',
    monto: 100,
    estado: 'en proceso',
    grupo_item_id: 100,
    grupo_item_nombre: 'Casa',
  }),
  item({
    id: 12,
    nombre: 'Supermercado',
    monto: 300,
    estado: 'pendiente',
    grupo_item_id: 200,
    grupo_item_nombre: 'Comida',
    banco_id: 2,
    banco_nombre: 'Santander',
  }),
  item({ id: 13, nombre: 'Café', monto: 50, estado: 'pendiente' }),
];
const egresos = items.filter((i) => i.tipo === 'egreso');
const ingresos = items.filter((i) => i.tipo === 'ingreso');

const ids = (list: FinanzasPlantillaItem[]) => list.map((i) => i.id);

describe('filtrarMovimientos', () => {
  it('should split items by tipo', () => {
    expect(ids(filtrarMovimientos(items, 'ingreso', '', 'all'))).toEqual([1, 2]);
    expect(ids(filtrarMovimientos(items, 'egreso', '', 'all'))).toEqual([10, 11, 12, 13]);
  });

  it('should filter egresos by search across nombre, banco, categoría and mecanismo', () => {
    expect(ids(filtrarMovimientos(items, 'egreso', '  CASA ', 'all'))).toEqual([10, 11]);
    expect(ids(filtrarMovimientos(items, 'egreso', 'santander', 'all'))).toEqual([12]);
    expect(ids(filtrarMovimientos(items, 'egreso', 'pac', 'all'))).toEqual([10]);
    expect(ids(filtrarMovimientos(items, 'egreso', 'café', 'all'))).toEqual([13]);
  });

  it('should filter ingresos by nombre and banco only', () => {
    expect(ids(filtrarMovimientos(items, 'ingreso', 'bci', 'all'))).toEqual([1]);
    expect(ids(filtrarMovimientos(items, 'ingreso', 'free', 'all'))).toEqual([2]);
    const conCategoria = [
      item({ id: 3, tipo: 'ingreso', nombre: 'Bono', grupo_item_nombre: 'Casa' }),
    ];
    expect(filtrarMovimientos(conCategoria, 'ingreso', 'casa', 'all')).toEqual([]);
  });

  it('should filter by status', () => {
    expect(ids(filtrarMovimientos(items, 'egreso', '', 'pendientes'))).toEqual([12, 13]);
    expect(ids(filtrarMovimientos(items, 'ingreso', '', 'pendientes'))).toEqual([2]);
    expect(ids(filtrarMovimientos(items, 'egreso', '', 'en_proceso'))).toEqual([11]);
    expect(ids(filtrarMovimientos(items, 'egreso', '', 'completados'))).toEqual([10]);
    expect(ids(filtrarMovimientos(items, 'ingreso', '', 'completados'))).toEqual([1]);
  });

  it('should combine search and status', () => {
    expect(ids(filtrarMovimientos(items, 'egreso', 'casa', 'completados'))).toEqual([10]);
  });
});

describe('agruparMovimientos', () => {
  it('should group by categoría sorted by total desc', () => {
    const groups = agruparMovimientos(egresos, 'categoria', 'egreso');
    expect(groups.map((g) => g.key)).toEqual(['cat_100', 'cat_200', 'sin_categoria']);
    const casa = groups[0];
    expect(casa.title).toBe('Casa');
    expect(casa.total).toBe(700);
    expect(casa.totalCompletado).toBe(600);
    expect(casa.totalEnProceso).toBe(100);
    expect(casa.totalPendiente).toBe(0);
    expect(casa.porcentajeCompletado).toBe(86);
    expect(groups[2].title).toBe('Sin categoría');
    expect(groups[2].total).toBe(50);
    expect(groups[2].porcentajeCompletado).toBe(0);
  });

  it('should group by banco', () => {
    const groups = agruparMovimientos(egresos, 'banco', 'egreso');
    expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
      ['banco_1', 'BCI', 600],
      ['banco_2', 'Santander', 300],
      ['sin_banco', 'Sin cuenta / banco', 150],
    ]);
  });

  it('should group by mecanismo', () => {
    const groups = agruparMovimientos(egresos, 'mecanismo', 'egreso');
    expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
      ['mec_7', 'PAC', 600],
      ['sin_mecanismo', 'Sin mecanismo', 450],
    ]);
  });

  it('should group by estado', () => {
    const groups = agruparMovimientos(egresos, 'estado', 'egreso');
    expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
      ['estado_completado', 'Completados', 600],
      ['estado_pendiente', 'Pendientes', 350],
      ['estado_en proceso', 'En Proceso', 100],
    ]);
  });

  it('should return a single group in "ninguno" mode with aggregate totals', () => {
    const [g] = agruparMovimientos(egresos, 'ninguno', 'egreso');
    expect(g.key).toBe('todos');
    expect(g.title).toBe('Todos los gastos');
    expect(g.items.length).toBe(4);
    expect(g.total).toBe(1050);
    expect(g.totalCompletado).toBe(600);
    expect(g.totalEnProceso).toBe(100);
    expect(g.totalPendiente).toBe(350);
    expect(g.porcentajeCompletado).toBe(57);

    const [gi] = agruparMovimientos(ingresos, 'ninguno', 'ingreso');
    expect(gi.title).toBe('Todos los ingresos');
    expect(gi.total).toBe(2500);
    expect(gi.porcentajeCompletado).toBe(80);
  });

  it('should report 0% when the group total is 0', () => {
    const [g] = agruparMovimientos([], 'ninguno', 'egreso');
    expect(g.total).toBe(0);
    expect(g.porcentajeCompletado).toBe(0);
    expect(agruparMovimientos([], 'categoria', 'egreso')).toEqual([]);
  });

  it('should treat missing montos as 0', () => {
    const conNulo = [item({ id: 1, monto: null as unknown as number }), item({ id: 2, monto: 10 })];
    expect(agruparMovimientos(conNulo, 'ninguno', 'egreso')[0].total).toBe(10);
  });
});

describe('siguienteEstado', () => {
  it('should cycle pendiente -> en proceso -> completado -> pendiente', () => {
    expect(siguienteEstado('pendiente')).toBe('en proceso');
    expect(siguienteEstado('en proceso')).toBe('completado');
    expect(siguienteEstado('completado')).toBe('pendiente');
  });
});

describe('visual helpers', () => {
  const [, ingresoPendiente, completado, enProceso, pendiente] = items;

  it('getRowClass should prioritise selection, then estado', () => {
    expect(getRowClass(completado, false)).toContain('positive');
    expect(getRowClass(enProceso, false)).toContain('warning');
    expect(getRowClass(pendiente, false)).toContain('bg-surface');
    expect(getRowClass(completado, true)).toContain('bg-primary/10');
  });

  it('getMontoColorClass should depend on estado and tipo', () => {
    expect(getMontoColorClass(completado)).toContain('positive');
    expect(getMontoColorClass(enProceso)).toContain('warning');
    expect(getMontoColorClass(pendiente)).toContain('text-danger');
    expect(getMontoColorClass(ingresoPendiente)).toContain('text-success');
  });

  it('getStatusBadgeClass should depend on estado', () => {
    expect(getStatusBadgeClass(completado)).toContain('positive');
    expect(getStatusBadgeClass(enProceso)).toContain('warning');
    expect(getStatusBadgeClass(pendiente)).toContain('text-muted');
  });

  it('formatCLP should format CLP', () => {
    expect(formatCLP(600)).toMatch(/600/);
    expect(formatCLP(null as unknown as number)).toMatch(/0/);
  });
});
