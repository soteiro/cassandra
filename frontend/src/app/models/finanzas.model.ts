export type TipoMovimientoFinanzas = 'ingreso' | 'egreso';
export type EstadoFinanzas = 'pendiente' | 'en proceso' | 'completado';
export type TipoBanco = 'debito' | 'credito' | 'prepago' | 'efectivo';

export interface Banco {
  id: number;
  user_id: number;
  nombre: string;
  tipo: TipoBanco | string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface BancoRequest {
  nombre: string;
  tipo: TipoBanco | string;
}

export interface GrupoItemFinanzas {
  id: number;
  user_id: number;
  nombre: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface GrupoItemFinanzasRequest {
  nombre: string;
}

export interface MovimientoEsperadoFinanzas {
  id: number;
  user_id: number;
  nombre: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface MovimientoEsperadoFinanzasRequest {
  nombre: string;
}

export interface FinanzasPlantillaItem {
  id: number;
  user_id: number;
  tipo: TipoMovimientoFinanzas;
  fecha_creacion: string;
  estado: EstadoFinanzas;
  mes: number;
  anio: number;
  eliminado: boolean;
  nombre: string;
  monto: number;
  banco_id?: number | null;
  banco_nombre?: string | null;
  grupo_item_id?: number | null;
  grupo_item_nombre?: string | null;
  movimiento_esperado_id?: number | null;
  movimiento_esperado_nombre?: string | null;
}

export interface FinanzasPlantillaRequest {
  tipo: TipoMovimientoFinanzas;
  estado?: EstadoFinanzas;
  mes: number;
  anio: number;
  nombre: string;
  monto: number;
  banco_id?: number | null;
  grupo_item_id?: number | null;
  movimiento_esperado_id?: number | null;
}

export interface FinanzasPlantillaUpdateRequest {
  tipo?: TipoMovimientoFinanzas;
  estado?: EstadoFinanzas;
  mes?: number;
  anio?: number;
  nombre?: string;
  monto?: number;
  banco_id?: number | null;
  grupo_item_id?: number | null;
  movimiento_esperado_id?: number | null;
  eliminado?: boolean;
}

export interface FinanzasResumenPeriodo {
  mes: number;
  anio: number;
  total_ingresos: number;
  total_egresos: number;
  balance: number;
}

export interface ClonarPeriodoRequest {
  anio_origen: number;
  mes_origen: number;
  anio_destino: number;
  mes_destino: number;
}
