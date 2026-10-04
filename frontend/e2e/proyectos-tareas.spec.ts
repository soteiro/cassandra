import { expect, Locator, Page, test } from '@playwright/test';
import { createProject, createTask, uniqueName } from './support/api';

/** Tarjeta de una tarea principal (incluye sus subtareas) localizada por su título. */
function taskCard(page: Page, nombre: string): Locator {
  return page
    .getByRole('heading', { level: 4, name: nombre, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
}

/** Fila de una subtarea dentro de la tarjeta de su tarea padre. */
function subtaskRow(card: Locator, nombre: string): Locator {
  return card
    .getByTitle('Haz clic para editar la subtarea')
    .filter({ hasText: new RegExp(`^\\s*${nombre}\\s*$`) })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

test.describe('proyectos', () => {
  test('crea un proyecto desde la UI y abre su detalle', async ({ page }, testInfo) => {
    const nombre = uniqueName('Proyecto UI', testInfo);
    await page.goto('/proyectos');

    await page.getByRole('button', { name: 'Nuevo Proyecto' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Proyecto Intencional' })).toBeVisible();

    // Validación: los campos de intención son obligatorios.
    await page.locator('input[name="nombre"]').fill(nombre);
    await page.getByRole('button', { name: 'Crear Proyecto' }).click();
    await expect(page.getByText('Debes responder: ¿Por qué nace este proyecto?')).toBeVisible();

    await page.locator('textarea[name="por_que"]').fill('Para tener e2e');
    await page.locator('textarea[name="para_que"]').fill('Detectar regresiones');
    await page.locator('input[name="criterio_finalizacion"]').fill('Suite verde');
    await page.locator('select[name="prioridad"]').selectOption('Alta');
    await page.getByRole('button', { name: 'Crear Proyecto' }).click();

    await expect(page.getByText('Proyecto creado correctamente')).toBeVisible();
    const card = page.getByRole('link').filter({ hasText: nombre });
    await expect(card).toBeVisible();

    await card.click();
    await expect(page).toHaveURL(/\/proyectos\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  });

  test('crea un subproyecto vinculado al padre', async ({ page, request }, testInfo) => {
    const padre = await createProject(request, uniqueName('Padre', testInfo));
    const hijo = uniqueName('Hijo', testInfo);
    await page.goto(`/proyectos/${padre.id}`);

    await page.getByRole('tab', { name: /Subproyectos/ }).click();
    await page.getByRole('button', { name: 'Nuevo Subproyecto' }).click();
    await expect(page.getByText(`Vinculado al proyecto padre: ${padre.nombre}`)).toBeVisible();

    await page.locator('input[name="nombre"]').fill(hijo);
    await page.locator('textarea[name="por_que"]').fill('Dividir trabajo');
    await page.locator('textarea[name="para_que"]').fill('Avanzar por partes');
    await page.locator('input[name="criterio_finalizacion"]').fill('Hijo terminado');
    await page.getByRole('button', { name: 'Crear Subproyecto' }).click();

    await expect(page.getByText('Subproyecto creado con éxito')).toBeVisible();
    await page.getByRole('link').filter({ hasText: hijo }).click();

    await expect(page.getByRole('heading', { level: 1, name: hijo })).toBeVisible();
    const breadcrumb = page.getByTitle('Ir al proyecto padre');
    await expect(breadcrumb).toContainText(padre.nombre);
    await breadcrumb.click();
    await expect(page).toHaveURL(new RegExp(`/proyectos/${padre.id}$`));
  });

  test('elimina un proyecto tras confirmar', async ({ page, request }, testInfo) => {
    const proyecto = await createProject(request, uniqueName('Borrar', testInfo));
    await page.goto(`/proyectos/${proyecto.id}`);

    await page.getByRole('button', { name: 'Eliminar proyecto' }).click();
    await expect(page.getByText('¿Eliminar proyecto?')).toBeVisible();
    // Al abrir el modal hay dos botones "Eliminar proyecto": el del header y el de confirmar.
    await page.getByRole('button', { name: 'Eliminar proyecto' }).last().click();

    await expect(page.getByText('Proyecto eliminado')).toBeVisible();
    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(page.getByRole('link').filter({ hasText: proyecto.nombre })).toHaveCount(0);
  });
});

test.describe('tareas', () => {
  test('crea una tarea, cambia su estado y la completa', async ({ page, request }, testInfo) => {
    const proyecto = await createProject(request, uniqueName('Tareas', testInfo));
    const tarea = uniqueName('Tarea', testInfo);
    await page.goto(`/proyectos/${proyecto.id}`);

    // Alta rápida con Enter.
    const input = page.getByPlaceholder('Escribe una nueva tarea...');
    await input.fill(tarea);
    await input.press('Enter');
    await expect(taskCard(page, tarea)).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Pendientes (1)' })).toBeVisible();

    // Cambio de estado con el select.
    await taskCard(page, tarea).getByRole('combobox', { name: 'Estado de la tarea' }).selectOption('En Curso');
    await expect(page.getByRole('button', { name: 'En Curso (1)' })).toBeVisible();

    // Completar: desaparece de Pendientes y aparece tachada en Completadas.
    await taskCard(page, tarea).getByTitle('Marcar como terminada').click();
    await expect(page.getByText('Tarea Completada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completadas (1)' })).toBeVisible();
    await expect(taskCard(page, tarea)).toHaveCount(0);

    await page.getByRole('button', { name: 'Completadas (1)' }).click();
    await expect(page.getByRole('heading', { level: 4, name: tarea })).toHaveClass(/line-through/);

    // Persistido en el backend.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Completadas (1)' })).toBeVisible();
  });

  test('añade subtareas inline y muestra el progreso', async ({ page, request }, testInfo) => {
    const proyecto = await createProject(request, uniqueName('Subtareas', testInfo));
    const padre = await createTask(request, proyecto.id, uniqueName('Padre', testInfo));
    await page.goto(`/proyectos/${proyecto.id}`);

    const card = taskCard(page, padre.nombre);
    await card.getByTitle('Mostrar subtareas').click();

    const subInput = card.getByPlaceholder('Añadir subtarea... (pulsa Enter para guardar)');
    for (const sub of ['Sub A', 'Sub B']) {
      await subInput.fill(sub);
      await subInput.press('Enter');
      await expect(subtaskRow(card, sub)).toBeVisible();
    }
    await expect(card.getByTitle('Subtareas: 0 de 2 completadas')).toBeVisible();

    await subtaskRow(card, 'Sub A').getByTitle('Completar subtarea').click();
    await expect(card.getByTitle('Subtareas: 1 de 2 completadas')).toBeVisible();
    await expect(card.getByTitle('Haz clic para editar la subtarea').filter({ hasText: 'Sub A' })).toHaveClass(/line-through/);
  });
});
