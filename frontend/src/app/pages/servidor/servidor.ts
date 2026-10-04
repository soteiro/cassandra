import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerConfigService } from '../../services/server-config.service';
import { ToastService } from '../../services/toast.service';

/** Primera pantalla de la app Android: elegir el servidor Cassandra propio. */
@Component({
  selector: 'app-servidor',
  imports: [FormsModule],
  templateUrl: './servidor.html',
})
export class Servidor {
  private readonly serverConfig = inject(ServerConfigService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly address = signal(this.serverConfig.serverUrl() ?? '');
  protected readonly connecting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.connecting()) return;
    this.errorMessage.set(null);
    this.connecting.set(true);

    const result = await this.serverConfig.connect(this.address());
    this.connecting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error);
      return;
    }
    this.toast.success(`Conectado a ${this.serverConfig.serverUrl()} (${result.version})`);
    this.router.navigate(['/login']);
  }
}
