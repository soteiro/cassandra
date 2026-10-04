import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Header } from './header';
import { CommandBarService } from '../../services/command-bar.service';
import { useToggle } from '../../utils/use-toggle';

@Component({ template: '' })
class Dummy {}

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let commandBar: CommandBarService;

  const el = () => fixture.nativeElement as HTMLElement;
  const searchButton = () => el().querySelector('button[aria-label="Buscar proyecto"]') as HTMLButtonElement;
  const menuButton = () => el().querySelector('button[aria-label="Menú"]') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([{ path: 'home', component: Dummy }])],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    commandBar = TestBed.inject(CommandBarService);
    await fixture.whenStable();
  });

  afterEach(() => commandBar.state.close());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a closed default sidebar toggle', () => {
    expect(component.sidebar.isOpen()).toBe(false);
  });

  it('logo links to /home and closes the sidebar', () => {
    const sidebar = useToggle(true);
    fixture.componentRef.setInput('sidebar', sidebar);
    fixture.detectChanges();
    const link = el().querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/home');
    link.click();
    expect(sidebar.isOpen()).toBe(false);
  });

  it('search button opens the command bar and closes the sidebar', () => {
    const sidebar = useToggle(true);
    fixture.componentRef.setInput('sidebar', sidebar);
    fixture.detectChanges();
    searchButton().click();
    expect(commandBar.state.isOpen()).toBe(true);
    expect(sidebar.isOpen()).toBe(false);
  });

  it('menu button toggles the provided sidebar', () => {
    const sidebar = useToggle(false);
    fixture.componentRef.setInput('sidebar', sidebar);
    fixture.detectChanges();
    menuButton().click();
    expect(sidebar.isOpen()).toBe(true);
    menuButton().click();
    expect(sidebar.isOpen()).toBe(false);
  });
});
