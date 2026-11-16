import { APIRequestContext, expect, test, TestInfo } from '@playwright/test';
import { createProject, createTask, uniqueName } from './support/api';

// Barras de scroll reales (headless las oculta): ocupan ancho y pueden desfasar columnas.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

/**
 * Cada test y proyecto de Playwright usa su propio día (corren en paralelo con el mismo
 * usuario): así los choques y turnos de uno no se mezclan con los de otro.
 */
function diaBase(testInfo: TestInfo, n: number): number {
  return 10 + n * 3 + (testInfo.project.name === 'mobile' ? 30 : 0);
}

function dia(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function post<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await request.post(url, { data });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

/** Turnos con ciclo desde hoy (hoy es Largo) y dos actividades que se solapan hoy. */
async function sembrar(request: APIRequestContext, sufijo: string, base: number) {
  const turnos = await post<{ id: number; nombre: string }>(request, '/api/calendarios', {
    nombre: `Turnos ${sufijo}`,
    tipo: 'turnos',
    color: '#c297ff',
  });
  const res = await request.put(`/api/calendarios/${turnos.id}/ciclo`, {
    data: { primer_largo: dia(base) },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const hijo = await post<{ id: number; nombre: string }>(request, '/api/calendarios', {
    nombre: `Hijo ${sufijo}`,
    tipo: 'actividades',
    color: '#58a6ff',
  });
  await post(request, `/api/calendarios/${hijo.id}/actividades`, {
    titulo: `Terapia ${sufijo}`,
    fecha: dia(base),
    hora_inicio: '16:00',
    hora_fin: '17:00',
    dias_semana: [],
  });
  await post(request, `/api/calendarios/${hijo.id}/actividades`, {
    titulo: `Reunión ${sufijo}`,
    fecha: dia(base),
    hora_inicio: '16:30',
    hora_fin: '17:30',
    dias_semana: [],
  });
  return { turnos, hijo };
}

test.describe('calendario', () => {
  test('muestra deadlines, turnos y choques del día', async ({ page, request }, testInfo) => {
    const sufijo = uniqueName('cal', testInfo);
    const base = diaBase(testInfo, 0);
    const proyecto = await createProject(request, `Proyecto ${sufijo}`, {
      fecha_limite: `${dia(base + 5)}T00:00:00.000Z`,
    });
    await createTask(request, proyecto.id, `Uniforme ${sufijo}`, {
      fecha_inicio: `${dia(base - 1)}T00:00:00.000Z`,
      fecha_limite: `${dia(base + 2)}T00:00:00.000Z`,
    });
    const { turnos } = await sembrar(request, sufijo, base);

    await page.goto(`/calendario?vista=mes&fecha=${dia(base)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Calendario' })).toBeVisible();

    const agenda = page.getByRole('region', { name: /^Agenda del/ });
    await expect(agenda.getByText(`Uniforme ${sufijo}`, { exact: true })).toBeVisible();
    await expect(agenda.getByText(`Choca con Reunión ${sufijo}`)).toBeVisible();
    await expect(
      agenda.getByRole('button', { name: new RegExp(`Turno de ${turnos.nombre}: Largo`) }),
    ).toBeVisible();

    // Cambiar el turno de hoy a vacaciones y volver al ciclo.
    await agenda.getByRole('button', { name: new RegExp(`Turno de ${turnos.nombre}`) }).click();
    const hoja = page.getByRole('dialog');
    await hoja.getByRole('button', { name: /Vacaciones/ }).click();
    await expect(page.getByText('Turno actualizado')).toBeVisible();
    await expect(
      agenda.getByRole('button', { name: new RegExp(`${turnos.nombre}: Vacaciones · cambio`) }),
    ).toBeVisible();
  });

  test('las vistas de semana y día montan lo que se solapa', async ({
    page,
    request,
  }, testInfo) => {
    const sufijo = uniqueName('sol', testInfo);
    const base = diaBase(testInfo, 1);
    await sembrar(request, sufijo, base);
    await page.goto(`/calendario?vista=sem&fecha=${dia(base)}`);

    await expect(
      page.getByRole('button', {
        name: new RegExp(`^Reunión ${sufijo}, 16:30 a 17:30, choca con`),
      }),
    ).toBeVisible();

    // Los encabezados de día quedan alineados con las columnas de la grilla.
    const bordes = async (sel: string) =>
      page
        .locator(sel)
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(await bordes('[data-cabecera-dia]')).toEqual(await bordes('[data-columna-dia]'));

    await page.getByRole('button', { name: 'Día', exact: true }).click();
    const reunion = page.getByRole('button', { name: new RegExp(`^Reunión ${sufijo}, 16:30`) });
    const terapia = page.getByRole('button', { name: new RegExp(`^Terapia ${sufijo}, 16:00`) });
    const [r, t] = [await reunion.boundingBox(), await terapia.boundingBox()];
    // La que empieza después queda corrida a la derecha, encima de la otra.
    expect(r!.x).toBeGreaterThan(t!.x);

    // Primer toque la trae al frente; el segundo abre sus opciones.
    await terapia.click({ position: { x: 5, y: 5 } });
    await terapia.click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog', { name: `Terapia ${sufijo}` })).toBeVisible();
  });

  test('crea una actividad semanal y avisa el choque', async ({ page, request }, testInfo) => {
    const sufijo = uniqueName('nueva', testInfo);
    const base = diaBase(testInfo, 2);
    const { hijo } = await sembrar(request, sufijo, base);
    await page.goto(`/calendario?vista=mes&fecha=${dia(base)}`);

    await page.getByRole('button', { name: 'Nueva actividad' }).first().click();
    const hoja = page.getByRole('dialog', { name: 'Nueva actividad' });
    await hoja.getByLabel('Calendario').selectOption({ label: hijo.nombre });
    await hoja.getByLabel('Título').fill(`Fono ${sufijo}`);
    await hoja.getByLabel('Inicio').fill('16:15');
    await hoja.getByLabel('Término').fill('17:00');
    await expect(hoja.getByText(/choca con Terapia/)).toBeVisible();
    await hoja.getByLabel('Se repite cada semana').check();
    // Por defecto se repite sin fin.
    await expect(hoja.getByRole('button', { name: 'Nunca' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (process.env['CAPTURAS_DIR']) {
      await page.screenshot({
        path: `${process.env['CAPTURAS_DIR']}/${testInfo.project.name}-nueva.png`,
      });
    }
    await hoja.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Actividad creada')).toBeVisible();
    const agenda = page.getByRole('region', { name: /^Agenda del/ });
    await expect(agenda.getByText(`Fono ${sufijo}`, { exact: true })).toBeVisible();
  });
});

test('ninguna vista se sale de la pantalla a lo ancho', async ({ page, request }, testInfo) => {
  const sufijo = uniqueName('ancho', testInfo);
  // Varios calendarios con nombres largos: es lo que hacía desbordar los filtros.
  await sembrar(request, `con un nombre bastante largo ${sufijo}`, diaBase(testInfo, 3));
  await post(request, '/api/calendarios', {
    nombre: `Mamá · actividades ${sufijo}`,
    tipo: 'actividades',
  });
  await page.goto('/calendario');
  const ancho = page.viewportSize()!.width;
  const filtros = page.getByRole('group', { name: 'Calendarios visibles' }).getByRole('button');
  await expect(filtros.last()).toBeVisible();
  for (const filtro of await filtros.all()) {
    const caja = (await filtro.boundingBox())!;
    expect(caja.x + caja.width, `${await filtro.textContent()} se sale`).toBeLessThanOrEqual(ancho);
  }
  for (const vista of ['3 meses', 'Mes', 'Semana', 'Día']) {
    await page.getByRole('button', { name: vista, exact: true }).click();
    const desborde = await page.evaluate(() =>
      [document.documentElement, ...document.querySelectorAll('main')].some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ),
    );
    expect(desborde, `la vista ${vista} se sale a lo ancho`).toBe(false);
    if (process.env['CAPTURAS_DIR'] && vista === 'Mes') {
      await page.screenshot({
        path: `${process.env['CAPTURAS_DIR']}/${testInfo.project.name}-filtros.png`,
      });
    }
  }
});

test('edita el nombre y el color de un calendario', async ({ page, request }, testInfo) => {
  const sufijo = uniqueName('editar', testInfo);
  const cal = await post<{ id: number; nombre: string }>(request, '/api/calendarios', {
    nombre: `Hijo ${sufijo}`,
    tipo: 'actividades',
    color: '#58a6ff',
  });
  await page.goto('/calendario');
  await page.getByRole('button', { name: 'Calendarios…' }).click();
  const hoja = page.getByRole('dialog', { name: 'Calendarios' });
  await hoja.getByRole('button', { name: `Editar ${cal.nombre}` }).click();
  const form = hoja.getByRole('form', { name: `Editar ${cal.nombre}` });
  await form.getByLabel('Nombre').fill(`Hijo terapias ${sufijo}`);
  await form.getByRole('button', { name: 'Fucsia' }).click();
  if (process.env['CAPTURAS_DIR']) {
    await page.screenshot({
      path: `${process.env['CAPTURAS_DIR']}/${testInfo.project.name}-editar.png`,
    });
  }
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Calendario actualizado')).toBeVisible();

  const filtro = page
    .getByRole('group', { name: 'Calendarios visibles' })
    .getByRole('button', { name: `Hijo terapias ${sufijo}` });
  await expect(filtro).toBeVisible();
  const res = await request.get('/api/calendarios');
  const guardado = (await res.json()).find((c: { id: number }) => c.id === cal.id);
  expect(guardado).toMatchObject({ nombre: `Hijo terapias ${sufijo}`, color: '#db61a2' });
});

test('muestra los bloques de trabajo planificados y permite quitarlos', async ({
  page,
  request,
}, testInfo) => {
  const sufijo = uniqueName('plan', testInfo);
  const base = diaBase(testInfo, 4);
  const proyecto = await createProject(request, `Proyecto ${sufijo}`);
  const tarea = await createTask(request, proyecto.id, `Informe ${sufijo}`, {
    fecha_limite: `${dia(base + 1)}T00:00:00.000Z`,
  });
  // Lo mismo que hace el asistente por MCP, aquí con la sesión.
  await post(request, `/api/integrations/projects/${proyecto.id}/tasks/${tarea.id}/bloques`, {
    operacion_id: `e2e-${sufijo}`.replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 100),
    bloques: [{ fecha: dia(base), hora_inicio: '09:00', hora_fin: '10:30' }],
  });

  await page.goto(`/calendario?vista=dia&fecha=${dia(base)}`);
  await expect(
    page
      .getByRole('group', { name: 'Calendarios visibles' })
      .getByRole('button', { name: 'Planificado' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const bloque = page.getByRole('button', {
    name: new RegExp(`^Informe ${sufijo}, 09:00 a 10:30`),
  });
  await bloque.click({ position: { x: 5, y: 5 } });
  await bloque.click({ position: { x: 5, y: 5 } });
  const hoja = page.getByRole('dialog', { name: `Informe ${sufijo}` });
  await expect(hoja.getByText(`Proyecto ${sufijo}`)).toBeVisible();
  if (process.env['CAPTURAS_DIR']) {
    await page.screenshot({
      path: `${process.env['CAPTURAS_DIR']}/${testInfo.project.name}-bloque.png`,
    });
  }
  page.once('dialog', (d) => d.accept());
  await hoja.getByRole('button', { name: 'Quitar bloque' }).click();
  await expect(page.getByText('Bloque quitado')).toBeVisible();
  await expect(bloque).toHaveCount(0);
});

test('marca qué calendario libera tiempo y fija el horario de trabajo', async ({
  page,
  request,
}, testInfo) => {
  const sufijo = uniqueName('horario', testInfo);
  const cal = await post<{ id: number; nombre: string; disponibilidad: string }>(
    request,
    '/api/calendarios',
    { nombre: `Colegio ${sufijo}`, tipo: 'actividades' },
  );
  expect(cal.disponibilidad).toBe('ocupa');
  await page.goto('/calendario');
  await page.getByRole('button', { name: 'Calendarios…' }).click();
  const hoja = page.getByRole('dialog', { name: 'Calendarios' });
  await hoja.getByRole('button', { name: `Editar ${cal.nombre}` }).click();
  const form = hoja.getByRole('form', { name: `Editar ${cal.nombre}` });
  await form.getByRole('button', { name: 'Me libera' }).click();
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Calendario actualizado')).toBeVisible();
  await expect(hoja.getByText('Actividades · me libera').first()).toBeVisible();
  const guardado = (await (await request.get('/api/calendarios')).json()).find(
    (c: { id: number }) => c.id === cal.id,
  );
  expect(guardado.disponibilidad).toBe('libera');

  await hoja.getByRole('button', { name: 'Horario de trabajo…' }).click();
  const horario = page.getByRole('dialog', { name: 'Horario de trabajo' });
  await expect(horario).toBeVisible();
  // Otro proyecto de Playwright puede haber guardado ya el horario: se parte de cero.
  const quitar = horario.getByRole('button', { name: /^Quitar franja/ });
  for (let n = await quitar.count(); n > 0; n--) {
    await quitar.first().click();
    await expect(quitar).toHaveCount(n - 1);
  }
  await horario.getByRole('button', { name: 'Agregar franja el lunes' }).click();
  await horario.getByLabel('Lunes, desde').fill('14:00');
  await horario.getByLabel('Lunes, hasta').fill('18:00');
  await horario
    .getByRole('button', { name: 'Usar el horario del lunes de martes a viernes' })
    .click();
  if (process.env['CAPTURAS_DIR']) {
    await page.screenshot({
      path: `${process.env['CAPTURAS_DIR']}/${testInfo.project.name}-horario.png`,
    });
  }
  await horario.getByRole('button', { name: 'Guardar horario' }).click();
  await expect(page.getByText('Horario guardado')).toBeVisible();
  const franjas = await (await request.get('/api/calendario/horario-base')).json();
  expect(franjas).toHaveLength(5);
  expect(franjas[4]).toEqual({ dia_semana: 4, hora_inicio: '14:00', hora_fin: '18:00' });
});
