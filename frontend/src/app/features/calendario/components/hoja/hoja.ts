import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';

let siguienteId = 0;

/** Hoja inferior en el celular y diálogo centrado en pantallas grandes. */
@Component({
  selector: 'app-calendario-hoja',
  imports: [LucideX],
  host: { '(keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-end md:items-center md:justify-center md:p-4">
      <button
        type="button"
        class="absolute inset-0 bg-overlay/70 backdrop-blur-[2px] cursor-default"
        aria-label="Cerrar"
        tabindex="-1"
        (click)="cerrar.emit()"
      ></button>
      <section
        #panel
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="tituloId"
        tabindex="-1"
        class="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto bg-surface border-t md:border border-surface-border rounded-t-2xl md:rounded-2xl shadow-2xl p-5 pb-8 md:pb-5 flex flex-col gap-4 outline-none"
      >
        <header class="flex items-center justify-between gap-3">
          <h2 [id]="tituloId" class="text-lg font-semibold text-text-main">{{ titulo() }}</h2>
          <button
            type="button"
            (click)="cerrar.emit()"
            aria-label="Cerrar"
            class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-border/60 transition-colors"
          >
            <svg lucideX class="w-5 h-5" aria-hidden="true" />
          </button>
        </header>
        <ng-content />
      </section>
    </div>
  `,
})
export class CalendarioHoja {
  readonly titulo = input.required<string>();
  readonly cerrar = output<void>();
  readonly tituloId = `calendario-hoja-${siguienteId++}`;
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus());
  }
}
