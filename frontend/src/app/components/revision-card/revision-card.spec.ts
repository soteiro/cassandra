import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { RevisionCard } from './revision-card';
import { RevisionService } from '../../services/revision.service';
import { Preferencias, Revision } from '../../models/revision.model';

describe('RevisionCard', () => {
  let fixture: ComponentFixture<RevisionCard>;
  const pref = signal<Preferencias | undefined>(undefined);
  const revs = signal<Revision[] | undefined>(undefined);

  beforeEach(async () => {
    pref.set(undefined);
    revs.set(undefined);
    await TestBed.configureTestingModule({
      imports: [RevisionCard],
      providers: [
        provideRouter([]),
        { provide: RevisionService, useValue: { preferenciasResource: { value: pref }, revisionesResource: { value: revs } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RevisionCard);
  });

  const texto = () => {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('no muestra nada mientras carga', () => {
    expect(texto()).not.toContain('revisión semanal');
  });

  it('aparece si nunca revisaste', () => {
    pref.set({ dia_revision: new Date().getDay(), limite_en_curso: 5 });
    revs.set([]);
    expect(texto()).toContain('Toca la revisión semanal');
  });

  it('no aparece si ya revisaste hoy', () => {
    pref.set({ dia_revision: new Date().getDay(), limite_en_curso: 5 });
    revs.set([{ id: 1, nota: '', resumen: {}, fecha_creacion: new Date().toISOString() }]);
    expect(texto()).not.toContain('Toca la revisión semanal');
  });
});
