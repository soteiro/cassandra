import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskPrioritySelect } from './task-priority-select';

describe('TaskPrioritySelect', () => {
  let component: TaskPrioritySelect;
  let fixture: ComponentFixture<TaskPrioritySelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskPrioritySelect],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskPrioritySelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and default to normal', () => {
    expect(component).toBeTruthy();
    expect(component.value()).toBe('normal');
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
    selectEl.value = 'urgente';
    selectEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.value()).toBe('urgente');
    expect(component.getBadgeClass()).toContain('bg-danger/15');
  });
});
