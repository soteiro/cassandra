import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { BottomNav } from './bottom-nav';
import { useToggle } from '../../utils/use-toggle';

@Component({ template: '' })
class Dummy {}

describe('BottomNav', () => {
  let component: BottomNav;
  let fixture: ComponentFixture<BottomNav>;
  let sidebar: ReturnType<typeof useToggle>;

  const el = () => fixture.nativeElement as HTMLElement;
  const links = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('a'));
  const menuButton = () => el().querySelector('button[aria-label="Más opciones"]') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNav],
      providers: [
        provideRouter([
          { path: 'home', component: Dummy },
          { path: 'proyectos', component: Dummy },
          { path: 'crm', component: Dummy },
          { path: 'finanzas', component: Dummy },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomNav);
    component = fixture.componentInstance;
    sidebar = useToggle(false);
    fixture.componentRef.setInput('sidebar', sidebar);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.sidebar).toBe(sidebar);
  });

  it('renders the four navigation links with correct hrefs', () => {
    expect(links().map((a) => a.getAttribute('href'))).toEqual([
      '/home',
      '/proyectos',
      '/crm',
      '/finanzas',
    ]);
  });

  it('clicking a link closes the sidebar', async () => {
    sidebar.open();
    links()[1].click();
    await fixture.whenStable();
    expect(sidebar.isOpen()).toBe(false);
  });

  it('menu button toggles the sidebar and swaps highlight', async () => {
    const iconWrapper = () => menuButton().querySelector('div') as HTMLElement;
    expect(iconWrapper().classList.contains('text-text-muted')).toBe(true);

    menuButton().click();
    await fixture.whenStable();
    expect(sidebar.isOpen()).toBe(true);
    expect(iconWrapper().classList.contains('text-primary')).toBe(true);

    menuButton().click();
    await fixture.whenStable();
    expect(sidebar.isOpen()).toBe(false);
  });

  it('highlights the active route', async () => {
    await TestBed.inject(Router).navigateByUrl('/crm');
    await fixture.whenStable();
    const wrappers = links().map((a) => a.querySelector('div') as HTMLElement);
    expect(wrappers[2].classList.contains('text-primary')).toBe(true);
    expect(wrappers[0].classList.contains('text-primary')).toBe(false);
  });
});
