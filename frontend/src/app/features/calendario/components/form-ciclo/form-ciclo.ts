import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { Calendario, CICLO_CUARTO_TURNO, TURNOS } from '../../data/calendario.model';
import { DIAS_CORTOS, diaCorto, diaSemana, numeroDia, sumarDias } from '../../utils/dias.util';
import { fondo } from '../../utils/estilo.util';

/**
 * Ciclo de cuarto turno: se fija con la fecha de un Largo. Si el ciclo cambia, se vuelve
 * aquí y se ajusta el primer Largo; el servidor recalcula desde esa fecha.
 */
@Component({
  selector: 'app-calendario-form-ciclo',
  template: `
    <p class="text-sm text-text-muted leading-5">
      Cuarto turno: Largo, Noche, Saliente y Libre, uno por día. Cassandra calcula cada día a partir
      del primer Largo.
      @if (calendario().primer_largo; as primer) {
        Ciclo vigente: primer Largo el {{ corto(primer) }}.
      }
    </p>
    <div class="grid grid-cols-4 gap-1.5">
      @for (t of patron(); track t.codigo) {
        <div class="flex flex-col gap-0.5 p-2 rounded-xl" [style.background]="t.fondo">
          <span class="text-sm font-semibold text-text-main">{{ t.nombre }}</span>
          <span class="text-xs text-text-muted">{{ t.horas }}</span>
        </div>
      }
    </div>
    <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
      Fecha del primer Largo
      <input
        type="date"
        [value]="borrador()"
        (input)="borrador.set($any($event.target).value)"
        class="h-11 px-3 rounded-lg border border-surface-border bg-background text-text-main outline-none focus:border-primary"
      />
    </label>
    @if (borrador()) {
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-medium text-text-muted">Así quedan los próximos días</span>
        <ol class="grid grid-cols-8 gap-1">
          @for (p of previa(); track p.fecha) {
            <li
              class="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[15px] font-bold text-text-main"
              [style.background]="p.fondo"
              [attr.aria-label]="p.aria"
            >
              <span class="text-[10px] font-medium text-text-muted capitalize" aria-hidden="true">{{
                p.dia
              }}</span>
              <span aria-hidden="true">{{ p.corto }}</span>
            </li>
          }
        </ol>
      </div>
      <p class="text-[13px] leading-[18px] text-text-muted">
        El ciclo nuevo rige desde el {{ corto(borrador()) }}; los días anteriores quedan como
        estaban. Los días que marcaste a mano se mantienen.
      </p>
    }
    <div class="flex gap-2">
      <button
        type="button"
        (click)="cancelar.emit()"
        class="flex-1 min-h-11 rounded-lg border border-surface-border text-sm font-semibold text-text-main hover:bg-background"
      >
        Cancelar
      </button>
      <button
        type="button"
        [disabled]="!borrador() || guardando()"
        (click)="guardar.emit(borrador())"
        class="flex-1 min-h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Guardar ciclo
      </button>
    </div>
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class CalendarioFormCiclo {
  readonly calendario = input.required<Calendario>();
  readonly sugerido = input.required<string>();
  readonly guardando = input(false);
  readonly guardar = output<string>();
  readonly cancelar = output<void>();

  readonly borrador = linkedSignal(() => this.calendario().primer_largo ?? this.sugerido());

  readonly patron = computed(() =>
    CICLO_CUARTO_TURNO.map((codigo) => ({
      codigo,
      nombre: TURNOS[codigo].nombre,
      horas: codigo === 'L' ? '08–20' : codigo === 'N' ? '20–08' : 'libre',
      fondo: this.fondoDe(codigo),
    })),
  );

  readonly previa = computed(() => {
    const inicio = this.borrador();
    if (!inicio) return [];
    return Array.from({ length: 8 }, (_, i) => {
      const fecha = sumarDias(inicio, i);
      const codigo = CICLO_CUARTO_TURNO[i % 4];
      return {
        fecha,
        dia: `${DIAS_CORTOS[diaSemana(fecha)].slice(0, 2)} ${numeroDia(fecha)}`,
        corto: TURNOS[codigo].corto,
        fondo: this.fondoDe(codigo),
        aria: `${diaCorto(fecha)}: ${TURNOS[codigo].nombre}`,
      };
    });
  });

  corto(fecha: string): string {
    return diaCorto(fecha);
  }

  private fondoDe(codigo: string): string {
    const color = this.calendario().color;
    if (codigo === 'L') return fondo(color, 30);
    if (codigo === 'N') return fondo(color, 60);
    return 'var(--theme-background)';
  }
}
