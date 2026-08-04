import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProyectDetails } from './proyect-details';

describe('ProyectDetails', () => {
  let component: ProyectDetails;
  let fixture: ComponentFixture<ProyectDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProyectDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(ProyectDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
