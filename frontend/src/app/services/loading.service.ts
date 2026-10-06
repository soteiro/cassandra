import { computed, Injectable, signal } from '@angular/core';

/** Tracks navigation and data used by mounted views, independently of background requests. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly navigationId = signal<number | null>(null);
  private readonly views = signal<ReadonlyMap<symbol, string>>(new Map());

  readonly isLoading = computed(() => this.navigationId() !== null || this.views().size > 0);
  readonly label = computed(() => {
    if (this.navigationId() !== null) return 'Abriendo pantalla…';
    return [...this.views().values()].at(-1) ?? '';
  });

  startNavigation(id: number): void {
    this.navigationId.set(id);
  }

  finishNavigation(id: number): void {
    // A cancelled older navigation must not clear a newer one.
    if (this.navigationId() === id) this.navigationId.set(null);
  }

  startView(label: string): () => void {
    const key = Symbol();
    this.views.update((views) => new Map(views).set(key, label));
    return () =>
      this.views.update((views) => {
        const next = new Map(views);
        next.delete(key);
        return next;
      });
  }
}
