import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommandBarService } from '../../services/command-bar.service';
import { AppUpdateService } from '../../services/app-update.service';
import { ToastService } from '../../services/toast.service';
import { ServerConfigService } from '../../services/server-config.service';
import { useToggle } from '../../utils/use-toggle';
import {
  LucideHouse,
  LucideFolder,
  LucideLogOut,
  LucideSearch,
  LucideX,
  LucideUser,
  LucideBookOpen,
  LucideWalletMinimal,
  LucideRefreshCw,
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
    LucideWalletMinimal,
    LucideRefreshCw,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly authservice = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly commandBarService = inject(CommandBarService);
  protected readonly updates = inject(AppUpdateService);
  private readonly toast = inject(ToastService);
  protected readonly serverConfig = inject(ServerConfigService);

  @Input() sidebar = useToggle(false);

  constructor() {
    void this.updates.loadCurrentVersion();
  }

  protected async checkForUpdates(): Promise<void> {
    const result = await this.updates.checkForUpdate();
    switch (result.status) {
      case 'available':
        this.toast.info(`Tienes la v${result.current}. Descarga e instala la nueva versión.`, {
          title: `Nueva versión ${result.latest} disponible`,
          duration: 0,
          action: { label: 'Descargar', onClick: () => this.updates.openDownload(result.downloadUrl) },
        });
        break;
      case 'up-to-date':
        this.toast.success(`Tienes la última versión (v${result.current.replace(/^v/, '')}).`);
        break;
      case 'error':
        this.toast.error('No se pudo comprobar si hay actualizaciones. Revisa tu conexión.');
        break;
    }
  }

  /** Cierra la sesión en el servidor actual y vuelve a la pantalla de conexión. */
  protected changeServer(): void {
    const leave = () => {
      this.authservice.isLoggedIn.set(false);
      this.serverConfig.disconnect();
      this.router.navigate(['/servidor']);
    };
    this.authservice.logout().subscribe({ next: leave, error: leave });
  }

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
