import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Test2 } from './test2';

describe('Test2', () => {
  let component: Test2;
  let fixture: ComponentFixture<Test2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Test2],
    }).compileComponents();

    fixture = TestBed.createComponent(Test2);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
