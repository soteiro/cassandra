export interface Preferencias {
  /** 0 = domingo … 6 = sábado. */
  dia_revision: number;
  limite_en_curso: number;
  /** Capa de deadlines oculta en el calendario. */
  ocultar_deadlines?: boolean;
}
