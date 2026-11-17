import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  LucideCalendarClock,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePlus,
} from '@lucide/angular';
import { CalendarioService, RangoParams } from '../../data/calendario.service';
import {
  Actividad,
  BloqueTrabajo,
  Calendario,
  CalendarioRango,
  CalendarioRequest,
  CodigoTurno,
  Deadline,
  FranjaHorario,
} from '../../data/calendario.model';
import {
  ActividadDia,
  CAPA_PLANIFICADO,
  construirDias,
  DiaInfo,
  diaVacio,
  resumenFranja,
  TurnoVista,
  Visibilidad,
} from '../../utils/modelo.util';
import {
  diaCorto,
  diaLargo,
  hoyLocal,
  inicioSemana,
  nombreMes,
  nombreSemana,
  nombreTresMeses,
  semanasDelMes,
  sumarDias,
  sumarMeses,
} from '../../utils/dias.util';
import { COLOR_DEADLINE, COLOR_PLANIFICADO } from '../../utils/estilo.util';
import { Bloque } from '../../utils/timeline.util';
import { ToastService } from '../../../../shared/services/toast.service';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';
import { Capa, CalendarioCapas } from '../../components/capas/capas';
import { CalendarioFranja } from '../../components/franja-urgente/franja-urgente';
import { CalendarioAgenda } from '../../components/agenda-dia/agenda-dia';
import { CalendarioVistaMes } from '../../components/vista-mes/vista-mes';
import { CalendarioVistaSemana } from '../../components/vista-semana/vista-semana';
import { CalendarioVistaDia } from '../../components/vista-dia/vista-dia';
import { CalendarioVistaTresMeses } from '../../components/vista-tres-meses/vista-tres-meses';
import { CalendarioHoja } from '../../components/hoja/hoja';
import { CalendarioFormCiclo } from '../../components/form-ciclo/form-ciclo';
import { CalendarioFormTurnoDia } from '../../components/form-turno-dia/form-turno-dia';
import {
  CalendarioFormActividad,
  GuardarActividad,
} from '../../components/form-actividad/form-actividad';
import {
  CalendarioGestion,
  EditarCalendario,
} from '../../components/gestion-calendarios/gestion-calendarios';
import { CalendarioHorarioBase } from '../../components/horario-base/horario-base';
import { ReservarTiempo } from '../../../tareas/components/reservar-tiempo/reservar-tiempo';
import { PlanificacionResult } from '../../../tareas/data/planificacion.model';
import { ProjectService } from '../../../proyectos/data/project.service';
import { TaskDetailModal } from '../../../tareas/components/task-detail-modal/task-detail-modal';
import { Task } from '../../../tareas/data/task.model';
import { TaskService } from '../../../tareas/data/task.service';

type Vista = 'tres' | 'mes' | 'sem' | 'dia';

type Hoja =
  | { tipo: 'gestion' }
  | { tipo: 'ciclo'; calendario: Calendario }
  | { tipo: 'turno'; calendario: Calendario; fecha: string }
  | { tipo: 'actividad'; actividad: Actividad | null; fecha: string }
  | { tipo: 'ocurrencia'; actividad: ActividadDia }
  | { tipo: 'trabajo'; actividad: ActividadDia; bloque: BloqueTrabajo }
  | { tipo: 'horario'; franjas: FranjaHorario[] }
  | { tipo: 'planificar' };

const CLAVE_VISTA = 'cassandra.calendario.vista';
/**
 * Capas que no son calendarios del servidor (bloques de trabajo y tiempo para trabajar):
 * se recuerdan en el navegador.
 */
const CAPAS_LOCALES = {
  planificado: 'cassandra.calendario.planificado',
  libre: 'cassandra.calendario.libre',
} as const;
type CapaLocal = keyof typeof CAPAS_LOCALES;
const CAPA_LIBRE = 'Para trabajar';
const COLOR_LIBRE = 'var(--theme-success)';
const VISTAS: { valor: Vista; nombre: string }[] = [
  { valor: 'tres', nombre: '3 meses' },
  { valor: 'mes', nombre: 'Mes' },
  { valor: 'sem', nombre: 'Semana' },
  { valor: 'dia', nombre: 'Día' },
];

