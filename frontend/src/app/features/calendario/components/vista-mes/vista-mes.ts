import { Component, computed, input, output } from '@angular/core';
import { CalendarioRango, TURNOS } from '../../data/calendario.model';
import { BarraSemana, barrasSemana } from '../../utils/layout.util';
import { ActividadDia, DiaInfo, diaVacio, Visibilidad } from '../../utils/modelo.util';
import { DIAS_CORTOS, diaCorto, mesDe, numeroDia, semanasDelMes } from '../../utils/dias.util';
import { estiloBarra } from '../../utils/barra.util';

/** Alto de cada fila de barras (px). */
export const ALTO_FILA = 18;

interface Celda {
  fecha: string;
  numero: number;
  enMes: boolean;
  hoy: boolean;
  seleccionada: boolean;
  aria: string;
  puntos: { clave: string; color: string }[];
  choque: boolean;
  chips: ActividadDia[];
  mas: number;
}

interface Semana {
  lunes: string;
  celdas: Celda[];
  barras: (BarraSemana & { estilo: Record<string, string> })[];
  altoBarras: number;
}

/** Mes en semanas: barras de turnos y deadlines que cruzan los días, y la agenda aparte. */
@Component({
  selector: 'app-calendario-mes',
  templateUrl: './vista-mes.html',
})
export class CalendarioVistaMes {
  readonly rango = input.required<CalendarioRango>();
  readonly dias = input.required<Map<string, DiaInfo>>();
  readonly visibles = input.required<Visibilidad>();
  readonly cursor = input.required<string>();
  readonly seleccionado = input.required<string>();
  readonly hoy = input.required<string>();
  readonly elegir = output<string>();
  readonly abrirDia = output<string>();

  readonly cabecera = DIAS_CORTOS;

  readonly semanas = computed<Semana[]>(() => {
    const rango = this.rango();
    const vis = this.visibles();
    const mes = mesDe(this.cursor());
    const colores = new Map(rango.calendarios.map((c) => [c.id, c.color]));
    const turnosVisibles = rango.calendarios
      .filter((c) => c.tipo === 'turnos' && vis.calendarios.has(c.id))
      .map((c) => c.id);

    return semanasDelMes(this.cursor()).map((fechas) => {
      const lay = barrasSemana(fechas[0], {
        deadlines: vis.deadlines ? rango.deadlines : [],
        calendariosTurnos: turnosVisibles,
        turnos: rango.turnos,
        hoy: this.hoy(),
        maxCarriles: 2,
      });
      return {
        lunes: fechas[0],
        altoBarras: lay.filas * ALTO_FILA,
        barras: lay.barras.map((b) => ({ ...b, estilo: estiloBarra(b, colores) })),
        celdas: fechas.map((f, i) => this.celda(f, mes, lay.mas[i])),
      };
    });
  });

  private celda(fecha: string, mes: number, mas: number): Celda {
    const info = this.dias().get(fecha) ?? diaVacio(fecha);
    // La madrugada de algo que empezó el día anterior ya se ve en ese día.
    const activas = info.actividades.filter((a) => !a.cancelada && a.parte !== 'viene');
    const vistos = new Set<number>();
    const puntos = activas
      .filter((a) => !vistos.has(a.calendario_id) && vistos.add(a.calendario_id))
      .map((a) => ({ clave: String(a.calendario_id), color: a.color }));
    const choque = activas.some((a) => a.choques.length);
    const partes = [diaCorto(fecha)];
    for (const t of info.turnos)
      partes.push(`${t.calendario.nombre}: ${TURNOS[t.turno.codigo].nombre}`);
    const vence = info.deadlines.filter((d) => d.momento === 'vence').length;
    if (vence) partes.push(`${vence} ${vence === 1 ? 'deadline vence' : 'deadlines vencen'}`);
    if (activas.length) partes.push(`${activas.length} actividades`);
    if (choque) partes.push('choque de horario');
    const chipsVisibles = 2;
    return {
      fecha,
      numero: numeroDia(fecha),
      enMes: mesDe(fecha) === mes,
      hoy: fecha === this.hoy(),
      seleccionada: fecha === this.seleccionado(),
      aria: partes.join(', '),
      puntos,
      choque,
      chips: [...activas]
        .sort((a, b) => Number(a.semanal) - Number(b.semanal))
        .slice(0, chipsVisibles),
      mas: mas + Math.max(0, activas.length - chipsVisibles),
    };
  }
}
