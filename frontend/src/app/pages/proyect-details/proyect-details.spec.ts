import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProyectDetails } from './proyect-details';

describe('ProyectDetails', () => {
  let component: ProyectDetails;
  let fixture: ComponentFixture<ProyectDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProyectDetails],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProyectDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the tareas tab and switch tabs', () => {
    expect(component.activeTab()).toBe('tareas');
    component.selectedTab('notas');
    expect(component.activeTab()).toBe('notas');
  });
});
