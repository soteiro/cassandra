import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { Actividad, ActividadRequest, Calendario } from '../../data/calendario.model';
import { DIAS_CORTOS, diaSemana, horaANumero } from '../../utils/dias.util';
import { ActividadDia } from '../../utils/modelo.util';

export interface GuardarActividad {
  calendarioId: number;
  id?: number;
  req: ActividadRequest;
}

const CAMPO =
  'h-11 w-full min-w-0 px-3 rounded-lg border border-surface-border bg-background text-text-main outline-none focus:border-primary';

/** Crea o edita una actividad de un día o semanal, y avisa si choca con otra. */
@Component({
  selector: 'app-calendario-form-actividad',
  template: `
    <form class="flex flex-col gap-4" (submit)="enviar($event)">
      <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
        Calendario
        <select
          [class]="campo"
          [disabled]="!!actividad()"
          (change)="calendarioId.set(+$any($event.target).value)"
        >
          @for (c of calendarios(); track c.id) {
            <option [value]="c.id" [selected]="c.id === calendarioId()">{{ c.nombre }}</option>
          }
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
        Título
        <input
          type="text"
          [class]="campo"
          maxlength="200"
          placeholder="Ej.: control dental"
          [value]="titulo()"
          (input)="titulo.set($any($event.target).value)"
        />
      </label>
      <div class="grid grid-cols-3 gap-2">
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main min-w-0">
          {{ semanal() ? 'Desde' : 'Fecha' }}
          <input
            type="date"
            [class]="campo"
            [value]="fecha()"
            (input)="fecha.set($any($event.target).value)"
          />
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main min-w-0">
          Inicio
          <input
            type="time"
            [class]="campo"
            [value]="horaInicio()"
            (input)="horaInicio.set($any($event.target).value)"
          />
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main min-w-0">
          Término
          <input
            type="time"
            [class]="campo"
            [value]="horaFin()"
            (input)="horaFin.set($any($event.target).value)"
          />
        </label>
      </div>
      <label class="flex items-center gap-2.5 min-h-11 text-sm font-medium text-text-main">
        <input
          type="checkbox"
          class="w-5 h-5 accent-primary"
          [checked]="semanal()"
          (change)="alternarSemanal($any($event.target).checked)"
        />
        Se repite cada semana
      </label>
      @if (semanal()) {
        <fieldset class="flex flex-col gap-1.5">
          <legend class="text-sm font-medium text-text-main mb-1.5">Días</legend>
          <div class="grid grid-cols-7 gap-1">
            @for (d of diasSemana; track d.i) {
              <button
                type="button"
                [attr.aria-pressed]="dias().includes(d.i)"
                [attr.aria-label]="d.nombre"
                (click)="alternarDia(d.i)"
                class="h-11 rounded-lg border text-sm font-semibold capitalize"
                [class.bg-primary]="dias().includes(d.i)"
                [class.text-on-primary]="dias().includes(d.i)"
                [class.border-primary]="dias().includes(d.i)"
                [class.border-surface-border]="!dias().includes(d.i)"
                [class.text-text-main]="!dias().includes(d.i)"
              >
                {{ d.corto }}
              </button>
            }
          </div>
        </fieldset>
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
          Hasta (opcional)
          <input
            type="date"
            [class]="campo"
            [min]="fecha()"
            [value]="hasta()"
            (input)="hasta.set($any($event.target).value)"
          />
        </label>
      }
      @if (choque()) {
        <p
          class="px-3 py-2 rounded-lg border border-danger/40 bg-danger/10 text-[13px] leading-[18px] text-danger"
          role="status"
        >
          {{ choque() }}
        </p>
      }
      @if (error()) {
        <p class="text-[13px] text-danger" role="alert">{{ error() }}</p>
      }
      <p class="text-xs text-text-muted"
        >Los deadlines salen de tus tareas y proyectos; aquí no se crean.</p
      >
      <div class="flex gap-2">
        <button
          type="button"
          (click)="cancelar.emit()"
          class="flex-1 min-h-11 rounded-lg border border-surface-border text-sm font-semibold text-text-main hover:bg-background"
        >
          Cancelar
        </button>
        <button
          type="submit"
          [disabled]="guardando()"
          class="flex-1 min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </form>
  `,
})
export class CalendarioFormActividad {
  readonly calendarios = input.required<Calendario[]>();
  readonly actividad = input<Actividad | null>(null);
  readonly fechaInicial = input.required<string>();
  /** Actividades ya agendadas en una fecha (para avisar choques). */
  readonly ocupado = input.required<(fecha: string) => ActividadDia[]>();
  readonly guardando = input(false);
  readonly guardar = output<GuardarActividad>();
  readonly cancelar = output<void>();

