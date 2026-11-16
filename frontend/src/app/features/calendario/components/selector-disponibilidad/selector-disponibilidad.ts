import { Component, computed, model } from '@angular/core';
import { DISPONIBILIDADES, DisponibilidadCalendario } from '../../data/calendario.model';

/** Cómo cuenta un calendario para el tiempo libre: me ocupa, me libera o solo contexto. */
@Component({
  selector: 'app-calendario-selector-disponibilidad',
  template: `
    <fieldset>
      <legend class="text-sm font-medium text-text-main mb-1.5">Para planificar tareas</legend>
      <div class="grid grid-cols-3 gap-1.5">
        @for (d of opciones; track d.valor) {
          <button
            type="button"
            [attr.aria-pressed]="valor() === d.valor"
            (click)="valor.set(d.valor)"
            class="min-h-10 px-2 rounded-lg border text-xs font-semibold"
            [class.border-primary]="valor() === d.valor"
            [class.bg-background]="valor() === d.valor"
            [class.text-text-main]="valor() === d.valor"
            [class.border-surface-border]="valor() !== d.valor"
            [class.text-text-muted]="valor() !== d.valor"
          >
            {{ d.nombre }}
          </button>
        }
      </div>
      <p class="mt-1.5 text-xs text-text-muted">{{ ayuda() }}</p>
    </fieldset>
  `,
})
export class CalendarioSelectorDisponibilidad {
  readonly valor = model.required<DisponibilidadCalendario>();
  readonly opciones = DISPONIBILIDADES;
  readonly ayuda = computed(
    () => DISPONIBILIDADES.find((d) => d.valor === this.valor())?.ayuda ?? '',
  );
}
