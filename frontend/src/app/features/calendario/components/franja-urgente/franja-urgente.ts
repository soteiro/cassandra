import { Component, computed, input, output, signal } from '@angular/core';
import { LucideChevronDown, LucideChevronUp, LucideCircleAlert } from '@lucide/angular';
import { ResumenFranja } from '../../utils/modelo.util';
import { relativo } from '../../utils/dias.util';

interface FilaFranja {
  clave: string;
  titulo: string;
  cuando: string;
  fecha: string;
  tipo: 'vencido' | 'proximo' | 'choque';
  proyecto: boolean;
}

/** Lo urgente en una línea plegable: vencidos, lo que vence en 7 días y los choques. */
@Component({
  selector: 'app-calendario-franja',
  imports: [LucideCircleAlert, LucideChevronDown, LucideChevronUp],
  template: `
    @if (filas().length) {
      <div class="rounded-xl border border-surface-border bg-surface overflow-hidden">
        <button
          type="button"
          [attr.aria-expanded]="abierta()"
          aria-controls="calendario-franja-lista"
          (click)="abierta.set(!abierta())"
          class="w-full min-h-10 md:min-h-11 flex items-center gap-2.5 px-3 md:px-3.5 text-left text-[13px] md:text-sm font-medium text-text-main"
        >
          <svg
            lucideCircleAlert
            class="w-[18px] h-[18px] shrink-0 text-danger"
            aria-hidden="true"
          />
          <span class="flex-1">{{ texto() }}</span>
          @if (abierta()) {
            <svg lucideChevronUp class="w-[18px] h-[18px] text-text-muted" aria-hidden="true" />
          } @else {
            <svg lucideChevronDown class="w-[18px] h-[18px] text-text-muted" aria-hidden="true" />
          }
        </button>
        @if (abierta()) {
          <ul id="calendario-franja-lista" class="border-t border-surface-border py-1">
            @for (f of filas(); track f.clave) {
              <li>
                <button
                  type="button"
                  (click)="abrirDia.emit(f.fecha)"
                  class="w-full min-h-10 flex items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-background/60"
                >
                  @if (f.tipo === 'choque') {
                    <span
                      class="w-2.5 h-2.5 rounded-full border-[1.5px] border-danger shrink-0"
                      aria-hidden="true"
                    ></span>
                  } @else {
                    <span
                      class="w-2 h-2 shrink-0"
                      [class.rotate-45]="f.proyecto"
                      [class.rounded-xs]="!f.proyecto"
                      [class.bg-danger]="f.tipo === 'vencido'"
                      [class.bg-warning]="f.tipo === 'proximo'"
                      aria-hidden="true"
                    ></span>
                  }
                  <span class="flex-1 min-w-0 text-sm text-text-main truncate">
                    @if (f.tipo === 'choque') {
                      <span class="sr-only">Choque de horario: </span>
                    }
                    {{ f.titulo }}
                  </span>
                  <span
                    class="text-xs font-semibold whitespace-nowrap"
                    [class.text-danger]="f.tipo === 'vencido'"
                    [class.text-text-muted]="f.tipo !== 'vencido'"
                    >{{ f.cuando }}</span
                  >
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class CalendarioFranja {
  readonly resumen = input.required<ResumenFranja>();
  readonly hoy = input.required<string>();
  /** Se abre sola en pantallas grandes, donde hay espacio. */
  readonly abierta = signal(false);
  readonly abrirDia = output<string>();

  readonly texto = computed(() => {
    const r = this.resumen();
    const partes = [];
    const n = (cuantos: number, uno: string, varios: string) =>
      `${cuantos} ${cuantos === 1 ? uno : varios}`;
    if (r.vencidos.length) partes.push(n(r.vencidos.length, 'vencido', 'vencidos'));
    if (r.proximos.length) partes.push(n(r.proximos.length, 'vence en 7 días', 'vencen en 7 días'));
    if (r.choques.length)
      partes.push(`${r.choques.length} ${r.choques.length === 1 ? 'choque' : 'choques'}`);
    return partes.join(' · ');
  });

  readonly filas = computed<FilaFranja[]>(() => {
    const r = this.resumen();
    const hoy = this.hoy();
    return [
      ...r.vencidos.map((d) => ({
        clave: `v-${d.tipo}-${d.id}`,
        titulo: d.titulo,
        cuando: relativo(d.fecha_limite, hoy),
        fecha: d.fecha_limite,
        tipo: 'vencido' as const,
        proyecto: d.tipo === 'proyecto',
      })),
      ...r.proximos.map((d) => ({
        clave: `p-${d.tipo}-${d.id}`,
        titulo: d.titulo,
        cuando: relativo(d.fecha_limite, hoy),
        fecha: d.fecha_limite,
        tipo: 'proximo' as const,
        proyecto: d.tipo === 'proyecto',
      })),
      ...r.choques.map((c, i) => ({
        clave: `c-${i}`,
        titulo: c.titulo,
        cuando: relativo(c.fecha, hoy),
        fecha: c.fecha,
        tipo: 'choque' as const,
        proyecto: false,
      })),
    ];
  });
}
