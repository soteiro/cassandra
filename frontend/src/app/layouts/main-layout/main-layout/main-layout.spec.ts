import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MainLayout } from './main-layout';
import { BackButtonService } from '../../../services/back-button.service';
import { CommandBarService } from '../../../services/command-bar.service';

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;

  const el = () => fixture.nativeElement as HTMLElement;
  const overlay = () => el().querySelector('div.fixed.bg-black\\/50') as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(CommandBarService).state.close());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders header, sidebar, bottom nav, command bar and router outlet', () => {
    for (const sel of ['app-header', 'app-sidebar', 'app-bottom-nav', 'app-command-bar', 'router-outlet']) {
      expect(el().querySelector(sel)).not.toBeNull();
    }
  });

  it('starts with the sidebar closed and no overlay', () => {
    expect(component.sidebar.isOpen()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('header menu button opens the shared sidebar and shows the overlay', async () => {
    (el().querySelector('app-header button[aria-label="Menú"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.sidebar.isOpen()).toBe(true);
    expect(overlay()).not.toBeNull();
  });

  it('bottom nav menu button toggles the same sidebar instance', async () => {
    (el().querySelector('app-bottom-nav button[aria-label="Más opciones"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.sidebar.isOpen()).toBe(true);
  });

  it('clicking the overlay closes the sidebar', async () => {
    component.sidebar.open();
    await fixture.whenStable();
    overlay()!.click();
    await fixture.whenStable();
    expect(component.sidebar.isOpen()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('back button closes the sidebar when open', async () => {
    component.sidebar.open();
    await fixture.whenStable();
    await TestBed.inject(BackButtonService).handleBackButton();
    expect(component.sidebar.isOpen()).toBe(false);
  });

  it('command bar (priority 90) wins over sidebar (70) on back button', async () => {
    const commandBar = TestBed.inject(CommandBarService);
    component.sidebar.open();
    commandBar.state.open();
    await fixture.whenStable();
    const backButton = TestBed.inject(BackButtonService);

    await backButton.handleBackButton();
    expect(commandBar.state.isOpen()).toBe(false);
    expect(component.sidebar.isOpen()).toBe(true);

    await fixture.whenStable();
    await backButton.handleBackButton();
    expect(component.sidebar.isOpen()).toBe(false);
  });
});
