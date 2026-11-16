import { Component, computed, input, output } from '@angular/core';
import { Deadline, TURNOS } from '../../data/calendario.model';
import { ActividadDia, DiaInfo, TurnoVista } from '../../utils/modelo.util';
import { COLOR_DEADLINE, COLOR_VENCIDO, fondo } from '../../utils/estilo.util';
import { diaCorto, diaLargo } from '../../utils/dias.util';

/** Lista de un día: turnos, deadlines y actividades, con los choques marcados. */
@Component({
  selector: 'app-calendario-agenda',
  template: `
    <section class="flex flex-col gap-3" [attr.aria-label]="'Agenda del ' + titulo()">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h2 class="text-base font-semibold text-text-main">
          {{ titulo() }}
          @if (esHoy()) {
            <span class="text-text-muted font-normal"> · hoy</span>
          }
        </h2>
        @if (mostrarTurnos()) {
          <div class="flex flex-wrap gap-1.5">
            @for (t of info().turnos; track t.calendario.id) {
              <button
                type="button"
                (click)="abrirTurno.emit(t)"
                class="min-h-9 px-3 rounded-full text-[13px] font-semibold border"
                [class.border-dashed]="t.turno.cambio"
                [style.border-color]="t.calendario.color"
                [style.background]="trabaja(t) ? tinte(t.calendario.color) : 'transparent'"
                [attr.aria-label]="
                  'Turno de ' + t.calendario.nombre + ': ' + textoTurno(t) + '. Cambiar'
                "
              >
                {{ t.calendario.nombre }} · {{ textoTurno(t) }}
              </button>
            }
          </div>
        }
      </div>

      @if (libre()) {
        <p class="text-xs text-text-muted">
          <span class="font-semibold text-success">Para trabajar:</span> {{ libre() }}
        </p>
      }

      <ul class="flex flex-col gap-2.5">
        @for (d of info().deadlines; track d.deadline.tipo + d.deadline.id) {
          <li>
            <button
              type="button"
              (click)="abrirDeadline.emit(d.deadline)"
              class="w-full flex gap-2.5 items-start text-left rounded-lg hover:bg-surface/70 -mx-1 px-1 py-0.5"
            >
              <span class="w-11 shrink-0 text-xs leading-5 text-text-muted">{{
                d.momento === 'vence' ? 'vence' : ''
              }}</span>
              <span class="h-5 flex items-center shrink-0" aria-hidden="true">
                <span
                  class="w-2 h-2"
                  [class.rotate-45]="d.deadline.tipo === 'proyecto'"
                  [class.rounded-xs]="d.deadline.tipo !== 'proyecto'"
                  [class.opacity-50]="d.momento === 'curso'"
                  [style.background]="d.vencido ? colorVencido : colorDeadline"
                ></span>
              </span>
              <span class="flex-1 min-w-0">
                <span
                  class="block text-[15px] leading-5"
                  [class.text-danger]="d.vencido"
                  [class.font-medium]="d.momento === 'vence'"
                  [class.text-text-main]="!d.vencido && d.momento === 'vence'"
                  [class.text-text-muted]="d.momento === 'curso'"
                  >{{ d.deadline.titulo }}</span
                >
                <span class="block text-xs leading-4 text-text-muted">{{ subDeadline(d) }}</span>
              </span>
            </button>
          </li>
        }
        @for (a of actividades(); track a.clave) {
          <li>
            <button
              type="button"
              (click)="abrirActividad.emit(a)"
              class="w-full flex gap-2.5 items-start text-left rounded-lg hover:bg-surface/70 -mx-1 px-1 py-0.5"
            >
              <span class="w-11 shrink-0 text-xs leading-5 text-text-muted tabular-nums">{{
                a.hora_inicio
              }}</span>
              <span class="h-5 flex items-center shrink-0" aria-hidden="true">
                <span class="w-2 h-2 rounded-full" [style.background]="a.color"></span>
              </span>
              <span class="flex-1 min-w-0">
                <span
                  class="block text-[15px] leading-5 font-medium"
                  [class.line-through]="a.cancelada"
                  [class.text-text-muted]="a.cancelada"
                  [class.text-text-main]="!a.cancelada"
                  >{{ a.titulo }}</span
                >
                <span class="block text-xs leading-4 text-text-muted">
                  {{ a.calendario }} · {{ a.horas
                  }}{{ a.parte === 'sigue' ? ' · termina al día siguiente' : ''
                  }}{{ a.cancelada ? ' · no ocurre este día' : a.semanal ? ' · cada semana' : '' }}
                </span>
                @if (a.choques.length && !a.cancelada) {
                  <span class="block text-xs leading-4 font-semibold text-danger">
                    Choca con {{ a.choques.join(' y ') }}
                  </span>
                }
              </span>
            </button>
          </li>
        }
      </ul>
      @if (vacio()) {
        <p class="text-sm text-text-muted">Nada para este día.</p>
      }
    </section>
  `,
})
export class CalendarioAgenda {
  readonly info = input.required<DiaInfo>();
  readonly hoy = input.required<string>();
  readonly mostrarTurnos = input(true);
  readonly abrirTurno = output<TurnoVista>();
  readonly abrirActividad = output<ActividadDia>();
  readonly abrirDeadline = output<Deadline>();

  readonly colorDeadline = COLOR_DEADLINE;
  readonly colorVencido = COLOR_VENCIDO;

  readonly titulo = computed(() => diaLargo(this.info().fecha));
  readonly esHoy = computed(() => this.info().fecha === this.hoy());
  /** La madrugada de algo que empezó el día anterior ya aparece en ese día. */
  readonly actividades = computed(() => this.info().actividades.filter((a) => a.parte !== 'viene'));
  readonly libre = computed(() =>
    this.info()
      .libre.map((l) => l.horas)
      .join(' · '),
  );
  readonly vacio = computed(() => !this.info().deadlines.length && !this.actividades().length);

  trabaja(t: TurnoVista): boolean {
    return TURNOS[t.turno.codigo].trabaja;
  }

  tinte(color: string): string {
    return fondo(color, 22);
  }

  textoTurno(t: TurnoVista): string {
    const info = TURNOS[t.turno.codigo];
    return `${info.nombre}${info.trabaja ? ' ' + info.horas : ''}${t.turno.cambio ? ' · cambio' : ''}`;
  }

  subDeadline(d: { deadline: Deadline; momento: 'vence' | 'curso'; vencido: boolean }): string {
    const tipo =
      d.deadline.tipo === 'proyecto' ? 'Proyecto' : `Tarea · ${d.deadline.proyecto_nombre}`;
    if (d.momento === 'curso') return `En curso · vence el ${diaCorto(d.deadline.fecha_limite)}`;
    return d.vencido ? `Vencido · ${tipo}` : tipo;
  }
}
