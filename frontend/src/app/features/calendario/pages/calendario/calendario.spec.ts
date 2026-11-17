import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { setupHttpTesting, settle } from '../../../../../testing/http-testing';
import { CalendarioPage } from './calendario';
import { CalendarioRango } from '../../data/calendario.model';
import { sumarDias } from '../../utils/dias.util';

function rangoDe(hoy: string, desde: string, hasta: string): CalendarioRango {
  return {
    desde,
    hasta,
    ocultar_deadlines: false,
    calendarios: [
      {
        id: 1,
        nombre: 'Turnos mamá',
        color: '#c297ff',
        tipo: 'turnos',
        oculto: false,
        disponibilidad: 'contexto',
        primer_largo: hoy,
      },
      {
        id: 2,
        nombre: 'Hijo',
        color: '#58a6ff',
        tipo: 'actividades',
        oculto: false,
        disponibilidad: 'ocupa',
      },
    ],
    deadlines: [
      {
        tipo: 'tarea',
        id: 9,
        titulo: 'Llamar al banco',
        proyecto_id: 3,
        proyecto_nombre: 'Finanzas',
        estado: 'Abierto',
        fecha_limite: sumarDias(hoy, -2),
      },
    ],
    turnos: [{ calendario_id: 1, fecha: hoy, codigo: 'L', base: 'L', cambio: false }],
    ocurrencias: [
      {
        actividad_id: 1,
        calendario_id: 2,
        fecha: hoy,
        titulo: 'Terapia',
        hora_inicio: '16:00',
        hora_fin: '17:00',
        semanal: true,
        cancelada: false,
      },
      {
        actividad_id: 2,
        calendario_id: 2,
        fecha: hoy,
        titulo: 'Reunión',
        hora_inicio: '16:30',
        hora_fin: '17:30',
        semanal: false,
        cancelada: false,
      },
    ],
    bloques: [
      {
        id: 5,
        tarea_id: 41,
        tarea: 'Informe',
        proyecto_id: 3,
        proyecto_nombre: 'Finanzas',
        estado: 'Abierto',
        fecha: hoy,
        hora_inicio: '09:00',
        hora_fin: '10:30',
        origen: 'mcp',
      },
    ],
    tiempo_libre: [],
  };
}

