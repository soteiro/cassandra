import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PronosticoService } from '../../services/pronostico.service';

import { ProjectModal } from './project-modal';
import { ProjectResponse } from '../../models/proyect.model';
import { BackButtonService } from '../../services/back-button.service';

const makeProject = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 10,
  nombre: 'Existente',
  descripcion: 'Desc',
  comentario: 'Com',
  fecha_creacion: '2026-01-01T00:00:00Z',
  estado: 'Pausado',
  por_que: 'Porque',
  para_que: 'Para',
  criterio_finalizacion: 'Fin',
  prioridad: 'Alta',
  fecha_limite: '2026-12-31T00:00:00Z',
  proyecto_padre_id: null,
  ...overrides,
});

describe('ProjectModal', () => {
  let component: ProjectModal;
  let fixture: ComponentFixture<ProjectModal>;
  let el: HTMLElement;
  let saveSpy: Mock<(value?: unknown) => void>;
  let closeSpy: Mock<(value?: unknown) => void>;

  const setInputs = async (inputs: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const fillRequired = () => {
    component.nombre.set('  Nuevo  ');
    component.por_que.set('p');
    component.para_que.set('q');
    component.criterio_finalizacion.set('c');
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectModal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectModal);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    saveSpy = vi.fn();
    closeSpy = vi.fn();
    component.save.subscribe(saveSpy);
    component.close.subscribe(closeSpy);
    await fixture.whenStable();
  });

  it('should render nothing while closed', () => {
    expect(el.querySelector('form')).toBeNull();
  });

  it('should render the form with create label when open in create mode', async () => {
    await setInputs({ isOpen: true });
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.textContent).toContain('Crear Proyecto');
  });

  it('should populate the form from initialData in edit mode', async () => {
    await setInputs({ isOpen: true, mode: 'edit', initialData: makeProject() });
    expect(component.nombre()).toBe('Existente');
    expect(component.por_que()).toBe('Porque');
    expect(component.prioridad()).toBe('Alta');
    expect(component.estado()).toBe('Pausado');
    expect(component.fecha_limite()).toBe('2026-12-31');
    expect(el.textContent).toContain('Guardar Cambios');
  });

  it('should reset fields and set parent id in create-subproject mode', async () => {
    component.nombre.set('basura');
    await setInputs({
      isOpen: true,
      mode: 'create-subproject',
      parentProject: makeProject({ id: 99 }),
    });
    expect(component.nombre()).toBe('');
    expect(component.prioridad()).toBe('Media');
    expect(component.estado()).toBe('No Listado');
    expect(component.proyecto_padre_id()).toBe(99);
    expect(el.textContent).toContain('Crear Subproyecto');
  });

  it('should clear previous error when reopened', async () => {
    await setInputs({ isOpen: true });
    component.onSubmit();
    expect(component.errorMessage()).not.toBe('');
    await setInputs({ isOpen: false });
    await setInputs({ isOpen: true });
    expect(component.errorMessage()).toBe('');
  });

  it.each([
    ['nombre', 'El nombre del proyecto es obligatorio'],
    ['por_que', 'Debes responder: ¿Por qué nace este proyecto?'],
    ['para_que', 'Debes responder: ¿Para qué sirve / objetivo?'],
    ['criterio_finalizacion', 'Debes responder: ¿Cuándo se considera terminado?'],
  ] as const)('should require %s', async (field, message) => {
    await setInputs({ isOpen: true });
    fillRequired();
    component[field].set('   ');
    component.onSubmit();
    expect(component.errorMessage()).toBe(message);
    expect(saveSpy).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(el.textContent).toContain(message);
  });

  it('should emit a trimmed create payload without estado', async () => {
    await setInputs({ isOpen: true });
    fillRequired();
    component.fecha_limite.set('2026-12-31');
    component.onSubmit();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const payload = saveSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload["nombre"]).toBe('Nuevo');
    expect(payload["prioridad"]).toBe('Media');
    expect(payload["fecha_limite"]).toBe(new Date('2026-12-31').toISOString());
    expect(payload).not.toHaveProperty('estado');
    expect(payload["proyecto_padre_id"]).toBeUndefined();
  });

  it('should include proyecto_padre_id in create-subproject payload', async () => {
    await setInputs({
      isOpen: true,
      mode: 'create-subproject',
      parentProject: makeProject({ id: 5 }),
    });
    fillRequired();
    component.onSubmit();
    expect((saveSpy.mock.calls[0][0] as Record<string, unknown>)["proyecto_padre_id"]).toBe(5);
    expect((saveSpy.mock.calls[0][0] as Record<string, unknown>)["fecha_limite"]).toBeUndefined();
  });

  it('should include estado but not proyecto_padre_id in edit payload', async () => {
    await setInputs({ isOpen: true, mode: 'edit', initialData: makeProject() });
    component.estado.set('Completado');
    component.onSubmit();
    const payload = saveSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload["estado"]).toBe('Completado');
    expect(payload).not.toHaveProperty('proyecto_padre_id');
  });

  it('should list potential parents only in create mode', async () => {
    await setInputs({
      isOpen: true,
      potentialParents: [makeProject({ id: 1, nombre: 'P1' }), makeProject({ id: 2, nombre: 'P2' })],
    });
    expect(el.textContent).toContain('P1');
    expect(el.textContent).toContain('P2');

    await setInputs({ mode: 'edit', initialData: makeProject({ nombre: 'Editado' }) });
    expect(el.textContent).not.toContain('P1');
  });

  it('should disable submit and show spinner while submitting', async () => {
    await setInputs({ isOpen: true, isSubmitting: true });
    const submit = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Guardando...');
  });

  it('should emit close from cancel button and backdrop, but not from inner panel click', async () => {
    await setInputs({ isOpen: true });
    const cancel = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    ) as HTMLButtonElement;
    cancel.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const backdrop = el.querySelector('div') as HTMLDivElement;
    (backdrop.firstElementChild as HTMLElement).click();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    backdrop.click();
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('should close on back button while open', async () => {
    await setInputs({ isOpen: true });
    await TestBed.inject(BackButtonService).handleBackButton();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('pista de fecha límite', () => {
    const conPlanificacion = (plan: object | undefined) => {
      const servicio = TestBed.inject(PronosticoService);
      vi.spyOn(servicio.planificacionResource, 'value').mockReturnValue(plan as never);
    };

    it('con historia muestra cuánto sueles tardar y la fecha probable', () => {
      conPlanificacion({ proyectos: 4, a_tiempo: 1, factor: 2.5 });
      component.fecha_limite.set('2099-01-01');
      const pista = component.pistaFechaLimite();
      expect(pista?.texto).toContain('2,5× lo estimado (mediana de 4)');
      expect(pista?.fecha).toBeInstanceOf(Date);
    });

    it('si sueles cumplir lo dice sin fecha', () => {
      conPlanificacion({ proyectos: 3, a_tiempo: 3, factor: 1 });
      component.fecha_limite.set('2099-01-01');
      expect(component.pistaFechaLimite()?.texto).toContain('Sueles cumplir tus fechas');
    });

    it('sin factor o sin fecha no hay pista', () => {
      conPlanificacion({ proyectos: 2, a_tiempo: 1 });
      component.fecha_limite.set('2099-01-01');
      expect(component.pistaFechaLimite()).toBeNull();
      conPlanificacion({ proyectos: 4, a_tiempo: 1, factor: 2 });
      component.fecha_limite.set('');
      expect(component.pistaFechaLimite()).toBeNull();
    });
  });
});
