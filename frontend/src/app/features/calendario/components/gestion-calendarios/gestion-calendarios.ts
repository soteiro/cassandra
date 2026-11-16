import { Component, input, linkedSignal, output, signal } from '@angular/core';
import { LucidePencil, LucideTrash2 } from '@lucide/angular';
import {
  Calendario,
  CalendarioRequest,
  COLORES_CALENDARIO,
  DISPONIBILIDADES,
  DisponibilidadCalendario,
  TipoCalendario,
} from '../../data/calendario.model';
import { CalendarioSelectorColor } from '../selector-color/selector-color';
import { CalendarioSelectorDisponibilidad } from '../selector-disponibilidad/selector-disponibilidad';

const CAMPO =
  'h-11 w-full px-3 rounded-lg border border-surface-border bg-background text-text-main outline-none focus:border-primary';

export interface EditarCalendario {
  id: number;
  nombre: string;
  color: string;
  disponibilidad: DisponibilidadCalendario;
}

/**
 * Crear, editar (nombre, color y cómo cuenta para el tiempo libre) y eliminar calendarios
 * propios. Al final, el acceso al horario de trabajo que usa el asistente para planificar.
 */
@Component({
  selector: 'app-calendario-gestion',
  imports: [LucidePencil, LucideTrash2, CalendarioSelectorColor, CalendarioSelectorDisponibilidad],
  template: `
    @if (calendarios().length) {
      <ul
        class="flex flex-col divide-y divide-surface-border border border-surface-border rounded-xl"
      >
        @for (c of calendarios(); track c.id) {
          <li class="px-3 py-2">
            @if (editandoId() === c.id) {
              <form
                class="flex flex-col gap-3 py-1"
                (submit)="guardarEdicion($event, c)"
                [attr.aria-label]="'Editar ' + c.nombre"
              >
                <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
                  Nombre
                  <input
                    type="text"
                    [class]="campo"
                    maxlength="80"
                    [value]="nombreEdicion()"
                    (input)="nombreEdicion.set($any($event.target).value)"
                  />
                </label>
                <app-calendario-selector-color [(color)]="colorEdicion" />
                <app-calendario-selector-disponibilidad [(valor)]="disponibilidadEdicion" />
                <div class="flex gap-2">
                  <button
                    type="button"
                    (click)="editandoId.set(null)"
                    class="flex-1 min-h-11 rounded-lg border border-surface-border text-sm font-semibold text-text-main hover:bg-background"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    [disabled]="!nombreEdicion().trim() || guardando()"
                    class="flex-1 min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            } @else {
              <div class="flex items-center gap-2">
                <span
                  class="w-3 h-3 rounded-full shrink-0"
                  [style.background]="c.color"
                  aria-hidden="true"
                ></span>
                <span class="flex-1 min-w-0 pl-1">
                  <span class="block text-sm font-medium text-text-main truncate">{{
                    c.nombre
                  }}</span>
                  <span class="block text-xs text-text-muted">{{ detalle(c) }}</span>
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
                  (click)="editar(c)"
                  [attr.aria-label]="'Editar ' + c.nombre"
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-background"
                >
                  <svg lucidePencil class="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  (click)="eliminar.emit(c)"
                  [attr.aria-label]="'Eliminar ' + c.nombre"
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-background"
                >
                  <svg lucideTrash2 class="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="text-sm text-text-muted">
        Aún no tienes calendarios propios. Uno de turnos calcula los días con un ciclo; uno de
        actividades guarda horarios como el colegio o las terapias.
      </p>
    }

    @if (editandoId() === null) {
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
        <app-calendario-selector-color [(color)]="color" />
        <app-calendario-selector-disponibilidad [(valor)]="disponibilidad" />
        <button
          type="submit"
          [disabled]="!nombre().trim() || guardando()"
          class="min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Crear calendario
        </button>
      </form>
      <button
        type="button"
        (click)="horario.emit()"
        class="min-h-11 rounded-lg border border-dashed border-surface-border text-sm font-semibold text-text-main hover:bg-background"
      >
        Horario de trabajo…
      </button>
    }
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class CalendarioGestion {
  readonly calendarios = input.required<Calendario[]>();
  readonly guardando = input(false);
  readonly crear = output<CalendarioRequest>();
  readonly actualizar = output<EditarCalendario>();
  readonly eliminar = output<Calendario>();
  readonly ciclo = output<Calendario>();
  /** Abrir el horario base de trabajo. */
  readonly horario = output<void>();

  readonly campo = CAMPO;
  readonly tipos: { valor: TipoCalendario; nombre: string; detalle: string }[] = [
    { valor: 'turnos', nombre: 'Turnos', detalle: 'Cuarto turno con ciclo' },
    { valor: 'actividades', nombre: 'Actividades', detalle: 'Horarios y citas' },
  ];

  readonly nombre = signal('');
  readonly tipo = signal<TipoCalendario>('actividades');
  readonly color = signal(COLORES_CALENDARIO[2]);
  /** Los turnos de otra persona suelen ser solo contexto; las actividades, ocupar. */
  readonly disponibilidad = linkedSignal<DisponibilidadCalendario>(() =>
    this.tipo() === 'turnos' ? 'contexto' : 'ocupa',
  );

  /** Calendario en edición (uno a la vez); el tipo no cambia porque sus datos dependen de él. */
  readonly editandoId = signal<number | null>(null);
  readonly nombreEdicion = signal('');
  readonly colorEdicion = signal('');
  readonly disponibilidadEdicion = signal<DisponibilidadCalendario>('ocupa');

  detalle(c: Calendario): string {
    const tipo =
      c.tipo === 'turnos'
        ? c.primer_largo
          ? 'Turnos'
          : 'Turnos · falta fijar el ciclo'
        : 'Actividades';
    const disp = DISPONIBILIDADES.find((d) => d.valor === c.disponibilidad)?.nombre;
    return disp ? `${tipo} · ${disp.toLowerCase()}` : tipo;
  }

  editar(c: Calendario) {
    this.nombreEdicion.set(c.nombre);
    this.colorEdicion.set(c.color);
    this.disponibilidadEdicion.set(c.disponibilidad ?? 'ocupa');
    this.editandoId.set(c.id);
  }

  guardarEdicion(ev: Event, c: Calendario) {
    ev.preventDefault();
    const nombre = this.nombreEdicion().trim();
    if (!nombre) return;
    this.actualizar.emit({
      id: c.id,
      nombre,
      color: this.colorEdicion(),
      disponibilidad: this.disponibilidadEdicion(),
    });
    this.editandoId.set(null);
  }

  enviar(ev: Event) {
    ev.preventDefault();
    const nombre = this.nombre().trim();
    if (!nombre) return;
    this.crear.emit({
      nombre,
      tipo: this.tipo(),
      color: this.color(),
      disponibilidad: this.disponibilidad(),
    });
    this.nombre.set('');
  }
}
