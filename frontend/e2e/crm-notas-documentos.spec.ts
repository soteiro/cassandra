import { expect, test } from '@playwright/test';
import { createPersona, createProject, createTask, uniqueName } from './support/api';

test.describe('CRM', () => {
  test('registra una persona y abre su perfil', async ({ page }, testInfo) => {
    const nombre = uniqueName('Ada', testInfo);
    await page.goto('/crm');

    await page.getByRole('button', { name: 'Nueva Persona' }).click();
    await page.getByRole('button', { name: 'Registrar Persona' }).click();
    await expect(page.getByText('El nombre de la persona es obligatorio')).toBeVisible();

    await page.getByPlaceholder('Ej: Ada Lovelace').fill(nombre);
    await page.getByPlaceholder('Ej: Directora Técnica / Cassie').fill('Condesa');
    await page.getByPlaceholder('Ej: Trabajo, Cliente, Amigos, Universidad...').fill('Universidad');
    await page.getByRole('button', { name: 'Registrar Persona' }).click();

    await expect(page.getByText('Persona registrada correctamente')).toBeVisible();
    await page.getByRole('link').filter({ hasText: nombre }).click();

    await expect(page).toHaveURL(/\/crm\/persona\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  });

  test('registra, edita y elimina una interacción', async ({ page, request }, testInfo) => {
    const persona = await createPersona(request, uniqueName('Grace', testInfo));
    await page.goto(`/crm/persona/${persona.id}`);

    await page.getByRole('button', { name: 'Nueva Interacción' }).click();
    await page
      .getByPlaceholder('Escribe los detalles de la reunión, llamada, acuerdo o notas de contacto...')
      .fill('Café para hablar de compiladores');
    await page.getByRole('button', { name: 'Guardar Interacción' }).click();
    await expect(page.getByText('Interacción registrada')).toBeVisible();

    await page.getByText('Café para hablar de compiladores').click();
    const panel = page.locator('app-interaccion-modal');
    await panel.getByRole('button', { name: 'Editar', exact: true }).click();
    await panel.getByPlaceholder('Escribe la nota o detalle de la interacción...').fill('Café y COBOL');
    await panel.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.getByText('Interacción actualizada')).toBeVisible();
    await expect(page.getByText('Café y COBOL').first()).toBeVisible();

    await panel.getByTitle('Eliminar interacción', { exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar Registro' }).click();
    await expect(page.getByText('Interacción eliminada')).toBeVisible();
    await expect(page.getByText('Café y COBOL')).toHaveCount(0);
  });

  test('elimina una persona y desaparece del listado', async ({ page, request }, testInfo) => {
    const persona = await createPersona(request, uniqueName('Borrar', testInfo));
    // Visitar /crm primero carga la lista global de personas (recurso compartido).
    await page.goto('/crm');
    await expect(page.getByRole('link').filter({ hasText: persona.nombre })).toBeVisible();

    await page.getByRole('link').filter({ hasText: persona.nombre }).click();
    await page.getByRole('button', { name: 'Eliminar contacto' }).click();
    await page.getByRole('button', { name: 'Eliminar Persona' }).click();

    await expect(page.getByText('Persona eliminada del CRM')).toBeVisible();
    await expect(page).toHaveURL(/\/crm$/);
    await expect(page.getByRole('link').filter({ hasText: persona.nombre })).toHaveCount(0);
  });
});

test.describe('notas de proyecto', () => {
  test('crea una nota vinculada a una tarea, la edita y la elimina', async ({ page, request }, testInfo) => {
    const proyecto = await createProject(request, uniqueName('Notas', testInfo));
    const tarea = await createTask(request, proyecto.id, 'Tarea en curso', { estado: 'En Curso' });
    await page.goto(`/proyectos/${proyecto.id}`);
    await page.getByRole('tab', { name: /Notas/ }).click();

    await page
      .getByPlaceholder('Escribe una nueva nota o cápsula de solución para este proyecto...')
      .fill('La caché se invalida al guardar');
    await page.locator('select[name="newNotaTarea"]').selectOption({ label: `#${tarea.id} - Tarea en curso` });
    await page.getByRole('button', { name: 'Añadir Nota' }).click();

    await expect(page.getByText('Nota guardada')).toBeVisible();
    await expect(page.getByText('La caché se invalida al guardar')).toBeVisible();
    await expect(page.getByText(`Tarea #${tarea.id}: Tarea en curso`)).toBeVisible();

    await page.getByRole('button', { name: 'Editar nota' }).click();
    // El textarea de edición es el único distinto al de "nueva nota".
    await page.locator('textarea:not([name="newNotaText"])').fill('La caché se invalida al publicar');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Nota actualizada')).toBeVisible();
    await expect(page.getByText('La caché se invalida al publicar')).toBeVisible();

    await page.getByRole('button', { name: 'Eliminar nota' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByText('Nota eliminada')).toBeVisible();
    await expect(page.getByText('No hay notas registradas')).toBeVisible();
  });
});

test.describe('documentos de proyecto', () => {
  test('crea un documento Markdown, lo edita y lo elimina', async ({ page, request }, testInfo) => {
    const proyecto = await createProject(request, uniqueName('Docs', testInfo));
    await page.goto(`/proyectos/${proyecto.id}`);
    await page.getByRole('tab', { name: /Documentos/ }).click();

    await page.getByRole('button', { name: 'Nuevo Documento' }).click();
    await page.getByPlaceholder('Ej: Arquitectura de Eventos, Estrategia de Caching...').fill('ADR 001');
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Decisión' }) }).selectOption({ label: 'Decisión' });
    await page.getByPlaceholder('Ej: docker, go, auth').fill('e2e, go');
    await page.getByPlaceholder(/^Escribe el contenido del documento en Markdown aquí/).fill(
      [
        '# Usar Postgres 18',
        '',
        'Elegimos **Postgres** por `pgcrypto`.',
        '',
        '- Simple',
        '- Probado',
        '',
        '<img src=x onerror="window.__xss = true">',
      ].join('\n'),
    );
    await page.getByRole('button', { name: 'Crear Documento' }).click();

    await expect(page.getByText('Documento creado con éxito')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'ADR 001' })).toBeVisible();

    // Markdown renderizado y HTML del usuario escapado (no se ejecuta).
    const contenido = page.locator('.prose-container');
    await expect(contenido.getByRole('heading', { level: 1, name: 'Usar Postgres 18' })).toBeVisible();
    await expect(contenido.locator('strong')).toHaveText('Postgres');
    await expect(contenido.locator('code')).toHaveText('pgcrypto');
    await expect(contenido.locator('li')).toHaveCount(2);
    await expect(contenido.locator('img')).toHaveCount(0);
    await expect(contenido).toContainText('<img src=x onerror="window.__xss = true">');
    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();

    const docs = page.locator('app-documents-tab');
    await docs.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByPlaceholder('Ej: Arquitectura de Eventos, Estrategia de Caching...').fill('ADR 001 · aceptado');
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.getByText('Documento actualizado')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'ADR 001 · aceptado' })).toBeVisible();

    await docs.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar documento' }).click();
    await expect(page.getByText('Documento eliminado')).toBeVisible();
    await expect(page.getByRole('heading', { level: 4, name: 'ADR 001 · aceptado' })).toHaveCount(0);
  });
});
