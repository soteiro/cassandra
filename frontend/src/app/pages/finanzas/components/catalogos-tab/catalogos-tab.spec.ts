import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CatalogosTab } from './catalogos-tab';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';

describe('CatalogosTab', () => {
  let component: CatalogosTab;
  let fixture: ComponentFixture<CatalogosTab>;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;
  let reloadSpy: import('vitest').Mock<() => void>;

  beforeEach(async () => {
    finanzas = {
      createBanco: vi.fn().mockReturnValue(of({})),
      deleteBanco: vi.fn().mockReturnValue(of(undefined)),
      createGrupo: vi.fn().mockReturnValue(of({})),
      deleteGrupo: vi.fn().mockReturnValue(of(undefined)),
      createMovimientoEsperado: vi.fn().mockReturnValue(of({})),
      deleteMovimientoEsperado: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [CatalogosTab],
      providers: [{ provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogosTab);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reloadSpy = vi.fn<() => void>();
    component.reload.subscribe(() => reloadSpy());
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept catalog inputs', async () => {
    const banco = { id: 1, user_id: 1, nombre: 'BCI', tipo: 'debito', fecha_creacion: '', eliminado: false };
    fixture.componentRef.setInput('bancos', [banco]);
    await fixture.whenStable();
    expect(component.bancos()).toEqual([banco]);
  });

  describe('createBanco', () => {
    it('should do nothing when the name is blank', () => {
      component.newBancoNombre.set('   ');
      component.createBanco();
      expect(finanzas['createBanco']).not.toHaveBeenCalled();
    });

    it('should create with trimmed name and selected type, then reset and emit reload', () => {
      component.newBancoNombre.set('  Santander ');
      component.newBancoTipo.set('credito');
      component.createBanco();
      expect(finanzas['createBanco']).toHaveBeenCalledWith({ nombre: 'Santander', tipo: 'credito' });
      expect(toast.success).toHaveBeenCalledWith('Cuenta "Santander" agregada');
      expect(component.newBancoNombre()).toBe('');
      expect(component.isSubmittingBanco()).toBe(false);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('should show an error toast and keep the name on failure', () => {
      finanzas['createBanco'].mockReturnValue(throwError(() => new Error('boom')));
      component.newBancoNombre.set('Santander');
      component.createBanco();
      expect(toast.error).toHaveBeenCalledWith('Error al crear cuenta/banco');
      expect(component.newBancoNombre()).toBe('Santander');
      expect(component.isSubmittingBanco()).toBe(false);
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteBanco', () => {
    it('should delete and emit reload', () => {
      component.deleteBanco(7);
      expect(finanzas['deleteBanco']).toHaveBeenCalledWith(7);
      expect(toast.success).toHaveBeenCalledWith('Cuenta eliminada');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should show an error toast on failure', () => {
      finanzas['deleteBanco'].mockReturnValue(throwError(() => new Error('x')));
      component.deleteBanco(7);
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar cuenta');
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('createGrupo', () => {
    it('should ignore blank names', () => {
      component.newGrupoNombre.set('');
      component.createGrupo();
      expect(finanzas['createGrupo']).not.toHaveBeenCalled();
    });

    it('should create and emit reload', () => {
      component.newGrupoNombre.set(' Comida ');
      component.createGrupo();
      expect(finanzas['createGrupo']).toHaveBeenCalledWith({ nombre: 'Comida' });
      expect(toast.success).toHaveBeenCalledWith('Categoría "Comida" agregada');
      expect(component.newGrupoNombre()).toBe('');
      expect(component.isSubmittingGrupo()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should show an error toast on failure', () => {
      finanzas['createGrupo'].mockReturnValue(throwError(() => new Error('x')));
      component.newGrupoNombre.set('Comida');
      component.createGrupo();
      expect(toast.error).toHaveBeenCalledWith('Error al crear categoría');
      expect(component.isSubmittingGrupo()).toBe(false);
    });
  });

  describe('deleteGrupo', () => {
    it('should delete and emit reload', () => {
      component.deleteGrupo(3);
      expect(finanzas['deleteGrupo']).toHaveBeenCalledWith(3);
      expect(toast.success).toHaveBeenCalledWith('Categoría eliminada');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should show an error toast on failure', () => {
      finanzas['deleteGrupo'].mockReturnValue(throwError(() => new Error('x')));
      component.deleteGrupo(3);
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar categoría');
    });
  });

  describe('createMovimientoEsperado', () => {
    it('should ignore blank names', () => {
      component.newMovimientoNombre.set('  ');
      component.createMovimientoEsperado();
      expect(finanzas['createMovimientoEsperado']).not.toHaveBeenCalled();
    });

    it('should create and emit reload', () => {
      component.newMovimientoNombre.set('PAC');
      component.createMovimientoEsperado();
      expect(finanzas['createMovimientoEsperado']).toHaveBeenCalledWith({ nombre: 'PAC' });
      expect(toast.success).toHaveBeenCalledWith('Mecanismo "PAC" agregado');
      expect(component.newMovimientoNombre()).toBe('');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should show an error toast on failure', () => {
      finanzas['createMovimientoEsperado'].mockReturnValue(throwError(() => new Error('x')));
      component.newMovimientoNombre.set('PAC');
      component.createMovimientoEsperado();
      expect(toast.error).toHaveBeenCalledWith('Error al crear mecanismo de pago');
      expect(component.isSubmittingMovimiento()).toBe(false);
    });
  });

  describe('deleteMovimientoEsperado', () => {
    it('should delete and emit reload', () => {
      component.deleteMovimientoEsperado(9);
      expect(finanzas['deleteMovimientoEsperado']).toHaveBeenCalledWith(9);
      expect(toast.success).toHaveBeenCalledWith('Mecanismo de pago eliminado');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should show an error toast on failure', () => {
      finanzas['deleteMovimientoEsperado'].mockReturnValue(throwError(() => new Error('x')));
      component.deleteMovimientoEsperado(9);
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar mecanismo');
    });
  });
});
