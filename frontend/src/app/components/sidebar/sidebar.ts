import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { useToggle } from '../../utils/use-toggle';
import {
  LucideHouse,
  LucideFolder,
  LucideLogOut,
  LucideSparkles,
  LucideLayers,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideHouse,
    LucideFolder,
    LucideLogOut,
    LucideSparkles,
    LucideX,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly authservice = inject(AuthService);
  private readonly router = inject(Router);

  @Input() sidebar = useToggle(false);

  protected chau(): void {
    this.authservice.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        console.log('error al destruir la sesion, redirigiendo a login por seguridad');
        this.router.navigate(['/login']);
      },
    });
  }
}
