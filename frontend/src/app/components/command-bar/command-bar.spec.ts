import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CommandBar } from './command-bar';
import { CommandBarService } from '../../services/command-bar.service';
import { ProjectMatch, ProjectSearchService } from '../../services/project-search.service';
import { BackButtonService } from '../../services/back-button.service';
import { ProjectResponse } from '../../models/proyect.model';

function makeMatch(id: number, nombre: string, padre?: string): ProjectMatch {
  const project = { id, nombre, nombre_padre: padre } as unknown as ProjectResponse;
  return { project, path: padre ? `${padre} / ${nombre}` : nombre };
}

interface CommandBarInternals {
  query: { (): string; set: (v: string) => void };
  selectedIndex: { (): number; set: (v: number) => void };
  matches: () => ProjectMatch[];
}

describe('CommandBar', () => {
  let component: CommandBar;
  let fixture: ComponentFixture<CommandBar>;
  let commandBar: CommandBarService;
  let router: Router;
  let projectSearch: { search: ReturnType<typeof vi.fn> };
  let results: ProjectMatch[];

  const internals = () => component as unknown as CommandBarInternals;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector('input') as HTMLInputElement | null;
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button'));

  const keydownOnInput = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    input()!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  const openBar = async () => {
    commandBar.state.open();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    results = [makeMatch(1, 'Alpha'), makeMatch(2, 'Beta', 'Padre'), makeMatch(3, 'Gamma')];
    projectSearch = { search: vi.fn(() => results) };

    await TestBed.configureTestingModule({
      imports: [CommandBar],
      providers: [provideRouter([]), { provide: ProjectSearchService, useValue: projectSearch }],
    }).compileComponents();

    fixture = TestBed.createComponent(CommandBar);
    component = fixture.componentInstance;
    commandBar = TestBed.inject(CommandBarService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  afterEach(() => {
    commandBar.state.close();
  });

  it('should create and render nothing while closed', () => {
    expect(component).toBeTruthy();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  describe('global shortcuts', () => {
    it('Ctrl+P toggles the bar and prevents default', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(commandBar.state.isOpen()).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true }));
      expect(commandBar.state.isOpen()).toBe(false);
    });

    it('Meta+P toggles the bar', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', metaKey: true }));
      expect(commandBar.state.isOpen()).toBe(true);
    });

    it('plain "p" does nothing', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(commandBar.state.isOpen()).toBe(false);
    });

    it('Escape closes the bar and clears the query', async () => {
      await openBar();
      internals().query.set('alp');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(commandBar.state.isOpen()).toBe(false);
      expect(internals().query()).toBe('');
    });

    it('Ctrl+P while open closes the bar and clears the query', async () => {
      await openBar();
      internals().query.set('alp');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
      expect(commandBar.state.isOpen()).toBe(false);
      expect(internals().query()).toBe('');
    });

    it('Escape while closed keeps it closed', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(commandBar.state.isOpen()).toBe(false);
    });
  });

  describe('when open', () => {
    beforeEach(openBar);

    it('renders the dialog with one button per match', () => {
      expect(el().querySelector('[role="dialog"]')).not.toBeNull();
      const btns = buttons();
      expect(btns.length).toBe(3);
      expect(btns[1].textContent?.trim()).toBe('Padre / Beta');
    });

    it('focuses the search input', () => {
      expect(document.activeElement).toBe(input());
    });

    it('highlights the first match by default', () => {
      const [first, second] = buttons();
      expect(first.classList.contains('bg-primary')).toBe(true);
      expect(second.classList.contains('bg-primary')).toBe(false);
    });

    it('shows empty state when there are no matches', () => {
      results = [];
      internals().query.set('zzz');
      fixture.detectChanges();
      expect(buttons().length).toBe(0);
      expect(el().textContent).toContain('No se encontraron proyectos.');
    });

    it('typing updates the query and calls ProjectSearchService.search', () => {
      const inp = input()!;
      inp.value = 'gam';
      inp.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(internals().query()).toBe('gam');
      expect(projectSearch.search).toHaveBeenLastCalledWith('gam');
    });

    it('resets the selected index when the query changes', () => {
      internals().selectedIndex.set(2);
      internals().query.set('x');
      fixture.detectChanges();
      expect(internals().selectedIndex()).toBe(0);
    });

    it('ArrowDown moves the selection and wraps around', () => {
      const event = keydownOnInput('ArrowDown');
      expect(event.defaultPrevented).toBe(true);
      expect(internals().selectedIndex()).toBe(1);
      expect(buttons()[1].classList.contains('bg-primary')).toBe(true);

      keydownOnInput('ArrowDown');
      keydownOnInput('ArrowDown');
      expect(internals().selectedIndex()).toBe(0);
    });

    it('ArrowUp wraps to the last match', () => {
      const event = keydownOnInput('ArrowUp');
      expect(event.defaultPrevented).toBe(true);
      expect(internals().selectedIndex()).toBe(2);
      keydownOnInput('ArrowUp');
      expect(internals().selectedIndex()).toBe(1);
    });

    it('arrow keys are no-ops with no matches', () => {
      results = [];
      internals().query.set('zzz');
      fixture.detectChanges();
      keydownOnInput('ArrowDown');
      keydownOnInput('ArrowUp');
      expect(internals().selectedIndex()).toBe(0);
    });

    it('Enter navigates to the selected project and closes', () => {
      keydownOnInput('ArrowDown');
      const event = keydownOnInput('Enter');
      expect(event.defaultPrevented).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/proyectos', 2]);
      expect(commandBar.state.isOpen()).toBe(false);
      expect(internals().query()).toBe('');
    });

    it('Enter with no matches does not navigate', () => {
      results = [];
      internals().query.set('zzz');
      fixture.detectChanges();
      keydownOnInput('Enter');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(commandBar.state.isOpen()).toBe(true);
    });

    it('other keys are ignored', () => {
      const event = keydownOnInput('a');
      expect(event.defaultPrevented).toBe(false);
      expect(internals().selectedIndex()).toBe(0);
    });

    it('mouseenter on a match selects it', () => {
      buttons()[2].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(internals().selectedIndex()).toBe(2);
    });

    it('clicking a match navigates and closes', () => {
      buttons()[0].click();
      expect(router.navigate).toHaveBeenCalledWith(['/proyectos', 1]);
      expect(commandBar.state.isOpen()).toBe(false);
    });

    it('clicking the backdrop closes the bar', () => {
      (el().querySelector('.backdrop-layer') as HTMLElement).click();
      expect(commandBar.state.isOpen()).toBe(false);
    });

    it('clicking inside the dialog does not close the bar', () => {
      (el().querySelector('[role="dialog"]') as HTMLElement).click();
      expect(commandBar.state.isOpen()).toBe(true);
    });

    it('closes via the back button (BackButtonService)', async () => {
      const backButton = TestBed.inject(BackButtonService);
      internals().query.set('alp');
      await backButton.handleBackButton();
      expect(commandBar.state.isOpen()).toBe(false);
      expect(internals().query()).toBe('');
    });
  });

  it('does not register a back-button handler while closed', async () => {
    const backButton = TestBed.inject(BackButtonService);
    fixture.detectChanges();
    const spy = vi.spyOn(component as unknown as { close: () => void }, 'close');
    await backButton.handleBackButton();
    expect(spy).not.toHaveBeenCalled();
  });
});
