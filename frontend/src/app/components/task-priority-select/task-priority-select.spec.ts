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

describe('TaskPrioritySelect (inputs and classes)', () => {
  let component: TaskPrioritySelect;
  let fixture: ComponentFixture<TaskPrioritySelect>;
  const select = () => fixture.nativeElement.querySelector('select') as HTMLSelectElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskPrioritySelect],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskPrioritySelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders options from TASK_PRIORITY_OPTIONS with labels', () => {
    const labels = Array.from(select().querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Baja', 'Normal', 'Alta', 'Urgente']);
    expect(select().value).toBe('normal');
  });

  it('reflects an external value set via setInput', () => {
    fixture.componentRef.setInput('value', 'alta');
    fixture.detectChanges();
    expect(select().value).toBe('alta');
    expect(component.getBadgeClass()).toContain('text-amber-400');
  });

  it('falls back to "normal" when value is empty', () => {
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();
    expect(select().value).toBe('normal');
  });

  it('emits valueChange on selection change', () => {
    const spy = vi.fn<(v: string) => void>();
    component.value.subscribe(spy);
    select().value = 'baja';
    select().dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalledWith('baja');
  });

  it('binds disabled, name, title and aria-label', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('name', 'prio');
    fixture.componentRef.setInput('title', 'T');
    fixture.componentRef.setInput('ariaLabel', 'A');
    fixture.detectChanges();
    const s = select();
    expect(s.disabled).toBe(true);
    expect(s.name).toBe('prio');
    expect(s.title).toBe('T');
    expect(s.getAttribute('aria-label')).toBe('A');
  });

  it.each([
    ['xs', 'text-[10px]'],
    ['sm', 'px-2.5'],
    ['md', 'w-full'],
  ] as const)('size %s produces %s', (size, cls) => {
    fixture.componentRef.setInput('size', size);
    expect(component.getSizeClass()).toContain(cls);
    expect(component.getComputedClasses()).toContain(cls);
  });

  it('badge variant includes badge and custom classes', () => {
    fixture.componentRef.setInput('customClass', 'my-extra');
    const classes = component.getComputedClasses();
    expect(classes).toContain(component.getBadgeClass());
    expect(classes).toContain('my-extra');
  });

  it('input variant ignores badge/size classes', () => {
    fixture.componentRef.setInput('variant', 'input');
    fixture.componentRef.setInput('customClass', 'my-extra');
    fixture.detectChanges();
    const classes = component.getComputedClasses();
    expect(classes).toContain('bg-background');
    expect(classes).toContain('my-extra');
    expect(classes).not.toContain(component.getBadgeClass());
    expect(select().classList.contains('my-extra')).toBe(true);
  });

  it('supports custom options', () => {
    fixture.componentRef.setInput('options', [
      { value: 'baja', label: 'Low', badgeClass: '', optionClass: 'x' },
    ]);
    fixture.detectChanges();
    const opts = select().querySelectorAll('option');
    expect(opts.length).toBe(1);
    expect(opts[0].textContent?.trim()).toBe('Low');
  });
});