function vistaDe(v: string | null): Vista | null {
  return VISTAS.some((x) => x.valor === v) ? (v as Vista) : null;
}

function fechaValida(f: string | null): string | null {
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
}

function leerCapaLocal(capa: CapaLocal): boolean {
  try {
    return localStorage.getItem(CAPAS_LOCALES[capa]) !== 'oculto';
  } catch {
    return true;
  }
}

function leerVista(): Vista {
  try {
    return vistaDe(localStorage.getItem(CLAVE_VISTA)) ?? 'mes';
  } catch {
    return 'mes';
  }
}

/**
 * Calendario: deadlines de tareas y proyectos, turnos calculados por ciclo y actividades,
 * cada uno como una capa que se puede ocultar. Vistas de 3 meses, mes, semana y día.
 */
@Component({
  selector: 'app-calendario',
  imports: [
    LucideChevronLeft,
    LucideChevronRight,
    LucidePlus,
    LucideCalendarClock,
    CalendarioCapas,
    CalendarioFranja,
    CalendarioAgenda,
    CalendarioVistaMes,
    CalendarioVistaSemana,
    CalendarioVistaDia,
    CalendarioVistaTresMeses,
    CalendarioHoja,
    CalendarioFormCiclo,
    CalendarioFormTurnoDia,
    CalendarioFormActividad,
    CalendarioGestion,
    CalendarioHorarioBase,
    ReservarTiempo,
    TaskDetailModal,
  ],
  templateUrl: './calendario.html',
})
export class CalendarioPage {
  private readonly service = inject(CalendarioService);
  private readonly toast = inject(ToastService);
  private readonly projectsResource = inject(ProjectService).projectsResource;
  private readonly taskService = inject(TaskService);
  /** Tarea abierta en el mismo detalle que se usa en Proyectos. */
  readonly tareaAbierta = signal<Task | null>(null);
  readonly abriendoTarea = signal(false);
  /** Proyectos para planificar una tarea desde el calendario. */
  readonly proyectos = computed(() =>
    this.projectsResource.hasValue() ? this.projectsResource.value() : [],
  );
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly hoy = hoyLocal(new Date());
  readonly vistas = VISTAS;
  /** ?vista=dia&fecha=2026-11-20 abre directo un día (enlaces desde otras pantallas). */
  readonly vista = signal<Vista>(vistaDe(this.query.get('vista')) ?? leerVista());
  readonly cursor = signal(fechaValida(this.query.get('fecha')) ?? this.hoy);
  /** Bloque traído al frente cuando hay solapamientos. */
  readonly frente = signal<string | null>(null);
  readonly hoja = signal<Hoja | null>(null);
  readonly guardando = signal(false);
  /** Visibilidad cambiada aquí mientras el servidor confirma. */
  private readonly visibilidadLocal = signal<Record<string, boolean>>({});
  /** Capas guardadas en el navegador: bloques de trabajo y tiempo para trabajar. */
  readonly capasLocales = signal<Record<CapaLocal, boolean>>({
    planificado: leerCapaLocal('planificado'),
    libre: leerCapaLocal('libre'),
  });

  constructor() {
    effect(() => {
      const v = this.vista();
      try {
        localStorage.setItem(CLAVE_VISTA, v);
      } catch {
        // Sin almacenamiento la vista solo dura la sesión.
      }
    });
  }

  private readonly params = computed<RangoParams>(() => {
    const c = this.cursor();
    const hoy = this.hoy;
    switch (this.vista()) {
      case 'tres': {
        const ultimas = semanasDelMes(sumarMeses(c, 2));
        return { desde: inicioSemana(sumarMeses(c, 0)), hasta: ultimas.at(-1)![6], hoy };
      }
      case 'mes': {
        const semanas = semanasDelMes(c);
        return { desde: semanas[0][0], hasta: semanas.at(-1)![6], hoy };
      }
      case 'sem':
        return { desde: inicioSemana(c), hasta: sumarDias(inicioSemana(c), 6), hoy };
      default:
        return { desde: c, hasta: c, hoy };
    }
  });

