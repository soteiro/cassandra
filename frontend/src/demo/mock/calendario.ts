/**
 * Cálculo del calendario: el mismo que hace el backend en internal/calendario y
 * repository/planificacion_repository.go (turnos por ciclo, ocurrencias y tiempo libre).
 */
import type {
  CodigoTurno,
  FranjaHorario,
  HuecoLibre,
  OcurrenciaDia,
  TurnoDia,
} from '../../app/features/calendario/data/calendario.model';
import type { DemoDB, CalendarioRow, BloqueRow } from './db';
import { diaSemana, diasEntre, formatoHora, minutos, parseDia, sumarDias } from './fechas';

const CUARTO_TURNO: CodigoTurno[] = ['L', 'N', 'S', 'F'];
const MINUTOS_DIA = 24 * 60;
const MINUTOS_HUECO_MINIMO = 15;

interface Intervalo {
  ini: number;
  fin: number;
}

function turnoBase(dia: string, cal: CalendarioRow): CodigoTurno | '' {
  const ciclos = [...cal.ciclos].sort((a, b) => a.desde.localeCompare(b.desde));
  let vigente: { desde: string; ancla: string } | null = null;
  for (const c of ciclos) {
    if (c.desde <= dia) vigente = c;
  }
  if (!vigente) return '';
  const n = CUARTO_TURNO.length;
  return CUARTO_TURNO[((diasEntre(vigente.ancla, dia) % n) + n) % n];
}

export function turnos(cal: CalendarioRow, desde: string, hasta: string): TurnoDia[] {
  const out: TurnoDia[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const base = turnoBase(d, cal);
    const codigo = (cal.excepciones[d] as CodigoTurno | undefined) ?? base;
    if (!codigo) continue;
    out.push({ calendario_id: cal.id, fecha: d, codigo, base, cambio: codigo !== base });
  }
  return out;
}

const cruzaMedianoche = (ini: string, fin: string) => minutos(fin) <= minutos(ini);

/** Ocurrencias del rango, más las del día anterior que cruzan la medianoche. */
export function ocurrencias(db: DemoDB, desde: string, hasta: string): OcurrenciaDia[] {
  const calendarios = new Set(db.calendarios.map((c) => c.id));
  const out: OcurrenciaDia[] = [];
  const previo = sumarDias(desde, -1);
  for (const a of db.actividades) {
    if (!calendarios.has(a.calendario_id)) continue;
    const dias = new Set(a.dias_semana);
    const fin = a.hasta && a.hasta < hasta ? a.hasta : hasta;
    for (let d = previo; d <= fin; d = sumarDias(d, 1)) {
      const ocurre =
        a.dias_semana.length === 0 ? d === a.fecha : d >= a.fecha && dias.has(diaSemana(d));
      if (!ocurre) continue;
      if (d === previo && !cruzaMedianoche(a.hora_inicio, a.hora_fin)) continue;
      out.push({
        actividad_id: a.id,
        calendario_id: a.calendario_id,
        fecha: d,
        titulo: a.titulo,
        hora_inicio: a.hora_inicio,
        hora_fin: a.hora_fin,
        semanal: a.dias_semana.length > 0,
        cancelada: a.cancelaciones.includes(d),
      });
    }
  }
  return out.sort(
    (x, y) => x.fecha.localeCompare(y.fecha) || x.hora_inicio.localeCompare(y.hora_inicio),
  );
}

function unir(xs: Intervalo[]): Intervalo[] {
  const out = xs.filter((x) => x.fin > x.ini).sort((a, b) => a.ini - b.ini);
  const res: Intervalo[] = [];
  for (const x of out) {
    const ultimo = res[res.length - 1];
    if (ultimo && x.ini <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, x.fin);
    } else {
      res.push({ ...x });
    }
  }
  return res;
}

function restar(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const out: Intervalo[] = [];
  for (const x of a) {
    let ini = x.ini;
    for (const y of b) {
      if (y.fin <= ini || y.ini >= x.fin) continue;
      if (y.ini > ini) out.push({ ini, fin: y.ini });
      ini = Math.max(ini, y.fin);
    }
    if (ini < x.fin) out.push({ ini, fin: x.fin });
  }
  return out;
}

