import { APIRequestContext, expect, test, TestInfo } from '@playwright/test';
import { createProject, createTask, uniqueName } from './support/api';

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
    await hoja.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Actividad creada')).toBeVisible();
    const agenda = page.getByRole('region', { name: /^Agenda del/ });
    await expect(agenda.getByText(`Fono ${sufijo}`, { exact: true })).toBeVisible();
  });
});
