import { APIRequestContext, expect, TestInfo } from '@playwright/test';

/** Nombre único por test y por proyecto de Playwright (chromium/mobile corren en paralelo). */
export function uniqueName(prefix: string, testInfo: TestInfo): string {
  return `${prefix} ${testInfo.project.name} ${Date.now().toString(36)}`;
}

interface Created {
  id: number;
  nombre: string;
}

/** Crea un proyecto vía API (usa la sesión del storageState) para preparar datos rápido. */
export async function createProject(
  request: APIRequestContext,
  nombre: string,
  extra: Record<string, unknown> = {},
): Promise<Created> {
  const res = await request.post('/api/proyects', {
    data: {
      nombre,
      descripcion: '',
      comentario: '',
      por_que: 'Porque e2e',
      para_que: 'Para probar',
      criterio_finalizacion: 'Cuando pase el test',
      prioridad: 'Media',
      ...extra,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

export async function createTask(
  request: APIRequestContext,
  proyectId: number,
  nombre: string,
  extra: Record<string, unknown> = {},
): Promise<Created> {
  const res = await request.post('/api/tareas', {
    data: { nombre, descripcion: '', comentario: '', estado: 'Abierto', prioridad: 'normal', proyect_id: proyectId, ...extra },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

export interface Periodo {
  mes: number;
  anio: number;
}

/**
 * Período exclusivo para un test de finanzas. Los movimientos son por usuario y período,
 * así que cada test usa un mes propio y cada proyecto de Playwright un año propio
 * (chromium → 2027, mobile → 2028) para poder correr en paralelo sin interferir.
 */
export function periodoExclusivo(testInfo: TestInfo, mes: number): Periodo {
  return { mes, anio: testInfo.project.name === 'mobile' ? 2028 : 2027 };
}

export async function createMovimiento(
  request: APIRequestContext,
  periodo: Periodo,
  data: { nombre: string; monto: number; tipo?: 'ingreso' | 'egreso'; estado?: string },
): Promise<Created> {
  const res = await request.post('/api/finanzas/plantilla', {
    data: { tipo: 'egreso', estado: 'pendiente', ...periodo, ...data },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

export async function createPersona(
  request: APIRequestContext,
  nombre: string,
  extra: Record<string, unknown> = {},
): Promise<Created> {
  const res = await request.post('/api/personas', { data: { nombre, ...extra } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}
