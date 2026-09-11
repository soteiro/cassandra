import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskStatusSelect } from './task-status-select';

describe('TaskStatusSelect', () => {
  let component: TaskStatusSelect;
  let fixture: ComponentFixture<TaskStatusSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskStatusSelect],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskStatusSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and default to Abierto', () => {
    expect(component).toBeTruthy();
    expect(component.value()).toBe('Abierto');
  });

  it('should render options with bg-background class', () => {
    const selectEl: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(selectEl).toBeTruthy();
    const options = selectEl.querySelectorAll('option');
    expect(options.length).toBe(4);
    options.forEach((opt) => {
      expect(opt.className).toContain('bg-background');
    });
  });

  it('should update value on selection change', () => {
    const selectEl: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    selectEl.value = 'En Curso';
    selectEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.value()).toBe('En Curso');
    expect(component.getBadgeClass()).toContain('bg-accent/15');
  });
});
