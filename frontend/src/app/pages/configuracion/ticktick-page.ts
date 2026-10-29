import { afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, InjectionToken, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowLeft } from '@lucide/angular';
import { TickTickService } from '../../services/ticktick.service';
import { ServerConfigService } from '../../services/server-config.service';
import { TickTickConnection } from '../../models/ticktick.model';

export const TICKTICK_NAVIGATE = new InjectionToken<(url: string) => void>('TickTick navigation', {
  providedIn: 'root', factory: () => (url) => window.location.assign(url),
});

@Component({
  selector: 'app-ticktick-page',
  imports: [DatePipe, RouterLink, LucideArrowLeft],
  templateUrl: './ticktick-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TickTickPage {
  private readonly service = inject(TickTickService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigate = inject(TICKTICK_NAVIGATE);
  readonly server = inject(ServerConfigService);
  readonly connection = signal<TickTickConnection | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly confirming = signal(false);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly disconnectButton = viewChild<ElementRef<HTMLButtonElement>>('disconnectButton');
  private readonly connectButton = viewChild<ElementRef<HTMLButtonElement>>('connectButton');
  private readonly restoreFocus = signal<'connect' | 'disconnect' | null>(null);

  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const result = route.snapshot.queryParamMap.get('ticktick');
    if (result) {
      const messages: Record<string, string> = {
        connected: 'TickTick conectado. Ya puedes consultar tus tareas de hoy en Home.',
        denied: 'No se autorizó la conexión. Puedes volver a intentarlo.',
        invalid_state: 'La solicitud de conexión venció o ya se utilizó. Inicia una nueva conexión.',
        failed: 'No se pudo completar la conexión. Vuelve a intentarlo.',
        unavailable: 'TickTick todavía no está habilitado en este servidor.',
      };
      this.notice.set(messages[result] ?? '');
      void router.navigate([], { relativeTo: route, queryParams: { ticktick: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    afterRenderEffect(() => { if (this.confirming()) this.cancelButton()?.nativeElement.focus(); });
    afterRenderEffect(() => {
      const target = this.restoreFocus();
      const button = target === 'connect' ? this.connectButton() : target === 'disconnect' ? this.disconnectButton() : undefined;
      if (button) { button.nativeElement.focus(); this.restoreFocus.set(null); }
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.service.status().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => { this.connection.set(status); this.loading.set(false); },
      error: () => { this.error.set('No se pudo consultar la conexión. Vuelve a intentarlo.'); this.loading.set(false); },
    });
  }

  connect() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.service.authorize().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ authorization_url }) => {
        try {
          const url = new URL(authorization_url);
          if (url.origin !== 'https://ticktick.com' || url.pathname !== '/oauth/authorize') throw new Error('Invalid authorization URL');
          this.navigate(url.href);
        } catch {
          this.error.set('No se pudo abrir la autorización de TickTick. Vuelve a intentarlo.');
          this.saving.set(false);
        }
      },
      error: () => { this.error.set('No se pudo iniciar la conexión. Vuelve a intentarlo.'); this.saving.set(false); },
    });
  }

  cancelDisconnect() {
    this.confirming.set(false);
    this.restoreFocus.set('disconnect');
  }

  disconnect() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.service.disconnect().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.connection.set(status);
        this.confirming.set(false);
        this.saving.set(false);
        this.restoreFocus.set('connect');
        this.notice.set(status.revocation_failed
          ? 'Cuenta desconectada de Cassandra. No se pudo confirmar la revocación en TickTick; puedes retirar el permiso desde tu cuenta de TickTick.'
          : 'Cuenta desconectada.');
      },
      error: () => { this.error.set('No se pudo desconectar TickTick. Vuelve a intentarlo.'); this.saving.set(false); },
    });
  }
}
