import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PersonaModal } from './persona-modal';
import { PersonaResponse } from '../../models/persona.model';

const data: PersonaResponse = {
  id: 7,
  user_id: 1,
  nombre: 'Ana',
  alias: 'anita',
  entorno: 'Trabajo',
  informacion: 'Info',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
};

describe('PersonaModal', () => {
  let component: PersonaModal;
  let fixture: ComponentFixture<PersonaModal>;
  let saved: unknown[];
  let closed: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaModal],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaModal);
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

  it('prefills the form in edit mode when opened', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialData', data);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();

    expect(component.nombre()).toBe('Ana');
    expect(component.alias()).toBe('anita');
    expect(component.entorno()).toBe('Trabajo');
    expect(component.informacion()).toBe('Info');
    expect(component.previewAvatarUrl).toBe('https://robohash.org/7?size=160x160');
  });

  it('resets the form in create mode when opened', async () => {
    component.nombre.set('basura');
    component.errorMessage.set('viejo error');
    fixture.componentRef.setInput('initialData', data);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();

    expect(component.nombre()).toBe('');
    expect(component.alias()).toBe('');
    expect(component.errorMessage()).toBe('');
  });

  it('previewAvatarUrl uses the encoded name or a default in create mode', () => {
    expect(component.previewAvatarUrl).toBe('https://robohash.org/new-persona?size=160x160');
    component.nombre.set(' Ana María ');
    expect(component.previewAvatarUrl).toBe('https://robohash.org/Ana%20Mar%C3%ADa?size=160x160');
  });

  it('selectEntorno sets the entorno', () => {
    component.selectEntorno('Familia');
    expect(component.entorno()).toBe('Familia');
  });

  it('onSubmit validates that nombre is required', () => {
    component.nombre.set('   ');
    component.onSubmit();
    expect(component.errorMessage()).toBe('El nombre de la persona es obligatorio');
    expect(saved).toEqual([]);
  });

  it('onSubmit emits a trimmed payload', () => {
    component.nombre.set(' Ana ');
    component.alias.set(' a ');
    component.entorno.set(' Trabajo ');
    component.informacion.set(' x ');
    component.onSubmit();
    expect(saved).toEqual([{ nombre: 'Ana', alias: 'a', entorno: 'Trabajo', informacion: 'x' }]);
  });

  it('onClose emits close', () => {
    component.onClose();
    expect(closed).toBe(1);
  });
});
