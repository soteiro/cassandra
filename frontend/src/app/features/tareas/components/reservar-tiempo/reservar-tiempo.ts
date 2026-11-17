import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';
import { HuecoLibre, PlanificacionResult } from '../../data/planificacion.model';
import { ahoraLocal, PlanificacionService } from '../../data/planificacion.service';
import { Task } from '../../data/task.model';
import { TaskService } from '../../data/task.service';
import { formatoEstimacion } from '../../utils/estimacion.util';

let siguienteId = 0;

const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};
const aHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** Un input de hora no puede mostrar 24:00. */
const ULTIMO_MINUTO = 23 * 60 + 59;

const CAMPO =
  'h-11 w-full min-w-0 px-3 rounded-lg border border-surface-border bg-background text-text-main outline-none focus:border-primary';

/** Tareas del proyecto que todavía se pueden trabajar, con sus subtareas. */
function tareasAbiertas(tareas: Task[]): Task[] {
  const vistas = new Map<number, Task>();
  for (const t of tareas) {
    for (const x of [t, ...(t.subtareas ?? [])]) {
      if (!x.eliminado && x.estado !== 'Terminado') vistas.set(x.id, x);
    }
  }
  return [...vistas.values()];
}

/**
 * Reserva un bloque de trabajo para una tarea. Con `tareaId` la tarea viene dada (detalle de
 * la tarea); sin él se elige proyecto y tarea (calendario).
 */
@Component({
  selector: 'app-reservar-tiempo',
  template: `
    <!-- Sin <form>: el detalle de la tarea ya es un formulario y no se pueden anidar. -->
    <div class="flex flex-col gap-4" role="group" aria-label="Reservar bloque de trabajo">
      @if (!tareaFija()) {
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
          Proyecto
          <select [class]="campo" (change)="elegirProyecto($any($event.target).value)">
            <option value="" [selected]="proyecto() === null">Elige un proyecto</option>
            @for (p of proyectos(); track p.id) {
              <option [value]="p.id" [selected]="p.id === proyecto()">{{ p.nombre }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main">
          Tarea
          <select
            [class]="campo"
            [disabled]="proyecto() === null || cargandoTareas()"
            (change)="elegirTarea($any($event.target).value)"
          >
            <option value="" [selected]="tarea() === null">
              {{ cargandoTareas() ? 'Cargando tareas…' : 'Elige una tarea' }}
            </option>
            @for (t of tareas(); track t.id) {
              <option [value]="t.id" [selected]="t.id === tarea()">
                #{{ t.id }} · {{ t.nombre }}
              </option>
            }
          </select>
        </label>
        @if (proyecto() !== null && !cargandoTareas() && tareas().length === 0) {
          <p class="-mt-2 text-[13px] text-text-muted">Este proyecto no tiene tareas abiertas.</p>
        }
      }

      <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main min-w-0">
        Día
        <input
          type="date"
          [class]="campo"
          [value]="fecha()"
          (input)="fecha.set($any($event.target).value)"
        />
      </label>

      <div class="flex flex-col gap-1.5" role="group" [attr.aria-labelledby]="idHuecos">
        <p [id]="idHuecos" class="text-sm font-medium text-text-main">Huecos libres</p>
        @if (huecosResource.isLoading()) {
          <p class="text-[13px] text-text-muted" role="status">Buscando huecos…</p>
        } @else if (huecosResource.error()) {
          <p class="text-[13px] text-text-muted">
            No se pudieron cargar los huecos. Puedes escribir las horas igual.
          </p>
        } @else if (huecos().length === 0) {
          <p class="text-[13px] text-text-muted">No quedan huecos libres ese día.</p>
        } @else {
          <div class="flex flex-wrap gap-2">
            @for (h of huecos(); track h.hora_inicio) {
              <button
                type="button"
                class="min-h-11 px-3 rounded-lg border text-sm font-semibold tabular-nums"
                [class.border-primary]="esElegido(h)"
                [class.bg-primary]="esElegido(h)"
                [class.text-on-primary]="esElegido(h)"
                [class.border-surface-border]="!esElegido(h)"
                [class.text-text-main]="!esElegido(h)"
                [attr.aria-pressed]="esElegido(h)"
                [attr.aria-label]="'Usar de ' + h.hora_inicio + ' a ' + h.hora_fin"
                (click)="elegirHueco(h)"
              >
                {{ h.hora_inicio }}–{{ h.hora_fin }}
              </button>
            }
          </div>
        }
      </div>

      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1.5 text-sm font-medium text-text-main min-w-0">
          Inicio
          <input
            type="time"
            [class]="campo"
            [value]="horaInicio()"
            (input)="escribirInicio($any($event.target).value)"
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
      @if (avisoDuracion(); as aviso) {
        <p class="-mt-2 text-[13px] text-text-muted">{{ aviso }}</p>
      }

      @if (error()) {
        <p class="text-sm font-semibold text-danger" role="alert">{{ error() }}</p>
      }

      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          class="min-h-11 px-4 rounded-lg border border-surface-border text-sm font-semibold text-text-main hover:bg-background"
          [disabled]="guardando()"
          (click)="cancelar.emit()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="min-h-11 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover disabled:opacity-60"
          [disabled]="guardando()"
          (click)="enviar()"
        >
          {{ guardando() ? 'Reservando…' : 'Reservar bloque' }}
        </button>
      </div>
    </div>
  `,
})
export class ReservarTiempo {
  /** Proyectos para elegir cuando la tarea no viene dada. */
  readonly proyectos = input<{ id: number; nombre: string }[]>([]);
  readonly proyectoId = input<number | null>(null);
  readonly tareaId = input<number | null>(null);
  /** "YYYY-MM-DD"; por defecto hoy. */
  readonly fechaInicial = input('');
  /** Estimación de la tarea dada (en minutos): fija la duración por defecto del bloque. */
  readonly estimacionMin = input<number | null>(null);
  readonly guardado = output<PlanificacionResult>();
  readonly cancelar = output<void>();

