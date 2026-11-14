import { Component, input, output } from '@angular/core';
import { LucideSlidersHorizontal } from '@lucide/angular';

export interface Capa {
  /** 'deadlines' o el id del calendario. */
  clave: string;
  nombre: string;
  color: string;
  visible: boolean;
  /** Calendario de turnos: tiene botón para ajustar el ciclo. */
  turnosId?: number;
}

/** Botones para mostrar u ocultar cada calendario. */
@Component({
  selector: 'app-calendario-capas',
  imports: [LucideSlidersHorizontal],
  template: `
    <div role="group" aria-label="Calendarios visibles" class="flex flex-wrap gap-1.5 md:gap-2">
      @for (c of capas(); track c.clave) {
        <div class="flex items-center gap-1 min-w-0 max-w-full">
          <button
            type="button"
            [attr.aria-pressed]="c.visible"
            (click)="alternar.emit(c)"
            class="inline-flex items-center gap-2 min-w-0 h-9 md:h-10 px-3 md:px-3.5 rounded-full border text-[13px] font-medium transition-colors"
            [class.border-surface-border]="!c.visible"
            [class.text-text-muted]="!c.visible"
            [class.bg-surface]="c.visible"
            [class.text-text-main]="c.visible"
            [class.border-text-muted]="c.visible"
          >
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0 border-[1.5px]"
              [style.border-color]="c.color"
              [style.background]="c.visible ? c.color : 'transparent'"
              aria-hidden="true"
            ></span>
            <span class="truncate">{{ c.nombre }}</span>
          </button>
          @if (c.turnosId) {
            <button
              type="button"
              (click)="ciclo.emit(c.turnosId)"
              [attr.aria-label]="'Ajustar el ciclo de ' + c.nombre"
              class="w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-full border border-surface-border flex items-center justify-center hover:bg-surface transition-colors"
              [style.color]="c.color"
            >
              <svg lucideSlidersHorizontal class="w-4 h-4" aria-hidden="true" />
            </button>
          }
        </div>
      }
      <button
        type="button"
        (click)="gestionar.emit()"
        class="inline-flex items-center h-9 md:h-10 px-3 md:px-3.5 rounded-full border border-dashed border-surface-border text-[13px] font-medium text-text-muted hover:text-text-main whitespace-nowrap shrink-0 transition-colors"
      >
        Calendarios…
      </button>
    </div>
  `,
})
export class CalendarioCapas {
  readonly capas = input.required<Capa[]>();
  readonly alternar = output<Capa>();
  readonly ciclo = output<number>();
  readonly gestionar = output<void>();
}
