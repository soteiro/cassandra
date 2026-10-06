import { Directive, effect, inject, input } from '@angular/core';
import { LoadingService } from '../services/loading.service';

@Directive({
  selector: '[appLoading]',
  host: { '[attr.aria-busy]': 'appLoading()' },
})
export class LoadingDirective {
  readonly appLoading = input(false);
  readonly loadingLabel = input('Cargando datos…');
  private readonly loading = inject(LoadingService);

  constructor() {
    effect((onCleanup) => {
      if (this.appLoading()) onCleanup(this.loading.startView(this.loadingLabel()));
    });
  }
}
