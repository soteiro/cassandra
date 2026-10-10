import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevisionService } from '../../services/revision.service';
import { tocaRevision } from '../../utils/revision.util';

/** Tarjeta del inicio: aparece desde el día de revisión elegido hasta que la haces. */
@Component({
  selector: 'app-revision-card',
  imports: [RouterLink],
  template: `
    @if (toca()) {
      <a
        routerLink="/revision"
        class="flex items-center justify-between gap-3 p-3 sm:px-4 bg-primary/10 border border-primary/30 rounded-2xl text-xs text-text-main hover:bg-primary/15 transition-colors"
      >
        <span>
          <strong class="font-semibold">Toca la revisión semanal.</strong>
          <span class="text-text-muted"> Unos 15 minutos para cerrar lo que quedó sin decidir.</span>
        </span>
        <span class="text-primary font-semibold shrink-0">Empezar →</span>
      </a>
    }
  `,
})
export class RevisionCard {
  private readonly revisionService = inject(RevisionService);

  readonly toca = computed(() => {
    const pref = this.revisionService.preferenciasResource.value();
    const revisiones = this.revisionService.revisionesResource.value();
    // Sin datos (cargando o error) no se molesta.
    if (!pref || !revisiones) return false;
    const ultima = revisiones[0] ? new Date(revisiones[0].fecha_creacion) : null;
    return tocaRevision(pref.dia_revision, ultima, new Date());
  });
}
