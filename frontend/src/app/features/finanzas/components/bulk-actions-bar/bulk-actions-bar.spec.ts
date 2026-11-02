import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkActionsBar } from './bulk-actions-bar';

describe('BulkActionsBar', () => {
  let component: BulkActionsBar;
  let fixture: ComponentFixture<BulkActionsBar>;
  let el: HTMLElement;

  const byTitle = (title: string) => el.querySelector(`[title="${title}"]`) as HTMLButtonElement;
  const buttonWithText = (text: string) =>
    [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(text),
    ) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BulkActionsBar] }).compileComponents();
    fixture = TestBed.createComponent(BulkActionsBar);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('count', 2);
    fixture.componentRef.setInput('total', 2900);
    fixture.componentRef.setInput('grupos', [
      { id: 100, user_id: 1, nombre: 'Casa', fecha_creacion: '', eliminado: false },
    ]);
    fixture.componentRef.setInput('bancos', [
      { id: 1, user_id: 1, nombre: 'BCI', tipo: 'debito', fecha_creacion: '', eliminado: false },
    ]);
    await fixture.whenStable();
  });

  it('should show the selected count and total', () => {
    expect(el.textContent).toContain('2');
    expect(el.textContent).toMatch(/2\.900/);
  });

  it('estado buttons should emit the estado and respect processing', async () => {
    const estados: string[] = [];
    component.estadoChange.subscribe((e) => estados.push(e));
    byTitle('Marcar todos los seleccionados como completados').click();
    byTitle('Marcar todos los seleccionados como en proceso').click();
    byTitle('Marcar todos los seleccionados como pendientes').click();
    expect(estados).toEqual(['completado', 'en proceso', 'pendiente']);

    fixture.componentRef.setInput('processing', true);
    await fixture.whenStable();
    expect(byTitle('Marcar todos los seleccionados como completados').disabled).toBe(true);
  });

  it('categoría menu should toggle, close the banco menu and emit the choice', async () => {
    const categorias: (number | null)[] = [];
    component.categoriaChange.subscribe((c) => categorias.push(c));
    component.showBulkBancoMenu.set(true);

    byTitle('Asignar categoría en lote').click();
    await fixture.whenStable();
    expect(component.showBulkCategoryMenu()).toBe(true);
    expect(component.showBulkBancoMenu()).toBe(false);

    buttonWithText('Casa').click();
    buttonWithText('Sin categoría').click();
    expect(categorias).toEqual([100, null]);
  });

  it('banco menu should emit the choice', async () => {
    const bancos: (number | null)[] = [];
    component.bancoChange.subscribe((b) => bancos.push(b));
    byTitle('Asignar cuenta en lote').click();
    await fixture.whenStable();
    buttonWithText('BCI (debito)').click();
    buttonWithText('Sin cuenta').click();
    expect(bancos).toEqual([1, null]);
  });

  it('a click outside should close the menus, a click inside should not', async () => {
    // El clic en el botón burbujea hasta el documento salvo que la barra lo detenga.
    byTitle('Asignar categoría en lote').click();
    await fixture.whenStable();
    expect(component.showBulkCategoryMenu()).toBe(true);

    document.dispatchEvent(new MouseEvent('click'));
    expect(component.showBulkCategoryMenu()).toBe(false);
  });

  it('delete and clear should emit', () => {
    const removeSpy = vi.fn();
    const clearSpy = vi.fn();
    component.remove.subscribe(removeSpy);
    component.clear.subscribe(clearSpy);
    byTitle('Eliminar seleccionados').click();
    byTitle('Deseleccionar todo').click();
    expect(removeSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });
});
