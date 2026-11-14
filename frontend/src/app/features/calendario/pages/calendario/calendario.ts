import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LucideChevronLeft, LucideChevronRight, LucidePlus } from '@lucide/angular';
import { CalendarioService, RangoParams } from '../../data/calendario.service';
import {
  Actividad,
  Calendario,
  CalendarioRango,
  CalendarioRequest,
  CodigoTurno,
  Deadline,
} from '../../data/calendario.model';
import {
  ActividadDia,
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
import { COLOR_DEADLINE } from '../../utils/estilo.util';
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

type Vista = 'tres' | 'mes' | 'sem' | 'dia';

type Hoja =
  | { tipo: 'gestion' }
  | { tipo: 'ciclo'; calendario: Calendario }
  | { tipo: 'turno'; calendario: Calendario; fecha: string }
  | { tipo: 'actividad'; actividad: Actividad | null; fecha: string }
  | { tipo: 'ocurrencia'; actividad: ActividadDia };

const CLAVE_VISTA = 'cassandra.calendario.vista';
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
  ],
  templateUrl: './calendario.html',
})
export class CalendarioPage {
  private readonly service = inject(CalendarioService);
  private readonly toast = inject(ToastService);
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
      calendarios: new Set(
        rango.calendarios.filter((c) => local[String(c.id)] ?? !c.oculto).map((c) => c.id),
      ),
    };
  }

  readonly visibles = computed<Visibilidad>(() => {
    const r = this.rango();
    return r ? this.visibilidadDe(r) : { deadlines: true, calendarios: new Set() };
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
    return [
      { clave: 'deadlines', nombre: 'Deadlines', color: COLOR_DEADLINE, visible: vis.deadlines },
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
      case 'ciclo':
        return `Ciclo · ${h.calendario.nombre}`;
      case 'turno':
        return `${diaCorto(h.fecha)} · ${h.calendario.nombre}`;
      case 'actividad':
        return h.actividad ? 'Editar actividad' : 'Nueva actividad';
      case 'ocurrencia':
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

  abrirDeadline(d: Deadline) {
    this.router.navigate(['/proyectos', d.proyecto_id]);
  }

  /** Primer toque: trae el bloque al frente. Segundo: abre sus opciones. */
  tocarBloque(b: Bloque) {
    if (this.frente() === b.clave) {
      this.hoja.set({ tipo: 'ocurrencia', actividad: b.actividad });
    } else {
      this.frente.set(b.clave);
    }
  }

  // Capas

  alternarCapa(capa: Capa) {
    const visible = !capa.visible;
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

  abrirOcurrencia(a: ActividadDia) {
    this.hoja.set({ tipo: 'ocurrencia', actividad: a });
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
      this.service.actualizarCalendario(e.id, { nombre: e.nombre, color: e.color }),
      'Calendario actualizado',
      () => {},
    );
  }

  eliminarCalendario(cal: Calendario) {
    if (!confirm(`¿Eliminar el calendario «${cal.nombre}» y todo lo que tiene?`)) return;
    this.ejecutar(this.service.eliminarCalendario(cal.id), 'Calendario eliminado', () => {});
  }

  rotuloOcurrencia(a: ActividadDia): string {
    return `${a.calendario} · ${diaCorto(a.fecha)} · ${a.hora_inicio}–${a.hora_fin}`;
  }
}
