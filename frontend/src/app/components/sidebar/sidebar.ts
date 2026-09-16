import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommandBarService } from '../../services/command-bar.service';
import { useToggle } from '../../utils/use-toggle';
import {
  LucideHouse,
  LucideFolder,
  LucideLogOut,
  LucideSearch,
  LucideX,
  LucideUser,
  LucideBookOpen,
  LucideWalletMinimal
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideHouse,
    LucideFolder,
    LucideLogOut,
    LucideSearch,
    LucideX,
    LucideUser,
    LucideBookOpen,
    LucideWalletMinimal
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly authservice = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly commandBarService = inject(CommandBarService);

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
