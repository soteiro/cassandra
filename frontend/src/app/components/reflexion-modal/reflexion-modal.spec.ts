import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ReflexionModal } from './reflexion-modal';
import { ReflexionResponse, ReflexionUpdateRequest } from '../../models/reflexion.model';

const data: ReflexionResponse = {
  id: 3,
  user_id: 1,
  reflexion: 'Un recuerdo',
  tipo: 'memoria',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
};

describe('ReflexionModal', () => {
  let component: ReflexionModal;
  let fixture: ComponentFixture<ReflexionModal>;
  let saved: ReflexionUpdateRequest[];
  let closed: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReflexionModal],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReflexionModal);
    component = fixture.componentInstance;
    saved = [];
    closed = 0;
    component.save.subscribe((v) => saved.push(v));
    component.close.subscribe(() => closed++);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills texto and tipo from initialData when opened', async () => {
    fixture.componentRef.setInput('initialData', data);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
    expect(component.texto()).toBe('Un recuerdo');
    expect(component.tipo()).toBe('memoria');
  });

  it('resets to defaults when opened without data', async () => {
    component.texto.set('x');
    component.tipo.set('evento');
    component.errorMessage.set('err');
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
    expect(component.texto()).toBe('');
    expect(component.tipo()).toBe('reflexion');
    expect(component.errorMessage()).toBe('');
  });

  it('setTipo changes the tipo', () => {
    component.setTipo('evento');
    expect(component.tipo()).toBe('evento');
  });

  it('onSubmit rejects empty content', () => {
    component.texto.set('   ');
    component.onSubmit();
    expect(component.errorMessage()).toBe('El contenido no puede estar vacío');
    expect(saved).toEqual([]);
  });

  it('onSubmit emits trimmed text and tipo', () => {
    component.texto.set('  hola  ');
    component.setTipo('memoria');
    component.onSubmit();
    expect(saved).toEqual([{ reflexion: 'hola', tipo: 'memoria' }]);
  });

  it('onClose emits close', () => {
    component.onClose();
    expect(closed).toBe(1);
  });
});
