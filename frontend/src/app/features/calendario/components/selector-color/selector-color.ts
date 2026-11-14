import { Component, computed, input, model } from '@angular/core';
import { PALETA_CALENDARIO } from '../../data/calendario.model';

/** Paleta de colores del calendario más un selector libre para cualquier otro. */
@Component({
  selector: 'app-calendario-selector-color',
  template: `
    <fieldset>
      <legend class="text-sm font-medium text-text-main mb-1.5">{{ etiqueta() }}</legend>
      <div class="grid grid-cols-7 gap-1.5 justify-items-center">
        @for (p of paleta; track p.color) {
          <button
            type="button"
            [attr.aria-pressed]="color() === p.color"
            [attr.aria-label]="p.nombre"
            [title]="p.nombre"
            (click)="color.set(p.color)"
            class="w-10 h-10 rounded-full border-2 flex items-center justify-center"
            [class.border-text-main]="color() === p.color"
            [class.border-transparent]="color() !== p.color"
          >
            <span class="w-7 h-7 rounded-full" [style.background]="p.color"></span>
          </button>
        }
        <label
          class="relative w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer"
          [class.border-text-main]="personalizado()"
          [class.border-dashed]="!personalizado()"
          [class.border-surface-border]="!personalizado()"
          title="Otro color"
        >
          <span class="sr-only">Otro color</span>
          <span
            class="w-7 h-7 rounded-full"
            aria-hidden="true"
            [style.background]="
              personalizado()
                ? color()
                : 'conic-gradient(#ff7b72, #ff9e64, #7ee787, #56d4dd, #58a6ff, #c297ff, #ff7b72)'
            "
          ></span>
          <input
            type="color"
            class="absolute inset-0 opacity-0 cursor-pointer"
            [value]="color()"
            (input)="color.set($any($event.target).value)"
          />
        </label>
      </div>
    </fieldset>
  `,
})
export class CalendarioSelectorColor {
  readonly color = model.required<string>();
  readonly etiqueta = input('Color');
  readonly paleta = PALETA_CALENDARIO;
  readonly personalizado = computed(
    () => !PALETA_CALENDARIO.some((p) => p.color.toLowerCase() === this.color().toLowerCase()),
  );
}
