import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';
import { ApiKeys } from '../../components/api-keys/api-keys';

@Component({
  selector: 'app-api-keys-page',
  imports: [ApiKeys, RouterLink, LucideArrowLeft],
  template: `
    <div class="max-w-5xl mx-auto space-y-6">
      <a routerLink="/configuracion"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-text-muted hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <svg lucideArrowLeft class="size-4" aria-hidden="true" />
        Volver a Configuración
      </a>
      <app-api-keys />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysPage {}
