import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';
import {
  Banco,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
  TipoBanco,
} from '../../../../models/finanzas.model';
import {
  LucideLandmark,
  LucideTag,
  LucideSlidersHorizontal,
  LucideTrash2,
} from '@lucide/angular';

@Component({
  selector: 'app-catalogos-tab',
  imports: [
    CommonModule,
    FormsModule,
    LucideLandmark,
    LucideTag,
    LucideSlidersHorizontal,
    LucideTrash2,
  ],
  templateUrl: './catalogos-tab.html',
})
export class CatalogosTab {
  bancos = input<Banco[]>([]);
  grupos = input<GrupoItemFinanzas[]>([]);
  movimientosEsperados = input<MovimientoEsperadoFinanzas[]>([]);

  reload = output<void>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  readonly tiposBanco: { value: TipoBanco; label: string }[] = [
    { value: 'debito', label: 'Débito' },
    { value: 'credito', label: 'Crédito' },
    { value: 'prepago', label: 'Prepago / Billetera' },
    { value: 'efectivo', label: 'Efectivo' },
  ];

  newBancoNombre = signal<string>('');
  newBancoTipo = signal<TipoBanco>('debito');
  isSubmittingBanco = signal<boolean>(false);

  newGrupoNombre = signal<string>('');
  isSubmittingGrupo = signal<boolean>(false);

  newMovimientoNombre = signal<string>('');
  isSubmittingMovimiento = signal<boolean>(false);

  createBanco(): void {
    const nombre = this.newBancoNombre().trim();
    if (!nombre) return;

    this.isSubmittingBanco.set(true);
    this.finanzasService
      .createBanco({ nombre, tipo: this.newBancoTipo() })
      .subscribe({
        next: () => {
          this.toastService.success(`Cuenta "${nombre}" agregada`);
          this.newBancoNombre.set('');
          this.isSubmittingBanco.set(false);
          this.reload.emit();
        },
        error: (err) => {
          this.toastService.error('Error al crear cuenta/banco');
          this.isSubmittingBanco.set(false);
          console.error(err);
        },
      });
  }

  deleteBanco(id: number): void {
    this.finanzasService.deleteBanco(id).subscribe({
      next: () => {
        this.toastService.success('Cuenta eliminada');
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar cuenta');
        console.error(err);
      },
    });
  }

  createGrupo(): void {
    const nombre = this.newGrupoNombre().trim();
    if (!nombre) return;

    this.isSubmittingGrupo.set(true);
    this.finanzasService.createGrupo({ nombre }).subscribe({
      next: () => {
        this.toastService.success(`Categoría "${nombre}" agregada`);
        this.newGrupoNombre.set('');
        this.isSubmittingGrupo.set(false);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al crear categoría');
        this.isSubmittingGrupo.set(false);
        console.error(err);
      },
    });
  }

  deleteGrupo(id: number): void {
    this.finanzasService.deleteGrupo(id).subscribe({
      next: () => {
        this.toastService.success('Categoría eliminada');
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar categoría');
        console.error(err);
      },
    });
  }

  createMovimientoEsperado(): void {
    const nombre = this.newMovimientoNombre().trim();
    if (!nombre) return;

    this.isSubmittingMovimiento.set(true);
    this.finanzasService.createMovimientoEsperado({ nombre }).subscribe({
      next: () => {
        this.toastService.success(`Mecanismo "${nombre}" agregado`);
        this.newMovimientoNombre.set('');
        this.isSubmittingMovimiento.set(false);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al crear mecanismo de pago');
        this.isSubmittingMovimiento.set(false);
        console.error(err);
      },
    });
  }

  deleteMovimientoEsperado(id: number): void {
    this.finanzasService.deleteMovimientoEsperado(id).subscribe({
      next: () => {
        this.toastService.success('Mecanismo de pago eliminado');
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar mecanismo');
        console.error(err);
      },
    });
  }
}
