package models

import "time"

// ListaDeseos representa la entidad completa en base de datos de la tabla lista_deseos
type ListaDeseos struct {
	ID                  int        `json:"id"`
	UserID              int        `json:"user_id"`
	Nombre              string     `json:"nombre"`
	Presupuesto         int        `json:"presupuesto"`
	ValorEstimado       int        `json:"valor_estimado"`
	Comprado            bool       `json:"comprado"`
	Justificacion       *string    `json:"justificacion,omitempty"`
	FechaCreacion       time.Time  `json:"fecha_creacion"`
	FechaActualizacion  time.Time  `json:"fecha_actualizacion"`
	FechaCompra         *time.Time `json:"fecha_compra,omitempty"`
	GrupoItemFinanzasID *int       `json:"grupo_item_finanzas_id,omitempty"`
	Eliminado           bool       `json:"eliminado"`
}

// CreateListaDeseosRequest define el payload para crear un ítem en lista de deseos
type CreateListaDeseosRequest struct {
	UserID              int        `json:"user_id"`
	Nombre              string     `json:"nombre"`
	Presupuesto         int        `json:"presupuesto"`
	ValorEstimado       int        `json:"valor_estimado"`
	Comprado            bool       `json:"comprado"`
	Justificacion       *string    `json:"justificacion,omitempty"`
	FechaCompra         *time.Time `json:"fecha_compra,omitempty"`
	GrupoItemFinanzasID *int       `json:"grupo_item_finanzas_id,omitempty"`
}

// ListaDeseosResponse representa la respuesta entregada al cliente (con datos enriquecidos)
type ListaDeseosResponse struct {
	ID                      int        `json:"id"`
	UserID                  int        `json:"user_id"`
	Nombre                  string     `json:"nombre"`
	Presupuesto             int        `json:"presupuesto"`
	ValorEstimado           int        `json:"valor_estimado"`
	Comprado                bool       `json:"comprado"`
	Justificacion           *string    `json:"justificacion,omitempty"`
	FechaCreacion           time.Time  `json:"fecha_creacion"`
	FechaActualizacion      time.Time  `json:"fecha_actualizacion"`
	FechaCompra             *time.Time `json:"fecha_compra,omitempty"`
	GrupoItemFinanzasID     *int       `json:"grupo_item_finanzas_id,omitempty"`
	GrupoItemFinanzasNombre *string    `json:"grupo_item_finanzas_nombre,omitempty"`
	Eliminado               bool       `json:"eliminado"`
}

// UpdateListaDeseosRequest define el payload para actualizar un ítem
type UpdateListaDeseosRequest struct {
	Nombre              *string    `json:"nombre,omitempty"`
	Presupuesto         *int       `json:"presupuesto,omitempty"`
	ValorEstimado       *int       `json:"valor_estimado,omitempty"`
	Comprado            *bool      `json:"comprado,omitempty"`
	Justificacion       *string    `json:"justificacion,omitempty"`
	FechaCompra         *time.Time `json:"fecha_compra,omitempty"`
	GrupoItemFinanzasID *int       `json:"grupo_item_finanzas_id,omitempty"`
	Eliminado           *bool      `json:"eliminado,omitempty"`
}