describe('CalendarioPage', () => {
  let fixture: ComponentFixture<CalendarioPage>;
  let component: CalendarioPage;
  let http: HttpTestingController;

  /** Responde todas las peticiones de rango (y la lista de proyectos) pendientes. */
  async function responder() {
    for (const req of http.match((r) => r.url.endsWith('/proyects'))) {
      req.flush([{ id: 3, nombre: 'Finanzas' }]);
    }
    for (const req of http.match((r) => r.url.endsWith('/calendario'))) {
      const p = req.request.params;
      req.flush(rangoDe(component.hoy, p.get('desde')!, p.get('hasta')!));
    }
    await settle();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    try {
      localStorage.removeItem('cassandra.calendario.vista');
      localStorage.removeItem('cassandra.calendario.planificado');
    } catch {
      // sin almacenamiento
    }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    http = setupHttpTesting();
    fixture = TestBed.createComponent(CalendarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.tick();
    await responder();
  });

  afterEach(() => http.verify());

  it('pide el mes y los próximos 7 días con la fecha local de hoy', () => {
    expect(component.vista()).toBe('mes');
    expect(component.rango()?.calendarios).toHaveLength(2);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Calendario');
    expect(texto).toContain('1 vencido ·');
    expect(texto).toContain('1 choque');
  });

  it('marca el choque en la agenda del día', () => {
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Choca con Reunión');
    expect(texto).toContain('Turnos mamá · Largo 08:00–20:00');
  });

  it('oculta la capa de deadlines y lo guarda en la cuenta', async () => {
    const capa = component.capas().find((c) => c.clave === 'deadlines')!;
    component.alternarCapa(capa);
    const req = http.expectOne((r) => r.url.endsWith('/preferencias'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ocultar_deadlines: true });
    req.flush({ dia_revision: 0, limite_en_curso: 5, ocultar_deadlines: true });
    expect(component.visibles().deadlines).toBe(false);
  });

  it('primer toque trae el bloque al frente y el segundo abre sus opciones', () => {
    const dia = component.dias().get(component.hoy)!;
    const bloque = {
      clave: `${component.hoy}|2`,
      actividad: dia.actividades.find((a) => a.actividad_id === 2)!,
      inicio: 16.5,
      fin: 17.5,
      col: 1,
      corto: false,
      aria: '',
    };
    component.tocarBloque(bloque);
    expect(component.frente()).toBe(bloque.clave);
    expect(component.hoja()).toBeNull();
    component.tocarBloque(bloque);
    expect(component.hoja()).toEqual({ tipo: 'ocurrencia', actividad: bloque.actividad });
  });

  it('muestra los bloques de trabajo como la capa Planificado, que se oculta sin el servidor', () => {
    const capa = component.capas().find((c) => c.clave === 'planificado')!;
    expect(capa).toMatchObject({ nombre: 'Planificado', visible: true });
    expect(fixture.nativeElement.textContent).toContain('Informe');

    component.alternarCapa(capa);
    http.expectNone((r) => r.method === 'PUT');
    expect(component.visibles().planificado).toBe(false);
    expect(localStorage.getItem('cassandra.calendario.planificado')).toBe('oculto');
    expect(
      component
        .dias()
        .get(component.hoy)!
        .actividades.some((a) => a.trabajo),
    ).toBe(false);
    // Sigue en la lista para poder volver a mostrarla.
    expect(component.capas().some((c) => c.clave === 'planificado')).toBe(true);
  });

  it('un bloque de trabajo abre sus opciones y se puede quitar', async () => {
    const trabajo = component
      .dias()
      .get(component.hoy)!
      .actividades.find((a) => a.trabajo)!;
    component.abrirOcurrencia(trabajo);
    fixture.detectChanges();
    expect(component.hoja()).toMatchObject({ tipo: 'trabajo', bloque: { id: 5 } });
    const texto = document.body.textContent as string;
    expect(texto).toContain('lo planificó el asistente');
    expect(texto).toContain('Tarea #41');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.quitarBloque(trabajo.trabajo!);
    const req = http.expectOne((r) => r.url.endsWith('/calendario/bloques/5'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    TestBed.tick();
    await responder();
    expect(component.hoja()).toBeNull();
  });

  it('desde un bloque de trabajo abre el detalle completo de su tarea', async () => {
    const trabajo = component
      .dias()
      .get(component.hoy)!
      .actividades.find((a) => a.trabajo)!;
    component.abrirOcurrencia(trabajo);
    fixture.detectChanges();
    Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Abrir tarea')!
      .click();
    http
      .expectOne((r) => r.url.endsWith('/tareas/41'))
      .flush({
        id: 41,
        nombre: 'Informe',
        estado: 'Abierto',
        prioridad: 'normal',
        proyect_id: 3,
        subtareas: [],
      });
    fixture.detectChanges();
    expect(component.hoja()).toBeNull();
    expect(component.tareaAbierta()).toMatchObject({ id: 41, proyect_id: 3 });
    TestBed.tick();
    // El detalle carga las notas de la tarea, como en Proyectos.
    for (const req of http.match(() => true)) req.flush([]);
    await settle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-task-detail-modal').textContent).toContain(
      '#41',
    );
  });

  it('un deadline de tarea abre su detalle y uno de proyecto lleva al proyecto', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const base = {
      titulo: 'X',
      proyecto_id: 3,
      proyecto_nombre: 'Finanzas',
      estado: 'Abierto',
      fecha_limite: component.hoy,
    };
    component.abrirDeadline({ ...base, tipo: 'tarea', id: 41 });
    http.expectOne((r) => r.url.endsWith('/tareas/41')).flush({ id: 41, proyect_id: 3 });
    expect(component.tareaAbierta()).toMatchObject({ id: 41 });
    expect(navigate).not.toHaveBeenCalled();
    component.tareaAbierta.set(null);

    component.abrirDeadline({ ...base, tipo: 'proyecto', id: 3 });
    expect(navigate).toHaveBeenCalledWith(['/proyectos', 3]);
  });

  it('planifica una tarea desde el día visible y recarga al reservar', async () => {
    component.planificarTarea();
    fixture.detectChanges();
    TestBed.tick();
    expect(component.tituloHoja()).toBe('Planificar tarea');
    expect(document.body.querySelector('app-reservar-tiempo')).not.toBeNull();
    expect(component.proyectos()).toEqual([{ id: 3, nombre: 'Finanzas' }]);
    const huecos = http.expectOne((r) => r.url.endsWith('/integrations/calendar'));
    expect(huecos.request.params.get('desde')).toBe(component.cursor());
    huecos.flush({ huecos: [] });

    component.bloqueReservado({ bloques: [], avisos: null });
    fixture.detectChanges();
    expect(component.hoja()).toBeNull();
    await responder();
  });

  it('cambia de vista y pide el nuevo rango', async () => {
    component.cambiarVista('sem');
    fixture.detectChanges();
    TestBed.tick();
    const req = http.expectOne((r) => r.url.endsWith('/calendario'));
    expect(req.request.params.get('hasta')).toBe(sumarDias(req.request.params.get('desde')!, 6));
    req.flush(
      rangoDe(component.hoy, req.request.params.get('desde')!, req.request.params.get('hasta')!),
    );
    await settle();
  });
});
