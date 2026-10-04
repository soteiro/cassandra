import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PersonaCard } from './persona-card';
import { PersonaResponse } from '../../models/persona.model';

const base: PersonaResponse = {
  id: 42,
  user_id: 1,
  nombre: 'Ana Pérez',
  alias: 'anita',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
};

describe('PersonaCard', () => {
  let component: PersonaCard;
  let fixture: ComponentFixture<PersonaCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('persona', base);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds the avatar url from the persona id', () => {
    expect(component.avatarUrl).toBe('https://robohash.org/42?size=140x140');
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://robohash.org/42?size=140x140');
    expect(img.alt).toBe('Avatar de Ana Pérez');
  });

  it('renders nombre, alias and a link to the persona detail', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h3')!.textContent).toContain('Ana Pérez');
    expect(el.textContent).toContain('@anita');
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/crm/persona/42');
  });

  it('shows "Sin alias" when there is no alias', async () => {
    fixture.componentRef.setInput('persona', { ...base, alias: undefined });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Sin alias');
  });
});