  readonly campo = CAMPO;
  readonly diasSemana = DIAS_CORTOS.map((nombre, i) => ({ i, nombre, corto: nombre.charAt(0) }));

  readonly calendarioId = linkedSignal(
    () => this.actividad()?.calendario_id ?? this.calendarios()[0]?.id ?? 0,
  );
  readonly titulo = linkedSignal(() => this.actividad()?.titulo ?? '');
  readonly fecha = linkedSignal(() => this.actividad()?.fecha ?? this.fechaInicial());
  readonly horaInicio = linkedSignal(() => this.actividad()?.hora_inicio ?? '10:00');
  readonly horaFin = linkedSignal(() => this.actividad()?.hora_fin ?? '11:00');
  readonly dias = linkedSignal(() => this.actividad()?.dias_semana ?? []);
  readonly semanal = linkedSignal(() => (this.actividad()?.dias_semana.length ?? 0) > 0);
  readonly hasta = linkedSignal(() => this.actividad()?.hasta ?? '');
  readonly error = signal('');

  readonly choque = computed(() => {
    const f = this.fecha();
    const a = this.horaInicio();
    const b = this.horaFin();
    if (!f || !a || !b || b <= a) return '';
    const ini = horaANumero(a);
    const fin = horaANumero(b);
    const propia = this.actividad()?.id;
    const con = this.ocupado()(f).filter(
      (o) =>
        o.actividad_id !== propia &&
        !o.cancelada &&
        horaANumero(o.hora_inicio) < fin &&
        ini < horaANumero(o.hora_fin),
    );
    if (!con.length) return '';
    const lista = con.map((o) => `${o.titulo} (${o.hora_inicio}–${o.hora_fin})`).join(' y ');
    return `El ${f.slice(8)} choca con ${lista}. Puedes guardarla igual.`;
  });

  alternarSemanal(semanal: boolean) {
    this.semanal.set(semanal);
    if (semanal && !this.dias().length && this.fecha()) this.dias.set([diaSemana(this.fecha())]);
  }

  alternarDia(i: number) {
    this.dias.update((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));
  }

  enviar(ev: Event) {
    ev.preventDefault();
    const titulo = this.titulo().trim();
    if (!titulo) return this.error.set('Escribe un título.');
    if (!this.fecha()) return this.error.set('Elige la fecha.');
    if (!this.horaInicio() || !this.horaFin() || this.horaFin() <= this.horaInicio())
      return this.error.set('La hora de término debe ser posterior a la de inicio.');
    if (this.semanal() && !this.dias().length) return this.error.set('Elige al menos un día.');
    this.error.set('');
    this.guardar.emit({
      calendarioId: this.calendarioId(),
      id: this.actividad()?.id,
      req: {
        titulo,
        fecha: this.fecha(),
        hora_inicio: this.horaInicio(),
        hora_fin: this.horaFin(),
        dias_semana: this.semanal() ? this.dias() : [],
        hasta: this.semanal() && this.hasta() ? this.hasta() : null,
      },
    });
  }
}
