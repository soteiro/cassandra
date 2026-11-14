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
    <div
      role="group"
      aria-label="Calendarios visibles"
      class="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap pb-0.5"
    >
      @for (c of capas(); track c.clave) {
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            [attr.aria-pressed]="c.visible"
            (click)="alternar.emit(c)"
            class="inline-flex items-center gap-2 h-10 px-3.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors"
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
            {{ c.nombre }}
          </button>
          @if (c.turnosId) {
            <button
              type="button"
              (click)="ciclo.emit(c.turnosId)"
              [attr.aria-label]="'Ajustar el ciclo de ' + c.nombre"
              class="w-10 h-10 rounded-full border border-surface-border flex items-center justify-center hover:bg-surface transition-colors"
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
        class="inline-flex items-center h-10 px-3.5 rounded-full border border-dashed border-surface-border text-[13px] font-medium text-text-muted hover:text-text-main whitespace-nowrap shrink-0 transition-colors"
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
