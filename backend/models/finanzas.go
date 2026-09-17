package models

import "time"

// ==========================================
// 1. BANCO / MEDIO DE PAGO
// ==========================================

// Banco representa una cuenta bancaria, billetera digital o medio de pago (ej. Santander, Tenpo, Efectivo).
type Banco struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	Tipo          string    `json:"tipo"` // debito, credito, prepago, efectivo
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type BancoRequest struct {
	UserID int    `json:"user_id"`
	Nombre string `json:"nombre"`
	Tipo   string `json:"tipo"`
}

type BancoResponse struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	Tipo          string    `json:"tipo"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type BancoUpdateRequest struct {
	Nombre    *string `json:"nombre"`
	Tipo      *string `json:"tipo"`
	Eliminado *bool   `json:"eliminado"`
}

// ==========================================
// 2. GRUPO ITEM FINANZAS (CATEGORÍA)
// ==========================================

// GrupoItemFinanzas representa la categoría o grupo de gastos/ingresos (ej. Hogar, Personal, Trabajo).
type GrupoItemFinanzas struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type GrupoItemFinanzasRequest struct {
	UserID int    `json:"user_id"`
	Nombre string `json:"nombre"`
}

type GrupoItemFinanzasResponse struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type GrupoItemFinanzasUpdateRequest struct {
	Nombre    *string `json:"nombre"`
	Eliminado *bool   `json:"eliminado"`
}

// ==========================================
// 3. MOVIMIENTO ESPERADO FINANZAS (DESTINO/MECANISMO)
// ==========================================

// MovimientoEsperadoFinanzas representa el mecanismo o responsable del pago (ej. pago yo, transf-daniela, transf-eduvijis).
type MovimientoEsperadoFinanzas struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type MovimientoEsperadoFinanzasRequest struct {
	UserID int    `json:"user_id"`
	Nombre string `json:"nombre"`
}

type MovimientoEsperadoFinanzasResponse struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Nombre        string    `json:"nombre"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado     bool      `json:"eliminado"`
}

type MovimientoEsperadoFinanzasUpdateRequest struct {
	Nombre    *string `json:"nombre"`
	Eliminado *bool   `json:"eliminado"`
}

// ==========================================
// 4. FINANZAS PLANTILLA (MOVIMIENTO / PRESUPUESTO MENSUAL)
// ==========================================

// FinanzasPlantilla representa un ítem presupuestado o registrado para un mes y año específico.
type FinanzasPlantilla struct {
	ID                   int       `json:"id"`
	UserID               int       `json:"user_id"`
	Tipo                 string    `json:"tipo"`   // ingreso, egreso
	FechaCreacion        time.Time `json:"fecha_creacion"`
	Estado               string    `json:"estado"` // pendiente, en proceso, completado
	Mes                  int       `json:"mes"`    // 1 - 12
	Anio                 int       `json:"anio"`
	Eliminado            bool      `json:"eliminado"`
	Nombre               string    `json:"nombre"`
	Monto                int       `json:"monto"` // en CLP
	BancoID              *int      `json:"banco_id,omitempty"`
	GrupoItemID          *int      `json:"grupo_item_id,omitempty"`
	MovimientoEsperadoID *int      `json:"movimiento_esperado_id,omitempty"`
}

type FinanzasPlantillaRequest struct {
	UserID               int    `json:"user_id"`
	Tipo                 string `json:"tipo"` // ingreso, egreso
	Estado               string `json:"estado,omitempty"`
	Mes                  int    `json:"mes"`
	Anio                 int    `json:"anio"`
	Nombre               string `json:"nombre"`
	Monto                int    `json:"monto"`
	BancoID              *int   `json:"banco_id,omitempty"`
	GrupoItemID          *int   `json:"grupo_item_id,omitempty"`
	MovimientoEsperadoID *int   `json:"movimiento_esperado_id,omitempty"`
}

type FinanzasPlantillaResponse struct {
	ID                       int       `json:"id"`
	UserID                   int       `json:"user_id"`
	Tipo                     string    `json:"tipo"`
	FechaCreacion            time.Time `json:"fecha_creacion"`
	Estado                   string    `json:"estado"`
	Mes                      int       `json:"mes"`
	Anio                     int       `json:"anio"`
	Eliminado                bool      `json:"eliminado"`
	Nombre                   string    `json:"nombre"`
	Monto                    int       `json:"monto"`
	BancoID                  *int      `json:"banco_id,omitempty"`
	BancoNombre              *string   `json:"banco_nombre,omitempty"`
	GrupoItemID              *int      `json:"grupo_item_id,omitempty"`
	GrupoItemNombre          *string   `json:"grupo_item_nombre,omitempty"`
	MovimientoEsperadoID     *int      `json:"movimiento_esperado_id,omitempty"`
	MovimientoEsperadoNombre *string   `json:"movimiento_esperado_nombre,omitempty"`
}

type FinanzasPlantillaUpdateRequest struct {
	Tipo                 *string `json:"tipo"`
	Estado               *string `json:"estado"`
	Mes                  *int    `json:"mes"`
	Anio                 *int    `json:"anio"`
	Nombre               *string `json:"nombre"`
	Monto                *int    `json:"monto"`
	BancoID              *int    `json:"banco_id"`
	GrupoItemID          *int    `json:"grupo_item_id"`
	MovimientoEsperadoID *int    `json:"movimiento_esperado_id"`
	Eliminado            *bool   `json:"eliminado"`
}

// ==========================================
// 5. RESUMEN / BALANCE MENSUAL
// ==========================================

// FinanzasResumenPeriodo consolida los totales y el balance neto para un período determinado.
type FinanzasResumenPeriodo struct {
	Mes           int `json:"mes"`
	Anio          int `json:"anio"`
	TotalIngresos int `json:"total_ingresos"`
	TotalEgresos  int `json:"total_egresos"`
	Balance       int `json:"balance"` // TotalIngresos - TotalEgresos
}

// ClonarPeriodoRequest especifica los parámetros para clonar un mes hacia otro.
type ClonarPeriodoRequest struct {
	AnioOrigen  int `json:"anio_origen"`
	MesOrigen   int `json:"mes_origen"`
	AnioDestino int `json:"anio_destino"`
	MesDestino  int `json:"mes_destino"`
}

