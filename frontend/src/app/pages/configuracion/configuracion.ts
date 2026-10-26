import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideKeyRound } from '@lucide/angular';
import { COLOR_MODES, PALETTES } from '../../models/appearance.model';
import { AppearanceService } from '../../services/appearance.service';

@Component({
  selector: 'app-configuracion',
  imports: [RouterLink, LucideArrowRight, LucideKeyRound],
  templateUrl: './configuracion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  protected readonly appearance = inject(AppearanceService);
  protected readonly palettes = PALETTES;
  protected readonly modes = COLOR_MODES;
}
