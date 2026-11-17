import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Calendario } from '../../data/calendario.model';
import { DiaInfo, diaVacio } from '../../utils/modelo.util';
import { COLOR_LIBRE_TRABAJO, fondo, textoTono } from '../../utils/estilo.util';
import {
  Bloque,
  bloquesDelDia,
  estiloBloque,
  HORAS_DIA,
  marcaAhora,
  tramosTurno,
} from '../../utils/timeline.util';

/** Un día por hora: el turno como barra al costado y las actividades montadas si se solapan. */
@Component({
  selector: 'app-calendario-dia',
  template: `
    <div
      #scroll
      class="h-[440px] md:h-[640px] overflow-y-auto border border-surface-border rounded-xl bg-background [--h:34px] [--ind:44px] md:[--h:40px] md:[--ind:64px]"
    >
      <div class="relative h-[calc(var(--h)*24)]">
        @for (h of horas; track h.h) {
          <div
            class="absolute inset-x-0 h-(--h) border-t border-surface-border/50"
            [style.top]="'calc(var(--h) * ' + h.h + ')'"
          >
            <span class="block pl-2 pt-0.5 text-[11px] text-text-muted tabular-nums">{{
              h.etiqueta
            }}</span>
          </div>
        }
        @for (l of libre(); track l.desde) {
          <div
            class="absolute right-0 rounded-md pointer-events-none"
            [style]="l.estilo"
            role="img"
            [attr.aria-label]="'Para trabajar: ' + l.horas"
          >
            <span
              class="block px-1.5 pt-0.5 text-[10px] font-semibold text-success"
              aria-hidden="true"
              >Para trabajar · {{ l.horas }}</span
            >
          </div>
        }
        @for (t of tramos(); track t.clave) {
          <div
            class="absolute w-6 rounded-md box-border flex items-center justify-center overflow-hidden"
            [style]="t.estilo"
            role="img"
            [attr.aria-label]="t.aria"
          >
            <span
              class="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold whitespace-nowrap"
              [style.color]="t.colorTexto"
              aria-hidden="true"
              >{{ t.etiqueta }}</span
            >
          </div>
        }
        @for (b of bloques(); track b.clave) {
          <button
            type="button"
            (click)="tocarBloque.emit(b)"
            [attr.aria-label]="b.aria"
            class="absolute right-2 flex flex-col items-stretch gap-px min-w-0 overflow-hidden text-left rounded-lg px-2 py-0.5 text-text-main"
            [style]="estilo(b)"
          >
            @if (b.corto) {
              <span class="block text-[12px] leading-4 truncate">
                <span class="font-semibold" [class.line-through]="b.actividad.cancelada">{{
                  b.actividad.titulo
                }}</span>
                <span
                  [class.text-danger]="b.actividad.choques.length && !b.actividad.cancelada"
                  [class.text-text-muted]="!b.actividad.choques.length || b.actividad.cancelada"
                >
                  · {{ b.actividad.horas
                  }}{{
                    b.actividad.choques.length && !b.actividad.cancelada ? ' · choque' : ''
                  }}</span
                >
              </span>
            } @else {
              <span
                class="block text-[13px] leading-4 font-semibold truncate"
                [class.line-through]="b.actividad.cancelada"
                >{{ b.actividad.titulo }}</span
              >
              <span
                class="block text-[11px] leading-[14px] truncate"
                [class.text-danger]="b.actividad.choques.length && !b.actividad.cancelada"
                [class.text-text-muted]="!b.actividad.choques.length || b.actividad.cancelada"
              >
                {{ b.actividad.calendario }} · {{ b.actividad.horas
                }}{{ b.actividad.choques.length && !b.actividad.cancelada ? ' · choque' : '' }}
              </span>
            }
          </button>
        }
        @if (ahora(); as a) {
          <div
            class="absolute right-0 h-0.5 bg-danger pointer-events-none z-50"
            [style.top]="'calc(var(--h) * ' + a.hora + ' - 1px)'"
            [style.left]="izquierda() - 4 + 'px'"
            role="img"
            [attr.aria-label]="'Ahora, ' + a.etiqueta"
          >
            <span
              class="absolute -left-1.5 -top-[5px] size-3 rounded-full bg-danger"
              aria-hidden="true"
            ></span>
          </div>
        }
      </div>
    </div>
  `,
})
export class CalendarioVistaDia {
  readonly fecha = input.required<string>();
  readonly dias = input.required<Map<string, DiaInfo>>();
  readonly turnosVisibles = input.required<Calendario[]>();
  readonly frente = input<string | null>(null);
  readonly tocarBloque = output<Bloque>();

  readonly horas = HORAS_DIA.map((h) => ({ h, etiqueta: `${String(h).padStart(2, '0')}:00` }));
  private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');

  /** Reloj para la línea de la hora actual: se actualiza cada minuto y al volver a la pestaña. */
  private readonly reloj = signal(new Date());

  /** Línea de la hora actual, solo si el día mostrado es hoy. */
  readonly ahora = computed(() => marcaAhora(this.fecha(), this.reloj()));

  constructor() {
    // Al abrir: hoy, con la hora actual a un tercio del alto (como Google Calendar); otro día, desde las 07:00.
    afterNextRender(() => {
      const el = this.scroll().nativeElement;
      const ahora = this.ahora();
      el.scrollTop = ahora
        ? Math.max(0, (el.scrollHeight * ahora.hora) / 24 - el.clientHeight / 3)
        : (el.scrollHeight * 7) / 24;
    });

    const tic = () => this.reloj.set(new Date());
    const timer = setInterval(tic, 60_000);
    const visible = () => {
      if (document.visibilityState === 'visible') tic();
    };
    document.addEventListener('visibilitychange', visible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    });
  }

  /** Columna de horas (52px) y una columna de 28px por cada calendario de turnos. */
  protected readonly izquierda = computed(() => 56 + this.turnosVisibles().length * 28);

  readonly tramos = computed(() =>
    tramosTurno(this.fecha(), this.dias(), this.turnosVisibles()).map((t) => ({
      clave: `${t.calendario.id}-${t.a}`,
      etiqueta: t.etiqueta,
      colorTexto: textoTono(t.calendario.color),
      aria: `${t.calendario.nombre}: ${t.etiqueta}`,
      estilo: {
        top: `calc(var(--h) * ${t.a} + 2px)`,
        height: `calc(var(--h) * ${t.b - t.a} - 4px)`,
        left: `${52 + t.columna * 28}px`,
        background: fondo(t.calendario.color, t.codigo === 'N' ? 40 : 22),
        border: `1px solid ${t.calendario.color}`,
      },
    })),
  );

  /** Tiempo para trabajar como fondo, detrás de las actividades. */
  readonly libre = computed(() =>
    (this.dias().get(this.fecha())?.libre ?? []).map((l) => ({
      ...l,
      estilo: {
        top: `calc(var(--h) * ${l.desde})`,
        height: `calc(var(--h) * ${l.hasta - l.desde})`,
        left: `${this.izquierda() - 4}px`,
        background: fondo(COLOR_LIBRE_TRABAJO, 10),
        'border-left': `3px solid ${COLOR_LIBRE_TRABAJO}`,
        'z-index': '1',
      },
    })),
  );

  readonly bloques = computed(() =>
    bloquesDelDia(this.dias().get(this.fecha()) ?? diaVacio(this.fecha())),
  );

  estilo(b: Bloque): Record<string, string> {
    return estiloBloque(b, this.izquierda(), this.frente() === b.clave);
  }
}
