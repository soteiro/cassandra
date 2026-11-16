import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CalendarioRango, TURNOS } from '../../data/calendario.model';
import { barrasSemana } from '../../utils/layout.util';
import { DiaInfo, diaVacio, Visibilidad } from '../../utils/modelo.util';
import {
  DIAS_CORTOS,
  diaLargo,
  diaSemana,
  inicioSemana,
  numeroDia,
  sumarDias,
} from '../../utils/dias.util';
import { estiloBarra } from '../../utils/barra.util';
import { COLOR_LIBRE_TRABAJO, fondo } from '../../utils/estilo.util';
import {
  Bloque,
  bloquesDelDia,
  estiloBloque,
  HORAS_DIA,
  tramosTurno,
} from '../../utils/timeline.util';

/** Semana como grilla de 7 días por hora, con los deadlines como barras arriba. */
@Component({
  selector: 'app-calendario-semana',
  templateUrl: './vista-semana.html',
})
export class CalendarioVistaSemana {
  readonly rango = input.required<CalendarioRango>();
  readonly dias = input.required<Map<string, DiaInfo>>();
  readonly visibles = input.required<Visibilidad>();
  readonly cursor = input.required<string>();
  readonly hoy = input.required<string>();
  readonly frente = input<string | null>(null);
  readonly abrirDia = output<string>();
  readonly tocarBloque = output<Bloque>();

  readonly horas = HORAS_DIA.map((h) => ({ h, corto: String(h).padStart(2, '0') }));
  private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');

  constructor() {
    // Arranca en las 07:00: la madrugada queda arriba, a un scroll.
    afterNextRender(() => {
      const el = this.scroll().nativeElement;
      // El encabezado fijo va dentro del scroll: las 24 horas son el resto del alto.
      const cabecera = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      el.scrollTop = ((el.scrollHeight - cabecera) * 7) / 24;
    });
  }

  private readonly turnosVisibles = computed(() =>
    this.rango().calendarios.filter(
      (c) => c.tipo === 'turnos' && this.visibles().calendarios.has(c.id),
    ),
  );

  /** Los bloques empiezan después de las líneas de turno. */
  readonly izquierda = computed(() => 3 + this.turnosVisibles().length * 5);

  readonly banda = computed(() => {
    const rango = this.rango();
    const lay = barrasSemana(inicioSemana(this.cursor()), {
      deadlines: this.visibles().deadlines ? rango.deadlines : [],
      calendariosTurnos: [],
      turnos: [],
      hoy: this.hoy(),
      maxCarriles: 4,
    });
    return {
      filas: lay.filas,
      barras: lay.barras.map((b) => ({ ...b, estilo: estiloBarra(b, new Map()) })),
    };
  });

  readonly semana = computed(() => {
    const lunes = inicioSemana(this.cursor());
    const dias = this.dias();
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = sumarDias(lunes, i);
      const info = dias.get(fecha) ?? diaVacio(fecha);
      return {
        fecha,
        nombre: DIAS_CORTOS[diaSemana(fecha)],
        numero: numeroDia(fecha),
        hoy: fecha === this.hoy(),
        aria: `${diaLargo(fecha)}${info.turnos.map((t) => `, ${t.calendario.nombre}: ${TURNOS[t.turno.codigo].nombre}`).join('')}. Abrir el día`,
        turnos: info.turnos.map((t) => ({
          clave: t.calendario.id,
          corto: TURNOS[t.turno.codigo].corto,
          color: t.calendario.color,
          trabaja: TURNOS[t.turno.codigo].trabaja,
          cambio: t.turno.cambio,
        })),
        tramos: tramosTurno(fecha, dias, this.turnosVisibles()).map((t) => ({
          clave: `${t.calendario.id}-${t.a}`,
          estilo: {
            top: `calc(var(--h) * ${t.a})`,
            height: `calc(var(--h) * ${t.b - t.a})`,
            left: `${1 + t.columna * 5}px`,
            background: fondo(t.calendario.color, t.codigo === 'N' ? 85 : 55),
          },
          aria: `${t.calendario.nombre}: ${t.etiqueta}`,
        })),
        libre: info.libre.map((l) => ({
          clave: l.desde,
          aria: `Para trabajar: ${l.horas}`,
          estilo: {
            top: `calc(var(--h) * ${l.desde})`,
            height: `calc(var(--h) * ${l.hasta - l.desde})`,
            background: fondo(COLOR_LIBRE_TRABAJO, 12),
            'border-left': `2px solid ${COLOR_LIBRE_TRABAJO}`,
          },
        })),
        bloques: bloquesDelDia(info),
      };
    });
  });

  estilo(b: Bloque): Record<string, string> {
    return estiloBloque(b, this.izquierda(), this.frente() === b.clave);
  }
}
