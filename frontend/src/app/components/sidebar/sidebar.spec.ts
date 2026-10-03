import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Sidebar } from './sidebar';
import { AuthService } from '../../services/auth.service';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let authService: { logout: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authService = { logout: vi.fn().mockReturnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to /login after a successful logout', () => {
    (component as unknown as { chau: () => void }).chau();
    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should navigate to /login even if logout fails', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    authService.logout.mockReturnValue(throwError(() => new Error('boom')));
    (component as unknown as { chau: () => void }).chau();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
