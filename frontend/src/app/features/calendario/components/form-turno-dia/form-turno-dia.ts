import { Component, computed, input, output } from '@angular/core';
import { Calendario, CodigoTurno, TURNOS, TurnoDia } from '../../data/calendario.model';
import { fondo } from '../../utils/estilo.util';

const OPCIONES: CodigoTurno[] = ['L', 'N', 'S', 'F', 'V', 'M'];

/** Cambia el turno de un solo día (cambio de turno, vacaciones, licencia). */
@Component({
  selector: 'app-calendario-form-turno-dia',
  template: `
    <p class="text-sm text-text-muted">{{ base() }}</p>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2" role="group" aria-label="Turno de este día">
      @for (o of opciones(); track o.codigo) {
        <button
          type="button"
          [attr.aria-pressed]="o.elegido"
          [disabled]="guardando()"
          (click)="elegir.emit(o.codigo)"
          class="min-h-14 flex flex-col items-start justify-center gap-0.5 px-3 py-2 rounded-xl border text-left"
          [style.border-color]="o.elegido ? calendario().color : 'var(--theme-surface-border)'"
          [style.background]="o.elegido ? tinte() : 'transparent'"
        >
          <span class="text-[15px] font-semibold text-text-main">{{ o.nombre }}</span>
          <span class="text-xs text-text-muted">{{ o.horas }}</span>
        </button>
      }
    </div>
    @if (turno()?.cambio) {
      <button
        type="button"
        [disabled]="guardando()"
        (click)="volver.emit()"
        class="min-h-11 rounded-lg border border-surface-border text-sm font-semibold text-text-main hover:bg-background"
      >
        Volver a lo que dice el ciclo
      </button>
    }
    <button
      type="button"
      (click)="ajustarCiclo.emit()"
      class="min-h-11 text-left text-sm font-semibold text-primary-text hover:underline"
    >
      ¿Cambió el ciclo completo? Ajustar el primer Largo
    </button>
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class CalendarioFormTurnoDia {
  readonly calendario = input.required<Calendario>();
  readonly turno = input.required<TurnoDia | undefined>();
  readonly guardando = input(false);
  readonly elegir = output<CodigoTurno>();
  readonly volver = output<void>();
  readonly ajustarCiclo = output<void>();

  readonly tinte = computed(() => fondo(this.calendario().color, 22));

  readonly base = computed(() => {
    const t = this.turno();
    if (!t?.base) return 'Este día no tiene ciclo: fija el primer Largo para calcularlo.';
    const b = TURNOS[t.base];
    const texto = `Según el ciclo: ${b.nombre}${b.trabaja ? ` (${b.horas})` : ''}.`;
    return t.cambio ? `${texto} Marcado como ${TURNOS[t.codigo].nombre}.` : texto;
  });

  readonly opciones = computed(() =>
    OPCIONES.map((codigo) => ({
      codigo,
      nombre: TURNOS[codigo].nombre,
      horas: TURNOS[codigo].horas,
      elegido: this.turno()?.codigo === codigo,
    })),
  );
}