  private readonly service = inject(PlanificacionService);
  protected readonly campo = CAMPO;
  protected readonly idHuecos = `reservar-huecos-${siguienteId++}`;

  protected readonly tareaFija = computed(() => this.tareaId() !== null);
  protected readonly proyecto = linkedSignal<number | null>(() => this.proyectoId());
  /** Al cambiar de proyecto se vuelve a elegir la tarea. */
  protected readonly tarea = linkedSignal<{ fija: number | null; p: number | null }, number | null>(
    {
      source: () => ({ fija: this.tareaId(), p: this.proyecto() }),
      computation: (s) => s.fija,
    },
  );
  private readonly tareasResource = inject(TaskService).getTasksByProyectoId(() =>
    this.tareaFija() ? null : this.proyecto(),
  );
  protected readonly cargandoTareas = computed(() => !!this.tareasResource?.isLoading());
  protected readonly tareas = computed(() =>
    this.tareasResource?.hasValue() ? tareasAbiertas(this.tareasResource.value()) : [],
  );

  protected readonly fecha = linkedSignal(() => this.fechaInicial() || ahoraLocal().slice(0, 10));
  /** Minutos que dura el bloque por defecto: la estimación de la tarea. */
  protected readonly duracion = computed(() => {
    const min = this.tareaFija()
      ? this.estimacionMin()
      : this.tareas().find((t) => t.id === this.tarea())?.estimacion_min;
    return min && min > 0 ? min : null;
  });
  protected readonly horaInicio = signal('');
  /** Fin del hueco elegido: el bloque no se pasa de ahí. */
  private readonly topeHueco = signal<string | null>(null);
  /**
   * Término sugerido: inicio + estimación, sin pasar del hueco elegido. Se puede cambiar a
   * mano; vuelve a calcularse al cambiar el inicio, el hueco o la tarea.
   */
  protected readonly horaFin = linkedSignal<
    { ini: string; dur: number | null; tope: string | null },
    string
  >({
    source: () => ({ ini: this.horaInicio(), dur: this.duracion(), tope: this.topeHueco() }),
    computation: ({ ini, dur, tope }, previo) => {
      if (!ini || (!dur && !tope)) return previo?.value ?? '';
      let fin = dur ? aMinutos(ini) + dur : aMinutos(tope!);
      if (tope) fin = Math.min(fin, aMinutos(tope));
      return aHora(Math.min(fin, ULTIMO_MINUTO));
    },
  });
  protected readonly avisoDuracion = computed(() => {
    if (this.tarea() === null) return '';
    const dur = this.duracion();
    if (!dur) return 'La tarea no tiene estimación: indica el término.';
    const ini = this.horaInicio();
    const fin = this.horaFin();
    if (ini && fin && fin > ini && aMinutos(fin) - aMinutos(ini) < dur) {
      const alcanza = formatoEstimacion(aMinutos(fin) - aMinutos(ini));
      return `El bloque dura ${alcanza} de los ${formatoEstimacion(dur)} estimados.`;
    }
    return `Dura ${formatoEstimacion(dur)}, según la estimación.`;
  });
  protected readonly huecosResource = this.service.huecosResource(() => this.fecha());
  protected readonly huecos = computed(() =>
    this.huecosResource.hasValue()
      ? (this.huecosResource.value().huecos ?? []).filter((h) => h.fecha === this.fecha())
      : [],
  );

  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected elegirProyecto(valor: string) {
    this.proyecto.set(valor ? Number(valor) : null);
  }

  protected elegirTarea(valor: string) {
    this.tarea.set(valor ? Number(valor) : null);
  }

  protected esElegido(h: HuecoLibre): boolean {
    return h.hora_inicio === this.horaInicio() && h.hora_fin === this.topeHueco();
  }

  protected elegirHueco(h: HuecoLibre) {
    this.topeHueco.set(h.hora_fin);
    this.horaInicio.set(h.hora_inicio);
    this.error.set('');
  }

  protected escribirInicio(valor: string) {
    this.topeHueco.set(null);
    this.horaInicio.set(valor);
  }

  private validar(): string {
    if (this.proyecto() === null) return 'Elige un proyecto.';
    if (this.tarea() === null) return 'Elige una tarea.';
    if (!this.fecha()) return 'Elige un día.';
    if (!this.horaInicio() || !this.horaFin()) return 'Indica la hora de inicio y de término.';
    if (this.horaFin() <= this.horaInicio()) return 'El término debe ser posterior al inicio.';
    return '';
  }

  protected enviar() {
    if (this.guardando()) return;
    const problema = this.validar();
    this.error.set(problema);
    if (problema) return;
    this.guardando.set(true);
    this.service
      .planificar(this.proyecto()!, this.tarea()!, {
        operacion_id: `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        bloques: [
          { fecha: this.fecha(), hora_inicio: this.horaInicio(), hora_fin: this.horaFin() },
        ],
      })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.topeHueco.set(null);
          this.horaInicio.set('');
          this.horaFin.set('');
          this.huecosResource.reload();
          this.guardado.emit(res);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(getErrorMessage(err, 'No se pudo reservar el bloque.'));
        },
      });
  }
}
