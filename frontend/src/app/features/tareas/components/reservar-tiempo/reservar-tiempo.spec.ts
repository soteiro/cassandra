import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { settle, setupHttpTesting } from '../../../../../testing/http-testing';
import { PlanificacionResult } from '../../data/planificacion.model';
import { ahoraLocal } from '../../data/planificacion.service';
import { ReservarTiempo } from './reservar-tiempo';

describe('ReservarTiempo', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ReservarTiempo>;
  let el: HTMLElement;

  /** Dispara las peticiones pendientes sin esperar respuesta. */
  const tick = () => {
    fixture.detectChanges();
    TestBed.tick();
  };
  /** Tras responder con flush(), deja que los recursos procesen y vuelve a pintar. */
  const pintar = async () => {
    await settle();
    fixture.detectChanges();
  };
  const button = (text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  const cambiar = (campo: HTMLInputElement | HTMLSelectElement, valor: string) => {
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const horas = (inicio: string, fin: string) => {
    const [ini, ter] = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    cambiar(ini, inicio);
    cambiar(ter, fin);
  };
  const huecos = () => http.expectOne((r) => r.url.endsWith('/integrations/calendar'));
  const alerta = () => el.querySelector('[role="alert"]')?.textContent ?? '';

  beforeEach(() => {
    http = setupHttpTesting();
    fixture = TestBed.createComponent(ReservarTiempo);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  async function conTareaDada() {
    fixture.componentRef.setInput('proyectoId', 3);
    fixture.componentRef.setInput('tareaId', 41);
    fixture.componentRef.setInput('fechaInicial', '2026-11-18');
    tick();
  }

  it('con la tarea dada, ofrece los huecos del día y reserva el elegido', async () => {
    await conTareaDada();
    expect(el.querySelector('select')).toBeNull();
    const req = huecos();
    expect(req.request.params.get('desde')).toBe('2026-11-18');
    expect(req.request.params.get('hasta')).toBe('2026-11-18');
    req.flush({
      huecos: [
        { fecha: '2026-11-18', hora_inicio: '07:00', hora_fin: '08:30', minutos: 90 },
        { fecha: '2026-11-18', hora_inicio: '16:00', hora_fin: '17:30', minutos: 90 },
      ],
    });
    await pintar();

    const guardado = vi.fn();
    fixture.componentInstance.guardado.subscribe(guardado);
    const hueco = el.querySelector<HTMLButtonElement>('[aria-label="Usar de 16:00 a 17:30"]')!;
    hueco.click();
    tick();
    expect(hueco.getAttribute('aria-pressed')).toBe('true');
    button('Reservar bloque').click();
    tick();

    const post = http.expectOne('/api/integrations/projects/3/tasks/41/bloques');
    expect(post.request.method).toBe('POST');
    expect(post.request.body.operacion_id).toMatch(/^app-[a-z0-9-]{8,}$/);
    expect(post.request.body.bloques).toEqual([
      { fecha: '2026-11-18', hora_inicio: '16:00', hora_fin: '17:30' },
    ]);
    const res: PlanificacionResult = { bloques: [], avisos: null };
    post.flush(res);
    expect(guardado).toHaveBeenCalledWith(res);
    // Los huecos se vuelven a pedir: el bloque nuevo ya ocupa ese tiempo.
    tick();
    huecos().flush({ huecos: [] });
    await pintar();
  });

  it('sin tarea dada, pide elegir proyecto y tarea y solo lista tareas abiertas', async () => {
    fixture.componentRef.setInput('proyectos', [{ id: 3, nombre: 'Finanzas' }]);
    fixture.componentRef.setInput('fechaInicial', '2026-11-18');
    tick();
    huecos().flush({ huecos: [] });
    await pintar();

    button('Reservar bloque').click();
    tick();
    expect(alerta()).toContain('Elige un proyecto');

    const [proyecto] = Array.from(el.querySelectorAll('select'));
    cambiar(proyecto, '3');
    tick();
    http.expectOne('/api/proyects/3/tareas').flush([
      { id: 41, nombre: 'Informe', estado: 'Abierto', eliminado: false, subtareas: [] },
      { id: 42, nombre: 'Cerrada', estado: 'Terminado', eliminado: false },
    ]);
    await pintar();
    const tarea = el.querySelectorAll('select')[1];
    expect(Array.from(tarea.options).map((o) => o.textContent?.trim())).toEqual([
      'Elige una tarea',
      '#41 · Informe',
    ]);

    cambiar(tarea, '41');
    horas('10:00', '09:00');
    button('Reservar bloque').click();
    tick();
    expect(alerta()).toContain('posterior al inicio');
  });

  it('calcula el término con la estimación, sin pasarse del hueco', async () => {
    fixture.componentRef.setInput('estimacionMin', 60);
    await conTareaDada();
    huecos().flush({
      huecos: [
        { fecha: '2026-11-18', hora_inicio: '07:00', hora_fin: '08:30', minutos: 90 },
        { fecha: '2026-11-18', hora_inicio: '16:00', hora_fin: '16:30', minutos: 30 },
      ],
    });
    await pintar();
    const [inicio, termino] = Array.from(
      el.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    );
    expect(el.textContent).toContain('Dura 1 h, según la estimación.');

    el.querySelector<HTMLButtonElement>('[aria-label="Usar de 07:00 a 08:30"]')!.click();
    tick();
    expect([inicio.value, termino.value]).toEqual(['07:00', '08:00']);

    el.querySelector<HTMLButtonElement>('[aria-label="Usar de 16:00 a 16:30"]')!.click();
    tick();
    expect(termino.value).toBe('16:30');
    expect(el.textContent).toContain('El bloque dura 30 min de los 1 h estimados.');

    // A mano: el término escrito se respeta hasta que cambie el inicio.
    cambiar(inicio, '10:00');
    tick();
    expect(termino.value).toBe('11:00');
    cambiar(termino, '12:00');
    tick();
    expect(termino.value).toBe('12:00');
    cambiar(inicio, '10:15');
    tick();
    expect(termino.value).toBe('11:15');
  });

  it('en el calendario usa la estimación de la tarea elegida', async () => {
    fixture.componentRef.setInput('proyectos', [{ id: 3, nombre: 'Finanzas' }]);
    fixture.componentRef.setInput('proyectoId', 3);
    fixture.componentRef.setInput('fechaInicial', '2026-11-18');
    tick();
    huecos().flush({ huecos: [] });
    http.expectOne('/api/proyects/3/tareas').flush([
      { id: 41, nombre: 'Informe', estado: 'Abierto', eliminado: false, estimacion_min: 45 },
      { id: 43, nombre: 'Sin estimar', estado: 'Abierto', eliminado: false },
    ]);
    await pintar();
    const tarea = el.querySelectorAll('select')[1];
    const [inicio, termino] = Array.from(
      el.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    );
    cambiar(tarea, '41');
    cambiar(inicio, '09:00');
    tick();
    expect(termino.value).toBe('09:45');

    cambiar(tarea, '43');
    tick();
    expect(termino.value).toBe('09:45');
    expect(el.textContent).toContain('La tarea no tiene estimación');
  });

  it('muestra el error del servidor si el bloque se solapa', async () => {
    await conTareaDada();
    huecos().flush({ huecos: [] });
    await pintar();
    horas('10:00', '11:00');
    button('Reservar bloque').click();
    tick();
    http
      .expectOne('/api/integrations/projects/3/tasks/41/bloques')
      .flush('El bloque se solapa con otro bloque de trabajo', {
        status: 409,
        statusText: 'Conflict',
      });
    await pintar();
    expect(alerta()).toContain('se solapa');
    expect(button('Reservar bloque').disabled).toBe(false);
  });

  it('ahoraLocal usa la hora local del navegador', () => {
    expect(ahoraLocal(new Date(2026, 10, 7, 9, 5))).toBe('2026-11-07T09:05');
  });
});
