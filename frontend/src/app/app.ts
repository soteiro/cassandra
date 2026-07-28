import { Component, computed, inject, signal } from '@angular/core';
import { StatusService } from '../services/status.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Home');
  private readonly statusService = inject(StatusService);

  readonly health = this.statusService.health;
  readonly status = computed(
    () => this.health.value()?.status ?? 'consultando go...',
  );
  readonly isLoading = computed(
    () => this.health.isLoading() && !this.health.hasValue(),
  );
  readonly error = computed(() => this.health.error());
}