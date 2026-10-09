import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EventoActividad } from '../../../../models/actividad.model';
import { describirEvento, haceCuanto } from '../../../../utils/actividad.util';

interface DiaActividad {
  clave: string;
  fecha: Date;
  eventos: { evento: EventoActividad; texto: string }[];
}

/** "En qué quedaste": línea de tiempo de lo que pasó en el proyecto, por día. */
@Component({
  selector: 'app-activity-tab',
  imports: [DatePipe],
  templateUrl: './activity-tab.html',
})
export class ActivityTab {
  eventos = input<EventoActividad[]>([]);
  isLoading = input(false);
  /** Hay más eventos que los cargados (se pidió el límite y llegó completo). */
  hayMas = input(false);
  verMas = output<void>();

  readonly dias = computed<DiaActividad[]>(() => {
    const dias: DiaActividad[] = [];
    for (const e of this.eventos()) {
      const fecha = new Date(e.ocurrido_en);
      const clave = fecha.toDateString();
      let dia = dias.at(-1);
      if (!dia || dia.clave !== clave) {
        dia = { clave, fecha, eventos: [] };
        dias.push(dia);
      }
      dia.eventos.push({ evento: e, texto: describirEvento(e) });
    }
    return dias;
  });

  haceCuanto(fecha: Date): string {
    return haceCuanto(fecha);
  }
}
