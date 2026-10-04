import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DeseosTab } from './deseos-tab';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';
import { ListaDeseosItem } from '../../../../models/finanzas.model';

function deseo(partial: Partial<ListaDeseosItem>): ListaDeseosItem {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Item',
    presupuesto: 0,
    valor_estimado: 0,
    comprado: false,
    justificacion: null,
    fecha_creacion: '',
    fecha_actualizacion: '',
    grupo_item_finanzas_id: null,
    grupo_item_finanzas_nombre: null,
    eliminado: false,
    ...partial,
  };
}

describe('DeseosTab', () => {
  let component: DeseosTab;
  let fixture: ComponentFixture<DeseosTab>;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;
  let pendingSpy: import('vitest').Mock<(v: number) => void>;

  const initial: ListaDeseosItem[] = [
    deseo({ id: 1, nombre: 'Bicicleta', presupuesto: 300, valor_estimado: 250, comprado: false, grupo_item_finanzas_id: 10, grupo_item_finanzas_nombre: 'Deporte' }),
    deseo({ id: 2, nombre: 'Monitor', presupuesto: 200, valor_estimado: 180, comprado: true, justificacion: 'Para trabajar', grupo_item_finanzas_id: 20 }),
    deseo({ id: 3, nombre: 'Libro', presupuesto: 20, valor_estimado: 15, comprado: false, grupo_item_finanzas_id: 20 }),
  ];

  async function setup(list: ListaDeseosItem[] | null = initial) {
    finanzas = {
      getListaDeseos: vi.fn().mockReturnValue(of(list)),
      createListaDeseos: vi.fn(),
      updateListaDeseos: vi.fn(),
      deleteListaDeseos: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [DeseosTab],
      providers: [provideRouter([]), { provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(DeseosTab);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(toast, 'info');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    pendingSpy = vi.fn<(v: number) => void>();
    component.pendingCountChange.subscribe((v) => pendingSpy(v));
    await fixture.whenStable();
  }

  describe('with data', () => {
    beforeEach(() => setup());

    it('should create and load the list on init, emitting pending count', () => {
      expect(component).toBeTruthy();
      expect(finanzas['getListaDeseos']).toHaveBeenCalled();
      expect(component.listaDeseos().length).toBe(3);
      expect(component.isLoadingDeseos()).toBe(false);
      expect(pendingSpy).toHaveBeenCalledWith(2);
    });

    it('should compute totals and counts', () => {
      expect(component.totalPresupuestoDeseos()).toBe(520);
      expect(component.totalEstimadoPendienteDeseos()).toBe(265);
      expect(component.totalEstimadoCompradoDeseos()).toBe(180);
      expect(component.deseosPendientesCount()).toBe(2);
      expect(component.deseosCompradosCount()).toBe(1);
    });

    it('should filter by estado', () => {
      component.filtroDeseos.set('pendientes');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([1, 3]);
      component.filtroDeseos.set('comprados');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([2]);
      component.filtroDeseos.set('todos');
      expect(component.deseosFiltrados().length).toBe(3);
    });

    it('should filter by grupo', () => {
      component.filtroDeseosGrupo.set(20);
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([2, 3]);
    });

    it('should search by nombre, justificacion and grupo nombre (case-insensitive)', () => {
      component.busquedaDeseos.set('  BICI ');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([1]);
      component.busquedaDeseos.set('trabajar');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([2]);
      component.busquedaDeseos.set('deporte');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([1]);
    });

    it('should combine search, estado and grupo filters', () => {
      component.filtroDeseosGrupo.set(20);
      component.filtroDeseos.set('pendientes');
      expect(component.deseosFiltrados().map((d) => d.id)).toEqual([3]);
    });

    it('openCreateDeseoModal should reset the form', () => {
      component.formDeseoNombre.set('x');
      component.formDeseoComprado.set(true);
      component.openCreateDeseoModal();
      expect(component.showDeseoModal()).toBe(true);
      expect(component.isEditingDeseo()).toBe(false);
      expect(component.editingDeseoId()).toBeNull();
      expect(component.formDeseoNombre()).toBe('');
      expect(component.formDeseoComprado()).toBe(false);
      expect(component.formDeseoPresupuesto()).toBeNull();
    });

    it('openEditDeseoModal should populate the form and stop propagation', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.openEditDeseoModal(initial[1], event);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.isEditingDeseo()).toBe(true);
      expect(component.editingDeseoId()).toBe(2);
      expect(component.formDeseoNombre()).toBe('Monitor');
      expect(component.formDeseoPresupuesto()).toBe(200);
      expect(component.formDeseoValorEstimado()).toBe(180);
      expect(component.formDeseoJustificacion()).toBe('Para trabajar');
      expect(component.formDeseoGrupoId()).toBe(20);
      expect(component.formDeseoComprado()).toBe(true);
      expect(component.showDeseoModal()).toBe(true);
    });

    it('closeDeseoModal should hide the modal', () => {
      component.showDeseoModal.set(true);
      component.closeDeseoModal();
      expect(component.showDeseoModal()).toBe(false);
    });

    describe('saveDeseo', () => {
      it('should reject an empty name', () => {
        component.openCreateDeseoModal();
        component.formDeseoNombre.set('   ');
        component.saveDeseo();
        expect(toast.error).toHaveBeenCalledWith('El nombre del deseo es obligatorio');
        expect(finanzas['createListaDeseos']).not.toHaveBeenCalled();
      });

      it('should create a new deseo and prepend it', () => {
        const created = deseo({ id: 99, nombre: 'Cámara', comprado: false });
        finanzas['createListaDeseos'].mockReturnValue(of(created));
        component.openCreateDeseoModal();
        component.formDeseoNombre.set(' Cámara ');
        component.formDeseoPresupuesto.set(500);
        component.formDeseoJustificacion.set('   ');
        component.formDeseoGrupoId.set(10);
        pendingSpy.mockClear();

        component.saveDeseo();

        expect(finanzas['createListaDeseos']).toHaveBeenCalledWith({
          nombre: 'Cámara',
          presupuesto: 500,
          valor_estimado: 0,
          comprado: false,
          justificacion: null,
          grupo_item_finanzas_id: 10,
        });
        expect(component.listaDeseos()[0]).toBe(created);
        expect(toast.success).toHaveBeenCalledWith('Deseo agregado a la lista');
        expect(component.showDeseoModal()).toBe(false);
        expect(component.isSubmittingDeseo()).toBe(false);
        expect(pendingSpy).toHaveBeenCalledWith(3);
      });

      it('should show an error toast when creation fails', () => {
        finanzas['createListaDeseos'].mockReturnValue(throwError(() => new Error('x')));
        component.openCreateDeseoModal();
        component.formDeseoNombre.set('Cámara');
        component.saveDeseo();
        expect(toast.error).toHaveBeenCalledWith('No se pudo crear el deseo');
        expect(component.isSubmittingDeseo()).toBe(false);
        expect(component.showDeseoModal()).toBe(true);
        expect(component.listaDeseos().length).toBe(3);
      });

      it('should update an existing deseo in place', () => {
        const updated = { ...initial[0], nombre: 'Bici nueva', comprado: true };
        finanzas['updateListaDeseos'].mockReturnValue(of(updated));
        component.openEditDeseoModal(initial[0]);
        component.formDeseoNombre.set('Bici nueva');
        component.formDeseoComprado.set(true);
        pendingSpy.mockClear();

        component.saveDeseo();

        expect(finanzas['updateListaDeseos']).toHaveBeenCalledWith(1, {
          nombre: 'Bici nueva',
          presupuesto: 300,
          valor_estimado: 250,
          comprado: true,
          justificacion: null,
          grupo_item_finanzas_id: 10,
        });
        expect(component.listaDeseos().find((d) => d.id === 1)).toBe(updated);
        expect(toast.success).toHaveBeenCalledWith('Deseo actualizado correctamente');
        expect(component.showDeseoModal()).toBe(false);
        expect(pendingSpy).toHaveBeenCalledWith(1);
      });

      it('should show an error toast when update fails', () => {
        finanzas['updateListaDeseos'].mockReturnValue(throwError(() => new Error('x')));
        component.openEditDeseoModal(initial[0]);
        component.saveDeseo();
        expect(toast.error).toHaveBeenCalledWith('No se pudo actualizar el deseo');
        expect(component.isSubmittingDeseo()).toBe(false);
      });
    });

    describe('toggleCompradoDeseo', () => {
      it('should mark a pending deseo as comprado', () => {
        finanzas['updateListaDeseos'].mockReturnValue(of({ ...initial[0], comprado: true }));
        pendingSpy.mockClear();
        component.toggleCompradoDeseo(initial[0]);
        expect(finanzas['updateListaDeseos']).toHaveBeenCalledWith(1, { comprado: true });
        expect(component.listaDeseos().find((d) => d.id === 1)!.comprado).toBe(true);
        expect(toast.success).toHaveBeenCalled();
        expect(pendingSpy).toHaveBeenCalledWith(1);
      });

      it('should mark a comprado deseo back as pending with an info toast', () => {
        finanzas['updateListaDeseos'].mockReturnValue(of({ ...initial[1], comprado: false }));
        component.toggleCompradoDeseo(initial[1]);
        expect(finanzas['updateListaDeseos']).toHaveBeenCalledWith(2, { comprado: false });
        expect(toast.info).toHaveBeenCalledWith('"Monitor" vuelto a marcar como pendiente.');
        expect(component.deseosPendientesCount()).toBe(3);
      });

      it('should show an error toast on failure', () => {
        finanzas['updateListaDeseos'].mockReturnValue(throwError(() => new Error('x')));
        component.toggleCompradoDeseo(initial[0]);
        expect(toast.error).toHaveBeenCalledWith('Error al cambiar estado');
        expect(component.listaDeseos()[0].comprado).toBe(false);
      });
    });

    describe('delete', () => {
      it('promptDeleteDeseo / cancelDeleteDeseo should manage the pending item', () => {
        component.promptDeleteDeseo(initial[2]);
        expect(component.deseoToDelete()).toBe(initial[2]);
        component.cancelDeleteDeseo();
        expect(component.deseoToDelete()).toBeNull();
      });

      it('confirmDeleteDeseo should do nothing without a pending item', () => {
        component.confirmDeleteDeseo();
        expect(finanzas['deleteListaDeseos']).not.toHaveBeenCalled();
      });

      it('confirmDeleteDeseo should remove the item and emit the new pending count', () => {
        component.promptDeleteDeseo(initial[0]);
        pendingSpy.mockClear();
        component.confirmDeleteDeseo();
        expect(finanzas['deleteListaDeseos']).toHaveBeenCalledWith(1);
        expect(component.listaDeseos().map((d) => d.id)).toEqual([2, 3]);
        expect(component.deseoToDelete()).toBeNull();
        expect(component.isDeletingDeseo()).toBe(false);
        expect(toast.success).toHaveBeenCalledWith('Deseo eliminado');
        expect(pendingSpy).toHaveBeenCalledWith(1);
      });

      it('confirmDeleteDeseo should keep the item on failure', () => {
        finanzas['deleteListaDeseos'].mockReturnValue(throwError(() => new Error('x')));
        component.promptDeleteDeseo(initial[0]);
        component.confirmDeleteDeseo();
        expect(toast.error).toHaveBeenCalledWith('Error al eliminar deseo');
        expect(component.listaDeseos().length).toBe(3);
        expect(component.deseoToDelete()).toBe(initial[0]);
        expect(component.isDeletingDeseo()).toBe(false);
      });
    });

    it('formatCurrency should format CLP and treat falsy as 0', () => {
      expect(component.formatCurrency(1500)).toMatch(/1\.500/);
      expect(component.formatCurrency(0)).toMatch(/0/);
    });
  });

  it('should handle a null list from the API', async () => {
    await setup(null);
    expect(component.listaDeseos()).toEqual([]);
    expect(pendingSpy).toHaveBeenCalledWith(0);
  });

  it('should stop loading when the API fails', async () => {
    finanzas = {} as never;
    await TestBed.configureTestingModule({
      imports: [DeseosTab],
      providers: [
        provideRouter([]),
        {
          provide: FinanzasService,
          useValue: { getListaDeseos: vi.fn().mockReturnValue(throwError(() => new Error('x'))) },
        },
      ],
    }).compileComponents();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fixture = TestBed.createComponent(DeseosTab);
    await fixture.whenStable();
    expect(fixture.componentInstance.isLoadingDeseos()).toBe(false);
    expect(fixture.componentInstance.listaDeseos()).toEqual([]);
  });
});
