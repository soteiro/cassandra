import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FinanzasService } from '../../services/finanzas.service';
import { ToastService } from '../../services/toast.service';
import {
  Banco,
  FinanzasPlantillaItem,
  FinanzasResumenPeriodo,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
} from '../../models/finanzas.model';
import {
  LucideWallet,
  LucideScale,
  LucidePlus,
  LucideRefreshCcw,
  LucideCopy,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCalendar,
  LucideSettings,
  LucideX,
  LucideArrowUpRight,
  LucideArrowDownRight,
  LucideSparkles,
} from '@lucide/angular';
import { PresupuestoTab } from './components/presupuesto-tab/presupuesto-tab';
import { DeseosTab } from './components/deseos-tab/deseos-tab';
import { CatalogosTab } from './components/catalogos-tab/catalogos-tab';

@Component({
  selector: 'app-finanzas',
  imports: [
    CommonModule,
    FormsModule,
    LucideWallet,
    LucideScale,
    LucidePlus,
    LucideRefreshCcw,
    LucideCopy,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCalendar,
    LucideSettings,
    LucideX,
    LucideArrowUpRight,
    LucideArrowDownRight,
    LucideSparkles,
    PresupuestoTab,
    DeseosTab,
    CatalogosTab,
  ],
  templateUrl: './finanzas.html',
  styleUrl: './finanzas.css',
})
export class Finanzas implements OnInit {
  readonly presupuestoTab = viewChild(PresupuestoTab);
  readonly deseosTab = viewChild(DeseosTab);

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  readonly meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  // Estado del período seleccionado
  selectedAnio = signal<number>(new Date().getFullYear());
  selectedMes = signal<number>(new Date().getMonth() + 1); // 1-12

  // Estado de los datos
  items = signal<FinanzasPlantillaItem[]>([]);
  resumen = signal<FinanzasResumenPeriodo>({
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    total_ingresos: 0,
    total_egresos: 0,
    balance: 0,
  });

  // Catálogos
  bancos = signal<Banco[]>([]);
  grupos = signal<GrupoItemFinanzas[]>([]);
  movimientosEsperados = signal<MovimientoEsperadoFinanzas[]>([]);

  // Estados de carga y navegación
  isLoading = signal<boolean>(false);
  isRotating = signal<boolean>(false);
  activeTab = signal<'movimientos' | 'deseos' | 'catalogos'>('movimientos');
  searchQuery = signal<string>('');

  // Contador de deseos pendientes (para el badge de la tab)
  deseosPendientesCount = signal<number>(0);

  // Computados
  mesNombre = computed(() => this.meses[this.selectedMes() - 1]);

  ingresos = computed(() =>
    this.items().filter((i) => i.tipo === 'ingreso')
  );

  egresos = computed(() =>
    this.items().filter((i) => i.tipo === 'egreso')
  );

  porcentajeReal = computed(() => {
    const ing = this.resumen().total_ingresos;
    const egr = this.resumen().total_egresos;
    if (ing <= 0) return egr > 0 ? 100 : 0;
    return Math.round((egr / ing) * 100);
  });

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadPeriodo();
    this.loadListaDeseosCount();
  }

  loadCatalogs(): void {
    this.finanzasService.getBancos().subscribe({
      next: (b) => this.bancos.set(b || []),
      error: (err) => console.error('Error cargando bancos:', err),
    });

    this.finanzasService.getGrupos().subscribe({
      next: (g) => this.grupos.set(g || []),
      error: (err) => console.error('Error cargando categorías:', err),
    });

    this.finanzasService.getMovimientosEsperados().subscribe({
      next: (m) => this.movimientosEsperados.set(m || []),
      error: (err) => console.error('Error cargando movimientos esperados:', err),
    });
  }

  // Carga en curso del período. Se cancela al pedir otro período para que una
  // respuesta lenta de un período anterior no pise los datos del seleccionado.
  private periodoSub?: Subscription;

  loadPeriodo(): void {
    this.isLoading.set(true);
    const anio = this.selectedAnio();
    const mes = this.selectedMes();

    this.periodoSub?.unsubscribe();
    this.periodoSub = new Subscription();

    this.periodoSub.add(this.finanzasService.getPlantilla(anio, mes).subscribe({
      next: (items) => {
        this.items.set(items || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando plantilla:', err);
        this.toastService.error('Error al cargar movimientos del período');
        this.isLoading.set(false);
      },
    }));

    this.periodoSub.add(this.finanzasService.getResumen(anio, mes).subscribe({
      next: (res) => {
        this.resumen.set(
          res || {
            mes,
            anio,
            total_ingresos: 0,
            total_egresos: 0,
            balance: 0,
          }
        );
      },
      error: (err) => console.error('Error cargando resumen:', err),
    }));
  }

  loadListaDeseosCount(): void {
    this.finanzasService.getListaDeseos().subscribe({
      next: (deseos) => {
        this.deseosPendientesCount.set(
          (deseos || []).filter((d) => !d.comprado).length
        );
      },
      error: (err) => console.error('Error cargando contador de deseos:', err),
    });
  }

  reload(): void {
    this.isRotating.set(true);
    this.loadCatalogs();
    this.loadPeriodo();
    this.loadListaDeseosCount();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  // Navegación temporal
  prevMonth(): void {
    let m = this.selectedMes() - 1;
    let a = this.selectedAnio();
    if (m < 1) {
      m = 12;
      a -= 1;
    }
    this.selectedMes.set(m);
    this.selectedAnio.set(a);
    this.loadPeriodo();
  }

  nextMonth(): void {
    let m = this.selectedMes() + 1;
    let a = this.selectedAnio();
    if (m > 12) {
      m = 1;
      a += 1;
    }
    this.selectedMes.set(m);
    this.selectedAnio.set(a);
    this.loadPeriodo();
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.selectedMes.set(now.getMonth() + 1);
    this.selectedAnio.set(now.getFullYear());
    this.loadPeriodo();
  }

  setPeriodo(mes: number | string, anio: number | string): void {
    // Number(): el período viaja al backend como int; un string provoca un 400.
    this.selectedMes.set(Number(mes));
    this.selectedAnio.set(Number(anio));
    this.loadPeriodo();
  }

  onPeriodoChanged(event: { mes: number; anio: number }): void {
    this.selectedMes.set(event.mes);
    this.selectedAnio.set(event.anio);
    this.loadPeriodo();
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  }
}
