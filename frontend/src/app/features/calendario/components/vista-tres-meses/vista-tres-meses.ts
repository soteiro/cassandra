import { Component, computed, input, output } from '@angular/core';
import { CalendarioRango, TURNOS } from '../../data/calendario.model';
import { DiaInfo, diaVacio, Visibilidad } from '../../utils/modelo.util';
import {
  diaCorto,
  mesDe,
  nombreMes,
  numeroDia,
  semanasDelMes,
  sumarMeses,
} from '../../utils/dias.util';
import { COLOR_DEADLINE, COLOR_VENCIDO, fondo } from '../../utils/estilo.util';

/** Tres meses de un vistazo: cuándo trabaja y qué vence. */
@Component({
  selector: 'app-calendario-tres-meses',
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      @for (m of meses(); track m.inicio) {
        <section class="flex flex-col gap-1.5 min-w-0">
          <h2 class="text-sm font-semibold text-text-main">{{ m.titulo }}</h2>
          <div class="grid grid-cols-7 gap-0.5">
            @for (c of m.celdas; track c.fecha) {
              @if (c.enMes) {
                <button
                  type="button"
                  (click)="abrirDia.emit(c.fecha)"
                  [attr.aria-label]="c.aria"
                  class="h-8 md:h-9 rounded-md flex flex-col items-center justify-center gap-0.5 text-xs text-text-main"
                  [class.font-bold]="c.hoy"
                  [class.ring-2]="c.hoy"
                  [class.ring-inset]="c.hoy"
                  [class.ring-text-main]="c.hoy"
                  [style.background]="c.fondo"
                  [style.outline]="c.contorno"
                  style="outline-offset: -3px"
                >
                  <span>{{ c.numero }}</span>
                  <span [style]="c.marca" aria-hidden="true"></span>
                </button>
              } @else {
                <span class="h-8 md:h-9" aria-hidden="true"></span>
              }
            }
          </div>
        </section>
      }
    </div>
    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-muted" aria-label="Leyenda">
      @for (t of leyendaTurnos(); track t.clave) {
        <li class="inline-flex items-center gap-1.5">
          <span class="w-3.5 h-3.5 rounded" [style.background]="t.fondo" aria-hidden="true"></span>
          {{ t.texto }}
        </li>
      }
      <li class="inline-flex items-center gap-1.5">
        <span class="w-[5px] h-[5px] rounded-full bg-warning" aria-hidden="true"></span>Vence
      </li>
      <li class="inline-flex items-center gap-1.5">
        <span class="w-3 h-0.5 rounded bg-warning/60" aria-hidden="true"></span>Deadline en curso
      </li>
    </ul>
  `,
})
export class CalendarioVistaTresMeses {
  readonly rango = input.required<CalendarioRango>();
  readonly dias = input.required<Map<string, DiaInfo>>();
  readonly visibles = input.required<Visibilidad>();
  readonly cursor = input.required<string>();
  readonly hoy = input.required<string>();
  readonly abrirDia = output<string>();

  /** Solo el primer calendario de turnos visible pinta el fondo de los días. */
  private readonly turnos = computed(() =>
    this.rango().calendarios.find(
      (c) => c.tipo === 'turnos' && this.visibles().calendarios.has(c.id),
    ),
  );

  readonly leyendaTurnos = computed(() => {
    const cal = this.turnos();
    if (!cal) return [];
    return [
      { clave: 'L', texto: `${cal.nombre}: Largo`, fondo: fondo(cal.color, 30) },
      { clave: 'N', texto: 'Noche', fondo: fondo(cal.color, 60) },
    ];
  });

  readonly meses = computed(() => {
    const cal = this.turnos();
    return [0, 1, 2].map((k) => {
      const inicio = sumarMeses(this.cursor(), k);
      const mes = mesDe(inicio);
      return {
        inicio,
        titulo: nombreMes(inicio),
        celdas: semanasDelMes(inicio)
          .flat()
          .map((fecha) => {
            const info = this.dias().get(fecha) ?? diaVacio(fecha);
            const turno = cal && info.turnos.find((t) => t.calendario.id === cal.id)?.turno;
            const vence = info.deadlines.filter((d) => d.momento === 'vence');
            const vencido = vence.some((d) => d.vencido);
            const enCurso = info.deadlines.some((d) => d.momento === 'curso');
            const partes = [diaCorto(fecha)];
            if (turno) partes.push(`${cal!.nombre}: ${TURNOS[turno.codigo].nombre}`);
            if (vence.length) partes.push(`${vence.length} vence`);
            return {
              fecha,
              enMes: mesDe(fecha) === mes,
              numero: numeroDia(fecha),
              hoy: fecha === this.hoy(),
              aria: partes.join(', ') + '. Abrir el día',
              fondo:
                cal && turno && (turno.codigo === 'L' || turno.codigo === 'N')
                  ? fondo(cal.color, turno.codigo === 'N' ? 60 : 30)
                  : 'transparent',
              contorno:
                cal && turno && (turno.codigo === 'V' || turno.codigo === 'M')
                  ? `1px dashed ${cal.color}`
                  : 'none',
              marca: vence.length
                ? `width:5px;height:5px;border-radius:999px;background:${vencido ? COLOR_VENCIDO : COLOR_DEADLINE}`
                : enCurso
                  ? `width:60%;height:2px;border-radius:1px;background:${fondo(COLOR_DEADLINE, 70)}`
                  : 'width:5px;height:5px',
            };
          }),
      };
    });
  });
}