  private readonly rangoResource = this.service.rango(() => this.params());
  private readonly franjaResource = this.service.rango(() => ({
    desde: this.hoy,
    hasta: sumarDias(this.hoy, 6),
    hoy: this.hoy,
  }));

  /** Mantiene el último rango mientras carga el siguiente, para no parpadear. */
  readonly rango = linkedSignal<CalendarioRango | undefined, CalendarioRango | undefined>({
    source: () => this.rangoResource.value(),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  readonly cargando = computed(() => this.rangoResource.isLoading());
  readonly error = computed(() =>
    this.rangoResource.error() ? 'No se pudo cargar el calendario.' : '',
  );

  private visibilidadDe(rango: CalendarioRango): Visibilidad {
    const local = this.visibilidadLocal();
    return {
      deadlines: local['deadlines'] ?? !rango.ocultar_deadlines,
      planificado: this.capasLocales().planificado,
      libre: this.capasLocales().libre,
      calendarios: new Set(
        rango.calendarios.filter((c) => local[String(c.id)] ?? !c.oculto).map((c) => c.id),
      ),
    };
  }

  readonly visibles = computed<Visibilidad>(() => {
    const r = this.rango();
    return r
      ? this.visibilidadDe(r)
      : { deadlines: true, planificado: true, libre: true, calendarios: new Set() };
  });

  readonly dias = computed(() => {
    const r = this.rango();
    return r ? construirDias(r, this.visibles(), this.hoy) : new Map<string, DiaInfo>();
  });

  readonly resumen = computed(() => {
    const r = this.franjaResource.value();
    if (!r) return null;
    const vis = this.visibilidadDe(r);
    if (!vis.deadlines) return { vencidos: [], proximos: [], choques: [] };
    return resumenFranja(r, construirDias(r, vis, this.hoy), this.hoy);
  });

  readonly calendarios = computed(() => this.rango()?.calendarios ?? []);
  readonly calendariosActividades = computed(() =>
    this.calendarios().filter((c) => c.tipo === 'actividades'),
  );
  readonly turnosVisibles = computed(() =>
    this.calendarios().filter((c) => c.tipo === 'turnos' && this.visibles().calendarios.has(c.id)),
  );

  readonly capas = computed<Capa[]>(() => {
    const vis = this.visibles();
    // Planificado y Para trabajar solo aparecen si tienen algo en el rango (o están ocultas,
    // para poder volver a mostrarlas).
    const conBloques = !!this.rango()?.bloques?.length || !vis.planificado;
    const conLibre = !!this.rango()?.tiempo_libre?.length || !vis.libre;
    return [
      { clave: 'deadlines', nombre: 'Deadlines', color: COLOR_DEADLINE, visible: vis.deadlines },
      ...(conLibre
        ? [{ clave: 'libre', nombre: CAPA_LIBRE, color: COLOR_LIBRE, visible: vis.libre }]
        : []),
      ...(conBloques
        ? [
            {
              clave: 'planificado',
              nombre: CAPA_PLANIFICADO,
              color: COLOR_PLANIFICADO,
              visible: vis.planificado,
            },
          ]
        : []),
      ...this.calendarios().map((c) => ({
        clave: String(c.id),
        nombre: c.nombre,
        color: c.color,
        visible: vis.calendarios.has(c.id),
        turnosId: c.tipo === 'turnos' ? c.id : undefined,
      })),
    ];
  });

  readonly seleccionado = computed<DiaInfo>(
    () => this.dias().get(this.cursor()) ?? diaVacio(this.cursor()),
  );

  readonly periodo = computed(() => {
    const c = this.cursor();
    switch (this.vista()) {
      case 'tres':
        return nombreTresMeses(c);
      case 'mes':
        return nombreMes(c);
      case 'sem':
        return nombreSemana(c);
      default:
        return diaLargo(c) + (c === this.hoy ? ' · hoy' : '');
    }
  });

  /** En mes y 3 meses la agenda del día va al lado (abajo en el celular). */
  readonly conAgenda = computed(() => this.vista() === 'mes' || this.vista() === 'tres');

  readonly sinCalendarios = computed(() => !!this.rango() && this.calendarios().length === 0);

  /** Para avisar choques al crear una actividad. */
  readonly ocupado = (fecha: string): ActividadDia[] => this.dias().get(fecha)?.actividades ?? [];

  readonly tituloHoja = computed(() => {
    const h = this.hoja();
    if (!h) return '';
    switch (h.tipo) {
      case 'gestion':
        return 'Calendarios';
      case 'horario':
        return 'Horario de trabajo';
      case 'planificar':
        return 'Planificar tarea';
      case 'ciclo':
        return `Ciclo · ${h.calendario.nombre}`;
      case 'turno':
        return `${diaCorto(h.fecha)} · ${h.calendario.nombre}`;
      case 'actividad':
        return h.actividad ? 'Editar actividad' : 'Nueva actividad';
      case 'ocurrencia':
      case 'trabajo':
        return h.actividad.titulo;
    }
  });

  readonly turnoDeHoja = computed(() => {
    const h = this.hoja();
    if (h?.tipo !== 'turno') return undefined;
    return this.dias()
      .get(h.fecha)
      ?.turnos.find((t) => t.calendario.id === h.calendario.id)?.turno;
  });

  // Navegación

  cambiarVista(v: Vista) {
    this.vista.set(v);
    this.frente.set(null);
  }

  mover(n: number) {
    const c = this.cursor();
    let nuevo: string;
    switch (this.vista()) {
      case 'tres':
        nuevo = sumarMeses(c, 3 * n);
        break;
      case 'mes':
        nuevo = sumarMeses(c, n);
        break;
      case 'sem':
        nuevo = sumarDias(c, 7 * n);
        break;
      default:
        nuevo = sumarDias(c, n);
    }
    // Al volver al mes de hoy, queda elegido hoy.
    if (
      (this.vista() === 'mes' || this.vista() === 'tres') &&
      nuevo.slice(0, 7) === this.hoy.slice(0, 7)
    ) {
      nuevo = this.hoy;
    }
    this.cursor.set(nuevo);
    this.frente.set(null);
  }

  irAHoy() {
    this.cursor.set(this.hoy);
  }

  elegirDia(fecha: string) {
    this.cursor.set(fecha);
  }

  abrirDia(fecha: string) {
    this.cursor.set(fecha);
    this.cambiarVista('dia');
  }

  /** Un deadline de tarea abre su detalle, como un bloque; el de un proyecto, el proyecto. */
  abrirDeadline(d: Deadline) {
    if (d.tipo === 'tarea') this.abrirTarea(d.id);
    else this.router.navigate(['/proyectos', d.proyecto_id]);
  }

  /** Primer toque: trae el bloque al frente. Segundo: abre sus opciones. */
  tocarBloque(b: Bloque) {
    if (this.frente() === b.clave) {
      this.abrirOcurrencia(b.actividad);
    } else {
      this.frente.set(b.clave);
    }
  }

  // Capas

  alternarCapa(capa: Capa) {
    const visible = !capa.visible;
    if (capa.clave === 'planificado' || capa.clave === 'libre') {
      const clave = capa.clave;
      this.capasLocales.update((c) => ({ ...c, [clave]: visible }));
      try {
        localStorage.setItem(CAPAS_LOCALES[clave], visible ? 'visible' : 'oculto');
      } catch {
        // Sin almacenamiento la capa solo dura la sesión.
      }
      return;
    }
    this.visibilidadLocal.update((v) => ({ ...v, [capa.clave]: visible }));
    const peticion: Observable<unknown> =
      capa.clave === 'deadlines'
        ? this.service.ocultarDeadlines(!visible)
        : this.service.actualizarCalendario(Number(capa.clave), { oculto: !visible });
    peticion.subscribe({
      error: (err) => {
        this.visibilidadLocal.update((v) => ({ ...v, [capa.clave]: !visible }));
        this.toast.error(getErrorMessage(err, 'No se pudo guardar la visibilidad'));
      },
    });
  }

  // Hojas

  cerrarHoja() {
    this.hoja.set(null);
  }

  abrirGestion() {
    this.hoja.set({ tipo: 'gestion' });
  }

  abrirHorario() {
    this.service.horarioBase().subscribe({
      next: (franjas) => this.hoja.set({ tipo: 'horario', franjas }),
      error: (err) => this.toast.error(getErrorMessage(err, 'No se pudo abrir el horario')),
    });
  }

  guardarHorario(franjas: FranjaHorario[]) {
    this.ejecutar(this.service.guardarHorarioBase(franjas), 'Horario guardado', () =>
      this.abrirGestion(),
    );
  }

  abrirCiclo(calendarioId: number) {
    const cal = this.calendarios().find((c) => c.id === calendarioId);
    if (cal) this.hoja.set({ tipo: 'ciclo', calendario: cal });
  }

  abrirTurno(t: TurnoVista) {
    this.hoja.set({ tipo: 'turno', calendario: t.calendario, fecha: t.turno.fecha });
  }

  nuevaActividad() {
    if (!this.calendariosActividades().length) {
      this.toast.error('Primero crea un calendario de actividades');
      this.abrirGestion();
      return;
    }
    this.hoja.set({ tipo: 'actividad', actividad: null, fecha: this.cursor() });
  }

  /** Reserva un bloque de trabajo para una tarea, por defecto en el día visible. */
  planificarTarea() {
    this.hoja.set({ tipo: 'planificar' });
  }

  bloqueReservado(res: PlanificacionResult) {
    this.toast.success('Bloque reservado');
    // Fuera del tiempo libre se guarda igual, pero conviene saberlo.
    if (res.avisos?.length) this.toast.warning(res.avisos.join(' '));
    this.recargar();
    this.cerrarHoja();
  }

  abrirOcurrencia(a: ActividadDia) {
    this.hoja.set(
      a.trabajo
        ? { tipo: 'trabajo', actividad: a, bloque: a.trabajo }
        : { tipo: 'ocurrencia', actividad: a },
    );
  }

  /** Cierra la hoja abierta y abre el detalle completo de la tarea. */
  abrirTarea(tareaId: number) {
    if (this.abriendoTarea()) return;
    this.abriendoTarea.set(true);
    this.taskService.getTaskById(tareaId).subscribe({
      next: (tarea) => {
        this.abriendoTarea.set(false);
        this.cerrarHoja();
        this.tareaAbierta.set(tarea);
      },
      error: (err) => {
        this.abriendoTarea.set(false);
        this.toast.error(getErrorMessage(err, 'No se pudo abrir la tarea'));
      },
    });
  }

  /** El nombre o el estado de la tarea se ven en sus bloques y deadlines. */
  tareaCambiada() {
    this.recargar();
  }

  tareaEliminada() {
    this.tareaAbierta.set(null);
    this.recargar();
  }

  abrirProyecto(b: BloqueTrabajo) {
    this.router.navigate(['/proyectos', b.proyecto_id]);
  }

  quitarBloque(b: BloqueTrabajo) {
    if (!confirm(`¿Quitar el bloque de «${b.tarea}»? La tarea no se modifica.`)) return;
    this.ejecutar(this.service.quitarBloque(b.id), 'Bloque quitado');
  }

  rotuloTrabajo(b: BloqueTrabajo): string {
    return `${b.proyecto_nombre} · ${diaCorto(b.fecha)} · ${b.hora_inicio}–${b.hora_fin}`;
  }

  private ejecutar<T>(peticion: Observable<T>, exito: string, despues?: (r: T) => void) {
    this.guardando.set(true);
    peticion.subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.toast.success(exito);
        this.recargar();
        if (despues) despues(r);
        else this.cerrarHoja();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error(getErrorMessage(err, 'No se pudo guardar'));
      },
    });
  }

  private recargar() {
    this.visibilidadLocal.set({});
    this.rangoResource.reload();
    this.franjaResource.reload();
  }

  guardarCiclo(calendario: Calendario, primerLargo: string) {
    this.ejecutar(this.service.fijarCiclo(calendario.id, primerLargo), 'Ciclo guardado');
  }

  elegirTurno(calendario: Calendario, fecha: string, codigo: CodigoTurno) {
    const base = this.turnoDeHoja()?.base;
    const peticion =
      codigo === base
        ? this.service.quitarExcepcion(calendario.id, fecha)
        : this.service.marcarExcepcion(calendario.id, fecha, codigo);
    this.ejecutar(peticion, 'Turno actualizado');
  }

  volverAlCiclo(calendario: Calendario, fecha: string) {
    this.ejecutar(this.service.quitarExcepcion(calendario.id, fecha), 'El día vuelve al ciclo');
  }

  guardarActividad(g: GuardarActividad) {
    const peticion: Observable<Actividad> = g.id
      ? this.service.actualizarActividad(g.id, g.req)
      : this.service.crearActividad(g.calendarioId, g.req);
    this.ejecutar(peticion, g.id ? 'Actividad actualizada' : 'Actividad creada', () => {
      this.cerrarHoja();
      this.cursor.set(g.req.fecha);
    });
  }

  alternarCancelacion(a: ActividadDia) {
    this.ejecutar(
      this.service.cancelarDia(a.actividad_id, a.fecha, !a.cancelada),
      a.cancelada ? 'La actividad vuelve a este día' : 'Marcada como que no ocurre este día',
    );
  }

  editarActividad(a: ActividadDia) {
    this.service.obtenerActividad(a.actividad_id).subscribe({
      next: (act) => this.hoja.set({ tipo: 'actividad', actividad: act, fecha: a.fecha }),
      error: (err) => this.toast.error(getErrorMessage(err, 'No se pudo abrir la actividad')),
    });
  }

  eliminarActividad(a: ActividadDia) {
    const que = a.semanal ? `«${a.titulo}» en todas sus semanas` : `«${a.titulo}»`;
    if (!confirm(`¿Eliminar ${que}?`)) return;
    this.ejecutar(this.service.eliminarActividad(a.actividad_id), 'Actividad eliminada');
  }

  crearCalendario(req: CalendarioRequest) {
    this.ejecutar(this.service.crearCalendario(req), 'Calendario creado', (cal) => {
      // Un calendario de turnos sin ciclo no tiene días: se pide de inmediato.
      if (cal.tipo === 'turnos') this.hoja.set({ tipo: 'ciclo', calendario: cal });
    });
  }

  /** La hoja sigue abierta para seguir ajustando otros calendarios. */
  actualizarCalendario(e: EditarCalendario) {
    this.ejecutar(
      this.service.actualizarCalendario(e.id, {
        nombre: e.nombre,
        color: e.color,
        disponibilidad: e.disponibilidad,
      }),
      'Calendario actualizado',
      () => {},
    );
  }

  eliminarCalendario(cal: Calendario) {
    if (!confirm(`¿Eliminar el calendario «${cal.nombre}» y todo lo que tiene?`)) return;
    this.ejecutar(this.service.eliminarCalendario(cal.id), 'Calendario eliminado', () => {});
  }

  rotuloOcurrencia(a: ActividadDia): string {
    const sigue = a.hora_fin <= a.hora_inicio ? ' (termina al día siguiente)' : '';
    return `${a.calendario} · ${diaCorto(a.fecha)} · ${a.horas}${sigue}`;
  }
}
