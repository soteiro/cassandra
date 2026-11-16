import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { LucidePlus, LucideX } from '@lucide/angular';
import { FranjaHorario } from '../../data/calendario.model';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAMPO =
  'h-10 min-w-0 flex-1 px-2 rounded-lg border border-surface-border bg-background text-sm text-text-main outline-none focus:border-primary';

interface FranjaEdicion {
  inicio: string;
  fin: string;
}

/**
 * Horario base: cuándo se puede trabajar cada día. El asistente parte de aquí, suma lo que
 * liberan los calendarios (el colegio) y resta lo que ocupan, para encontrar huecos.
 */
@Component({
  selector: 'app-calendario-horario-base',
  imports: [LucidePlus, LucideX],
  template: `
    <p class="text-sm text-text-muted">
      Las horas en que puedes trabajar. El asistente planifica tareas en estas franjas, más lo que
      liberan tus calendarios y menos lo que te ocupa.
    </p>
    <form class="flex flex-col gap-3" (submit)="enviar($event)">
      <ul
        class="flex flex-col divide-y divide-surface-border border border-surface-border rounded-xl"
      >
        @for (dia of nombres; track $index; let d = $index) {
          <li class="px-3 py-2 flex flex-col gap-2" [attr.aria-label]="dia">
            <div class="flex items-center gap-2">
              <span class="flex-1 text-sm font-medium text-text-main">{{ dia }}</span>
              @if (!dias()[d].length) {
                <span class="text-xs text-text-muted">No trabajo</span>
              }
              <button
                type="button"
                (click)="agregar(d)"
                [attr.aria-label]="'Agregar franja el ' + dia.toLowerCase()"
                class="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-background"
              >
                <svg lucidePlus class="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            @for (f of dias()[d]; track $index; let i = $index) {
              <div class="flex items-center gap-2">
                <input
                  type="time"
                  [class]="campo"
                  [value]="f.inicio"
                  [attr.aria-label]="dia + ', desde'"
                  (input)="cambiar(d, i, 'inicio', $any($event.target).value)"
                />
                <span class="text-text-muted text-sm" aria-hidden="true">–</span>
                <input
                  type="time"
                  [class]="campo"
                  [value]="f.fin"
                  [attr.aria-label]="dia + ', hasta'"
                  (input)="cambiar(d, i, 'fin', $any($event.target).value)"
                />
                <button
                  type="button"
                  (click)="quitar(d, i)"
                  [attr.aria-label]="'Quitar franja del ' + dia.toLowerCase()"
                  class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-background"
                >
                  <svg lucideX class="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            }
          </li>
        }
      </ul>
      @if (dias()[0].length) {
        <button
          type="button"
          (click)="copiarLunes()"
          class="min-h-10 rounded-lg text-sm font-semibold text-primary-text hover:bg-background"
        >
          Usar el horario del lunes de martes a viernes
        </button>
      }
      @if (error()) {
        <p class="text-sm font-semibold text-danger" role="alert">{{ error() }}</p>
      }
      <button
        type="submit"
        [disabled]="!!error() || guardando()"
        class="min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Guardar horario
      </button>
    </form>
  `,
  host: { class: 'flex flex-col gap-3' },
})
export class CalendarioHorarioBase {
  readonly franjas = input.required<FranjaHorario[]>();
  readonly guardando = input(false);
  readonly guardar = output<FranjaHorario[]>();

  readonly nombres = DIAS;
  readonly campo = CAMPO;

  /** Franjas por día (0 = lunes), editables. */
  readonly dias = linkedSignal<FranjaEdicion[][]>(() => {
    const dias: FranjaEdicion[][] = DIAS.map(() => []);
    for (const f of this.franjas()) {
      dias[f.dia_semana]?.push({
        inicio: f.hora_inicio,
        fin: f.hora_fin === '24:00' ? '23:59' : f.hora_fin,
      });
    }
    return dias;
  });

  readonly error = computed(() => {
    for (const [d, franjas] of this.dias().entries()) {
      const orden = [...franjas].sort((a, b) => a.inicio.localeCompare(b.inicio));
      for (const [i, f] of orden.entries()) {
        if (!f.inicio || !f.fin) return `Completa las horas del ${DIAS[d].toLowerCase()}.`;
        if (f.fin <= f.inicio)
          return `El ${DIAS[d].toLowerCase()}, cada franja debe terminar después de empezar.`;
        if (i > 0 && f.inicio < orden[i - 1].fin)
          return `El ${DIAS[d].toLowerCase()} tiene franjas que se solapan.`;
      }
    }
    return '';
  });

  private editar(d: number, cambio: (franjas: FranjaEdicion[]) => FranjaEdicion[]) {
    this.dias.update((dias) => dias.map((f, i) => (i === d ? cambio(f) : f)));
  }

  agregar(d: number) {
    this.editar(d, (f) => {
      const ultima = f.at(-1)?.fin;
      return [
        ...f,
        ultima && ultima < '22:00'
          ? { inicio: ultima, fin: '23:00' }
          : { inicio: '09:00', fin: '13:00' },
      ];
    });
  }

  quitar(d: number, i: number) {
    this.editar(d, (f) => f.filter((_, j) => j !== i));
  }

  cambiar(d: number, i: number, campo: keyof FranjaEdicion, valor: string) {
    this.editar(d, (f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  }

  copiarLunes() {
    const lunes = this.dias()[0];
    this.dias.update((dias) =>
      dias.map((f, d) => (d >= 1 && d <= 4 ? lunes.map((x) => ({ ...x })) : f)),
    );
  }

  enviar(ev: Event) {
    ev.preventDefault();
    if (this.error()) return;
    this.guardar.emit(
      this.dias().flatMap((franjas, d) =>
        franjas.map((f) => ({
          dia_semana: d,
          hora_inicio: f.inicio,
          hora_fin: f.fin === '23:59' ? '24:00' : f.fin,
        })),
      ),
    );
  }
}