const HORARIO_TURNO: Partial<Record<CodigoTurno, Intervalo>> = {
  L: { ini: 8 * 60, fin: 20 * 60 },
  N: { ini: 20 * 60, fin: MINUTOS_DIA + 8 * 60 },
};

/**
 * Tiempo libre del rango: horario base más lo que libera, menos lo que ocupa.
 * `inicio` (minutos desde las 00:00 de `desde`) recorta lo que ya pasó.
 */
export function huecos(
  db: DemoDB,
  desde: string,
  hasta: string,
  bloques: BloqueRow[],
  inicio = 0,
): HuecoLibre[] {
  const disp = new Map(db.calendarios.map((c) => [c.id, c.disponibilidad]));
  const offset = (fecha: string) => diasEntre(desde, fecha) * MINUTOS_DIA;
  const libera: Intervalo[] = [];
  const ocupa: Intervalo[] = [];
  const agregar = (tipo: string | undefined, x: Intervalo) => {
    if (tipo === 'ocupa') ocupa.push(x);
    if (tipo === 'libera') libera.push(x);
  };

  for (const cal of db.calendarios) {
    if (cal.tipo !== 'turnos') continue;
    for (const t of turnos(cal, sumarDias(desde, -1), hasta)) {
      const h = HORARIO_TURNO[t.codigo];
      if (h)
        agregar(cal.disponibilidad, { ini: offset(t.fecha) + h.ini, fin: offset(t.fecha) + h.fin });
    }
  }
  for (const oc of ocurrencias(db, desde, hasta)) {
    if (oc.cancelada) continue;
    const o = offset(oc.fecha);
    let fin = minutos(oc.hora_fin);
    if (cruzaMedianoche(oc.hora_inicio, oc.hora_fin)) fin += MINUTOS_DIA;
    agregar(disp.get(oc.calendario_id), { ini: o + minutos(oc.hora_inicio), fin: o + fin });
  }
  for (const b of bloques) {
    const o = offset(b.fecha);
    ocupa.push({ ini: o + minutos(b.hora_inicio), fin: o + minutos(b.hora_fin) });
  }

  const dias = diasEntre(desde, hasta) + 1;
  const disponible = [...libera];
  for (let d = 0; d < dias; d++) {
    const ds = diaSemana(sumarDias(desde, d));
    for (const f of db.horarioBase) {
      if (f.dia_semana === ds) {
        disponible.push({
          ini: d * MINUTOS_DIA + minutos(f.hora_inicio),
          fin: d * MINUTOS_DIA + minutos(f.hora_fin),
        });
      }
    }
  }
  const limiteIni = Math.max(0, inicio);
  const libre = restar(
    unir(disponible),
    unir([
      ...ocupa,
      { ini: -MINUTOS_DIA, fin: limiteIni },
      { ini: dias * MINUTOS_DIA, fin: (dias + 1) * MINUTOS_DIA },
    ]),
  );

  const out: HuecoLibre[] = [];
  for (const x of libre) {
    for (let ini = x.ini; ini < x.fin;) {
      const d = Math.floor(ini / MINUTOS_DIA);
      const fin = Math.min(x.fin, (d + 1) * MINUTOS_DIA);
      if (fin - ini >= MINUTOS_HUECO_MINIMO) {
        out.push({
          fecha: sumarDias(desde, d),
          hora_inicio: formatoHora(ini - d * MINUTOS_DIA),
          hora_fin: formatoHora(fin - d * MINUTOS_DIA),
          minutos: fin - ini,
        });
      }
      ini = fin;
    }
  }
  return out;
}

/** Minutos desde las 00:00 de `desde` hasta "YYYY-MM-DDTHH:MM" (hora local). */
export function minutosDesde(desde: string, ahora: string): number {
  const [dia, hora = '00:00'] = ahora.split('T');
  return diasEntre(desde, dia) * MINUTOS_DIA + minutos(hora.slice(0, 5));
}

export function ordenarFranjas(fs: FranjaHorario[]): FranjaHorario[] {
  return [...fs].sort(
    (a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio),
  );
}

export { parseDia };
