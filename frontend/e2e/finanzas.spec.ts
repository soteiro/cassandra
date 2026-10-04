import { expect, Locator, Page, test } from '@playwright/test';
import { createMovimiento, Periodo, periodoExclusivo } from './support/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Monto en formato es-CL sin depender del espacio entre "$" y la cifra. */
const clp = (n: number) => new RegExp(`\\$\\s?${n.toLocaleString('es-CL').replace(/\./g, '\\.')}`);

async function irAPeriodo(page: Page, { mes, anio }: Periodo) {
  await page.goto('/finanzas');
  const selectMes = page.locator('select').filter({ has: page.locator('option', { hasText: 'Enero' }) }).first();
  const selectAnio = page.locator('select').filter({ has: page.locator('option', { hasText: '2027' }) }).first();
  await selectAnio.selectOption({ label: String(anio) });
  await selectMes.selectOption({ label: MESES[mes - 1] });
  await expect(page.getByText(`${MESES[mes - 1]} ${anio}`, { exact: true })).toBeVisible();
}

/** Tarjeta de resumen (la más interna que contiene la etiqueta). */
function tarjetaResumen(page: Page, etiqueta: string): Locator {
  return page.locator('div.rounded-2xl').filter({ hasText: etiqueta }).last();
}

/** Fila de un movimiento localizada por su concepto. */
function fila(page: Page, nombre: string): Locator {
  return page
    .getByTitle('Clic para editar concepto rápidamente')
    .filter({ hasText: new RegExp(`^\\s*${nombre}\\s*$`) })
    .locator('xpath=ancestor::div[.//input[@title="Seleccionar para acciones en lote"]][1]');
}

test.describe('finanzas · presupuesto', () => {
  test('agrega movimientos rápidos y actualiza el resumen', async ({ page }, testInfo) => {
    const periodo = periodoExclusivo(testInfo, 1);
    await irAPeriodo(page, periodo);

    const alta = async (tipo: 'ingreso' | 'egreso', nombre: string, monto: number) => {
      await page.locator('select[name="quickTipo"]').selectOption(tipo);
      await page.getByPlaceholder('Concepto (ej. Arriendo, Supermercado)...').fill(nombre);
      await page.getByPlaceholder('Monto CLP (ej. 135000)').fill(String(monto));
      await page.getByTitle('Guardar ítem').click();
      await expect(page.getByText('Movimiento agregado').last()).toBeVisible();
    };

    await alta('ingreso', 'Sueldo', 1_000_000);
    await alta('egreso', 'Arriendo', 300_000);

    // Ingresos y egresos se listan en subpestañas distintas.
    await expect(fila(page, 'Arriendo')).toBeVisible();
    await page.getByRole('button', { name: 'Ingresos (1)' }).click();
    await expect(fila(page, 'Sueldo')).toBeVisible();

    await expect(tarjetaResumen(page, 'Ingresos Totales')).toContainText(clp(1_000_000));
    await expect(tarjetaResumen(page, 'Gastos Totales')).toContainText(clp(300_000));
    await expect(tarjetaResumen(page, 'Balance Neto')).toContainText(clp(700_000));
    await expect(tarjetaResumen(page, 'Balance Neto')).toContainText('Superávit');
  });

  test('cambia el estado de un movimiento y lo persiste', async ({ page, request }, testInfo) => {
    const periodo = periodoExclusivo(testInfo, 2);
    await createMovimiento(request, periodo, { nombre: 'Luz', monto: 45_000 });
    await irAPeriodo(page, periodo);

    const estado = () => fila(page, 'Luz').getByTitle(/^Estado actual:/);
    await expect(estado()).toContainText('Pendiente');

    // Un clic avanza al siguiente estado: pendiente → en proceso → completado.
    await estado().click();
    await expect(estado()).toContainText('En Proceso');
    await estado().click();
    await expect(estado()).toContainText('Completado');

    // El menú permite elegir un estado concreto.
    await fila(page, 'Luz').getByTitle('Elegir estado específico').click();
    await fila(page, 'Luz').getByRole('button', { name: 'En Proceso', exact: true }).last().click();
    await expect(estado()).toContainText('En Proceso');

    await page.reload();
    await irAPeriodo(page, periodo);
    await expect(estado()).toContainText('En Proceso');
  });

  test('aplica acciones en lote a los seleccionados', async ({ page, request }, testInfo) => {
    const periodo = periodoExclusivo(testInfo, 3);
    for (const [nombre, monto] of [['Agua', 20_000], ['Gas', 30_000], ['Internet', 25_000]] as const) {
      await createMovimiento(request, periodo, { nombre, monto });
    }
    await irAPeriodo(page, periodo);

    const seleccionar = async (nombre: string) =>
      fila(page, nombre).getByTitle('Seleccionar para acciones en lote').check();

    await seleccionar('Agua');
    await seleccionar('Gas');
    await expect(page.locator('span', { hasText: /^\s*Total:/ })).toContainText(clp(50_000));

    await page.getByTitle('Marcar todos los seleccionados como completados').click();
    await expect(page.getByText('2 movimientos marcados como completado')).toBeVisible();
    await expect(fila(page, 'Agua').getByTitle(/^Estado actual:/)).toContainText('Completado');
    await expect(fila(page, 'Internet').getByTitle(/^Estado actual:/)).toContainText('Pendiente');

    await seleccionar('Agua');
    await seleccionar('Gas');
    await page.getByTitle('Eliminar seleccionados').click();
    await page.getByRole('button', { name: 'Eliminar Seleccionados', exact: true }).click();

    await expect(page.getByText('2 movimientos eliminados')).toBeVisible();
    await expect(fila(page, 'Agua')).toHaveCount(0);
    await expect(fila(page, 'Gas')).toHaveCount(0);
    await expect(fila(page, 'Internet')).toBeVisible();
  });

  test('clona el período al mes siguiente', async ({ page, request }, testInfo) => {
    const origen = periodoExclusivo(testInfo, 4);
    await createMovimiento(request, origen, { nombre: 'Dividendo', monto: 500_000 });
    await createMovimiento(request, origen, { nombre: 'Colegio', monto: 200_000 });
    await irAPeriodo(page, origen);

    await page.getByRole('button', { name: 'Clonar Mes' }).click();
    await page.getByRole('button', { name: 'Clonar Período' }).click();

    await expect(page.getByText(`Se clonaron 2 movimientos a Mayo ${origen.anio}`)).toBeVisible();
    await expect(page.getByText(`Mayo ${origen.anio}`, { exact: true })).toBeVisible();
    await expect(fila(page, 'Dividendo')).toBeVisible();
    await expect(fila(page, 'Colegio')).toBeVisible();
  });
});
