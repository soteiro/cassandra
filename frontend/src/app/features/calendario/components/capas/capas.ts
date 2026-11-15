import { Component, computed, input, output } from '@angular/core';
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

/**
 * Filtros compactos para mostrar u ocultar cada calendario. Las acciones (ajustar el ciclo
 * de turnos y gestionar calendarios) van al final, separadas de los filtros.
 */
@Component({
  selector: 'app-calendario-capas',
  imports: [LucideSlidersHorizontal],
  template: `
    <div class="flex flex-wrap items-center gap-1.5">
      <div role="group" aria-label="Calendarios visibles" class="contents">
        @for (c of capas(); track c.clave) {
          <button
            type="button"
            [attr.aria-pressed]="c.visible"
            (click)="alternar.emit(c)"
            class="inline-flex items-center gap-1.5 min-w-0 max-w-44 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors"
            [class.border-surface-border]="!c.visible"
            [class.text-text-muted]="!c.visible"
            [class.bg-surface]="c.visible"
            [class.text-text-main]="c.visible"
            [class.border-text-muted]="c.visible"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0 border-[1.5px]"
              [style.border-color]="c.color"
              [style.background]="c.visible ? c.color : 'transparent'"
              aria-hidden="true"
            ></span>
            <span class="truncate">{{ c.nombre }}</span>
          </button>
        }
      </div>
      @for (t of turnos(); track t.clave) {
        <button
          type="button"
          (click)="ciclo.emit(t.turnosId!)"
          [attr.aria-label]="'Ajustar el ciclo de ' + t.nombre"
          class="inline-flex items-center gap-1.5 min-w-0 max-w-44 h-8 px-2.5 rounded-full border border-dashed border-surface-border text-xs font-medium text-text-muted hover:text-text-main transition-colors"
        >
          <svg
            lucideSlidersHorizontal
            class="w-3.5 h-3.5 shrink-0"
            [style.color]="t.color"
            aria-hidden="true"
          />
          <span class="truncate">{{ turnos().length > 1 ? 'Ciclo · ' + t.nombre : 'Ciclo' }}</span>
        </button>
      }
      <button
        type="button"
        (click)="gestionar.emit()"
        class="inline-flex items-center h-8 px-2.5 rounded-full border border-dashed border-surface-border text-xs font-medium text-text-muted hover:text-text-main whitespace-nowrap shrink-0 transition-colors"
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

  readonly turnos = computed(() => this.capas().filter((c) => c.turnosId));
}
