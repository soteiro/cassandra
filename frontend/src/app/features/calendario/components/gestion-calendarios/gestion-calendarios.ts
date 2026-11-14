import { Component, input, output, signal } from '@angular/core';
import { LucideTrash2 } from '@lucide/angular';
import {
  Calendario,
  CalendarioRequest,
  COLORES_CALENDARIO,
  TipoCalendario,
} from '../../data/calendario.model';

const CAMPO =
  'h-11 w-full px-3 rounded-lg border border-surface-border bg-background text-text-main outline-none focus:border-primary';

/** Crear y eliminar calendarios propios. */
@Component({
  selector: 'app-calendario-gestion',
  imports: [LucideTrash2],
  template: `
    @if (calendarios().length) {
      <ul
        class="flex flex-col divide-y divide-surface-border border border-surface-border rounded-xl"
      >
        @for (c of calendarios(); track c.id) {
          <li class="flex items-center gap-3 px-3 py-2">
            <span
              class="w-3 h-3 rounded-full shrink-0"
              [style.background]="c.color"
              aria-hidden="true"
            ></span>
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-medium text-text-main truncate">{{ c.nombre }}</span>
              <span class="block text-xs text-text-muted">{{
                c.tipo === 'turnos'
                  ? c.primer_largo
                    ? 'Turnos'
                    : 'Turnos · falta fijar el ciclo'
                  : 'Actividades'
              }}</span>
            </span>
            @if (c.tipo === 'turnos') {
              <button
                type="button"
                (click)="ciclo.emit(c)"
                class="min-h-10 px-3 rounded-lg text-sm font-semibold text-primary-text hover:bg-background"
              >
                Ciclo
              </button>
            }
            <button
              type="button"
              (click)="eliminar.emit(c)"
              [attr.aria-label]="'Eliminar ' + c.nombre"
              class="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-background"
            >
              <svg lucideTrash2 class="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="text-sm text-text-muted">
        Aún no tienes calendarios propios. Uno de turnos calcula los días con un ciclo; uno de
        actividades guarda horarios como el colegio o las terapias.
      </p>
    }

    <form class="flex flex-col gap-3 pt-1" (submit)="enviar($event)">
      <h3 class="text-sm font-semibold text-text-main">Nuevo calendario</h3>
      <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
        Nombre
        <input
          type="text"
          [class]="campo"
          maxlength="80"
          placeholder="Ej.: Turnos mamá"
          [value]="nombre()"
          (input)="nombre.set($any($event.target).value)"
        />
      </label>
      <fieldset class="flex flex-col gap-1.5">
        <legend class="text-sm font-medium text-text-main mb-1.5">Tipo</legend>
        <div class="grid grid-cols-2 gap-2">
          @for (t of tipos; track t.valor) {
            <button
              type="button"
              [attr.aria-pressed]="tipo() === t.valor"
              (click)="tipo.set(t.valor)"
              class="min-h-14 px-3 py-2 rounded-xl border text-left"
              [class.border-primary]="tipo() === t.valor"
              [class.bg-background]="tipo() === t.valor"
              [class.border-surface-border]="tipo() !== t.valor"
            >
              <span class="block text-sm font-semibold text-text-main">{{ t.nombre }}</span>
              <span class="block text-xs text-text-muted">{{ t.detalle }}</span>
            </button>
          }
        </div>
      </fieldset>
      <fieldset>
        <legend class="text-sm font-medium text-text-main mb-1.5">Color</legend>
        <div class="flex gap-2">
          @for (c of colores; track c) {
            <button
              type="button"
              [attr.aria-pressed]="color() === c"
              [attr.aria-label]="'Color ' + ($index + 1)"
              (click)="color.set(c)"
              class="w-10 h-10 rounded-full border-2 flex items-center justify-center"
              [class.border-text-main]="color() === c"
              [class.border-transparent]="color() !== c"
            >
              <span class="w-7 h-7 rounded-full" [style.background]="c"></span>
            </button>
          }
        </div>
      </fieldset>
      <button
        type="submit"
        [disabled]="!nombre().trim() || guardando()"
        class="min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Crear calendario
      </button>
    </form>
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class CalendarioGestion {
  readonly calendarios = input.required<Calendario[]>();
  readonly guardando = input(false);
  readonly crear = output<CalendarioRequest>();
  readonly eliminar = output<Calendario>();
  readonly ciclo = output<Calendario>();

  readonly campo = CAMPO;
  readonly colores = COLORES_CALENDARIO;
  readonly tipos: { valor: TipoCalendario; nombre: string; detalle: string }[] = [
    { valor: 'turnos', nombre: 'Turnos', detalle: 'Cuarto turno con ciclo' },
    { valor: 'actividades', nombre: 'Actividades', detalle: 'Horarios y citas' },
  ];

  readonly nombre = signal('');
  readonly tipo = signal<TipoCalendario>('actividades');
  readonly color = signal(COLORES_CALENDARIO[1]);

  enviar(ev: Event) {
    ev.preventDefault();
    const nombre = this.nombre().trim();
    if (!nombre) return;
    this.crear.emit({ nombre, tipo: this.tipo(), color: this.color() });
    this.nombre.set('');
  }
}
