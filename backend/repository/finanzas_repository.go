package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type FinanzasRepository struct {
	db *pgxpool.Pool
}

func NewFinanzasRepository(db *pgxpool.Pool) *FinanzasRepository {
	return &FinanzasRepository{db: db}
}

// ==========================================
// 1. BANCO (Cuentas, Tarjetas, Billeteras)
// ==========================================

func (r *FinanzasRepository) CreateBanco(ctx context.Context, req *models.BancoRequest) (*models.BancoResponse, error) {
	var banco models.BancoResponse
	tipo := req.Tipo
	if tipo == "" {
		tipo = "efectivo"
	}

	query := `
		INSERT INTO banco (user_id, nombre, tipo)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, nombre, tipo, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.UserID, req.Nombre, tipo).Scan(
		&banco.ID,
		&banco.UserID,
		&banco.Nombre,
		&banco.Tipo,
		&banco.FechaCreacion,
		&banco.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.CreateBanco] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear el banco: %w", err)
	}

	return &banco, nil
}

func (r *FinanzasRepository) GetBancos(ctx context.Context, userID int) ([]*models.BancoResponse, error) {
	query := `
		SELECT id, user_id, nombre, tipo, fecha_creacion, eliminado
		FROM banco
		WHERE user_id = $1 AND eliminado = false
		ORDER BY nombre ASC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.GetBancos] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener bancos: %w", err)
	}
	defer rows.Close()

	bancos := make([]*models.BancoResponse, 0)
	for rows.Next() {
		var b models.BancoResponse
		if err := rows.Scan(&b.ID, &b.UserID, &b.Nombre, &b.Tipo, &b.FechaCreacion, &b.Eliminado); err != nil {
			log.Printf("[REPO:Finanzas.GetBancos] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear banco: %w", err)
		}
		bancos = append(bancos, &b)
	}

	return bancos, rows.Err()
}

func (r *FinanzasRepository) GetBancoByID(ctx context.Context, id int, userID int) (*models.BancoResponse, error) {
	var banco models.BancoResponse
	query := `
		SELECT id, user_id, nombre, tipo, fecha_creacion, eliminado
		FROM banco
		WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&banco.ID,
		&banco.UserID,
		&banco.Nombre,
		&banco.Tipo,
		&banco.FechaCreacion,
		&banco.Eliminado,
	)
	if err != nil {
		return nil, fmt.Errorf("no se encontró el banco o no tienes permisos: %w", err)
	}

	return &banco, nil
}

func (r *FinanzasRepository) UpdateBanco(ctx context.Context, id int, userID int, req *models.BancoUpdateRequest) (*models.BancoResponse, error) {
	var banco models.BancoResponse
	query := `
		UPDATE banco
		SET nombre = COALESCE($1, nombre),
			tipo = COALESCE($2, tipo),
			eliminado = COALESCE($3, eliminado)
		WHERE id = $4 AND user_id = $5
		RETURNING id, user_id, nombre, tipo, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.Nombre, req.Tipo, req.Eliminado, id, userID).Scan(
		&banco.ID,
		&banco.UserID,
		&banco.Nombre,
		&banco.Tipo,
		&banco.FechaCreacion,
		&banco.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.UpdateBanco] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, fmt.Errorf("error al actualizar el banco: %w", err)
	}

	return &banco, nil
}

func (r *FinanzasRepository) DeleteBanco(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE banco
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.DeleteBanco] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró el banco o no tienes permisos")
	}

	return nil
}

// ==========================================
// 2. GRUPO ITEM FINANZAS (Categorías)
// ==========================================

func (r *FinanzasRepository) CreateGrupoItem(ctx context.Context, req *models.GrupoItemFinanzasRequest) (*models.GrupoItemFinanzasResponse, error) {
	var grupo models.GrupoItemFinanzasResponse
	query := `
		INSERT INTO grupo_item_finanzas (user_id, nombre)
		VALUES ($1, $2)
		RETURNING id, user_id, nombre, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.UserID, req.Nombre).Scan(
		&grupo.ID,
		&grupo.UserID,
		&grupo.Nombre,
		&grupo.FechaCreacion,
		&grupo.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.CreateGrupoItem] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear el grupo de finanzas: %w", err)
	}

	return &grupo, nil
}

func (r *FinanzasRepository) GetGruposItems(ctx context.Context, userID int) ([]*models.GrupoItemFinanzasResponse, error) {
	query := `
		SELECT id, user_id, nombre, fecha_creacion, eliminado
		FROM grupo_item_finanzas
		WHERE user_id = $1 AND eliminado = false
		ORDER BY nombre ASC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.GetGruposItems] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener grupos de finanzas: %w", err)
	}
	defer rows.Close()

	grupos := make([]*models.GrupoItemFinanzasResponse, 0)
	for rows.Next() {
		var g models.GrupoItemFinanzasResponse
		if err := rows.Scan(&g.ID, &g.UserID, &g.Nombre, &g.FechaCreacion, &g.Eliminado); err != nil {
			log.Printf("[REPO:Finanzas.GetGruposItems] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear grupo de finanzas: %w", err)
		}
		grupos = append(grupos, &g)
	}

	return grupos, rows.Err()
}

func (r *FinanzasRepository) GetGrupoItemByID(ctx context.Context, id int, userID int) (*models.GrupoItemFinanzasResponse, error) {
	var grupo models.GrupoItemFinanzasResponse
	query := `
		SELECT id, user_id, nombre, fecha_creacion, eliminado
		FROM grupo_item_finanzas
		WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&grupo.ID,
		&grupo.UserID,
		&grupo.Nombre,
		&grupo.FechaCreacion,
		&grupo.Eliminado,
	)
	if err != nil {
		return nil, fmt.Errorf("no se encontró el grupo de finanzas o no tienes permisos: %w", err)
	}

	return &grupo, nil
}

func (r *FinanzasRepository) UpdateGrupoItem(ctx context.Context, id int, userID int, req *models.GrupoItemFinanzasUpdateRequest) (*models.GrupoItemFinanzasResponse, error) {
	var grupo models.GrupoItemFinanzasResponse
	query := `
		UPDATE grupo_item_finanzas
		SET nombre = COALESCE($1, nombre),
			eliminado = COALESCE($2, eliminado)
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, nombre, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.Nombre, req.Eliminado, id, userID).Scan(
		&grupo.ID,
		&grupo.UserID,
		&grupo.Nombre,
		&grupo.FechaCreacion,
		&grupo.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.UpdateGrupoItem] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, fmt.Errorf("error al actualizar el grupo de finanzas: %w", err)
	}

	return &grupo, nil
}

func (r *FinanzasRepository) DeleteGrupoItem(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE grupo_item_finanzas
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.DeleteGrupoItem] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró el grupo de finanzas o no tienes permisos")
	}

	return nil
}

// ==========================================
// 3. MOVIMIENTO ESPERADO FINANZAS (Destino / Mecanismo)
// ==========================================

func (r *FinanzasRepository) CreateMovimientoEsperado(ctx context.Context, req *models.MovimientoEsperadoFinanzasRequest) (*models.MovimientoEsperadoFinanzasResponse, error) {
	var mov models.MovimientoEsperadoFinanzasResponse
	query := `
		INSERT INTO movimiento_esperado_finanzas (user_id, nombre)
		VALUES ($1, $2)
		RETURNING id, user_id, nombre, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.UserID, req.Nombre).Scan(
		&mov.ID,
		&mov.UserID,
		&mov.Nombre,
		&mov.FechaCreacion,
		&mov.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.CreateMovimientoEsperado] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear el movimiento esperado: %w", err)
	}

	return &mov, nil
}

func (r *FinanzasRepository) GetMovimientosEsperados(ctx context.Context, userID int) ([]*models.MovimientoEsperadoFinanzasResponse, error) {
	query := `
		SELECT id, user_id, nombre, fecha_creacion, eliminado
		FROM movimiento_esperado_finanzas
		WHERE user_id = $1 AND eliminado = false
		ORDER BY nombre ASC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.GetMovimientosEsperados] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener movimientos esperados: %w", err)
	}
	defer rows.Close()

	movs := make([]*models.MovimientoEsperadoFinanzasResponse, 0)
	for rows.Next() {
		var m models.MovimientoEsperadoFinanzasResponse
		if err := rows.Scan(&m.ID, &m.UserID, &m.Nombre, &m.FechaCreacion, &m.Eliminado); err != nil {
			log.Printf("[REPO:Finanzas.GetMovimientosEsperados] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear movimiento esperado: %w", err)
		}
		movs = append(movs, &m)
	}

	return movs, rows.Err()
}

func (r *FinanzasRepository) GetMovimientoEsperadoByID(ctx context.Context, id int, userID int) (*models.MovimientoEsperadoFinanzasResponse, error) {
	var mov models.MovimientoEsperadoFinanzasResponse
	query := `
		SELECT id, user_id, nombre, fecha_creacion, eliminado
		FROM movimiento_esperado_finanzas
		WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&mov.ID,
		&mov.UserID,
		&mov.Nombre,
		&mov.FechaCreacion,
		&mov.Eliminado,
	)
	if err != nil {
		return nil, fmt.Errorf("no se encontró el movimiento esperado o no tienes permisos: %w", err)
	}

	return &mov, nil
}

func (r *FinanzasRepository) UpdateMovimientoEsperado(ctx context.Context, id int, userID int, req *models.MovimientoEsperadoFinanzasUpdateRequest) (*models.MovimientoEsperadoFinanzasResponse, error) {
	var mov models.MovimientoEsperadoFinanzasResponse
	query := `
		UPDATE movimiento_esperado_finanzas
		SET nombre = COALESCE($1, nombre),
			eliminado = COALESCE($2, eliminado)
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, nombre, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.Nombre, req.Eliminado, id, userID).Scan(
		&mov.ID,
		&mov.UserID,
		&mov.Nombre,
		&mov.FechaCreacion,
		&mov.Eliminado,
	)
	if err != nil {
		log.Printf("[REPO:Finanzas.UpdateMovimientoEsperado] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, fmt.Errorf("error al actualizar el movimiento esperado: %w", err)
	}

	return &mov, nil
}

func (r *FinanzasRepository) DeleteMovimientoEsperado(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE movimiento_esperado_finanzas
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.DeleteMovimientoEsperado] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró el movimiento esperado o no tienes permisos")
	}

	return nil
}

// ==========================================
// 4. FINANZAS PLANTILLA (Movimiento / Presupuesto Mensual)
// ==========================================

func (r *FinanzasRepository) CreatePlantilla(ctx context.Context, req *models.FinanzasPlantillaRequest) (*models.FinanzasPlantillaResponse, error) {
	estado := req.Estado
	if estado == "" {
		estado = "pendiente"
	}

	query := `
		WITH inserted AS (
			INSERT INTO finanzas_plantilla (
				user_id, tipo, estado, mes, anio, nombre, monto, banco_id, grupo_item_id, movimiento_esperado_id
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, user_id, tipo, fecha_creacion, estado, mes, anio, eliminado, nombre, monto, banco_id, grupo_item_id, movimiento_esperado_id
		)
		SELECT 
			i.id, i.user_id, i.tipo, i.fecha_creacion, i.estado, i.mes, i.anio, i.eliminado, i.nombre, i.monto,
			i.banco_id, b.nombre AS banco_nombre,
			i.grupo_item_id, g.nombre AS grupo_item_nombre,
			i.movimiento_esperado_id, m.nombre AS movimiento_esperado_nombre
		FROM inserted i
		LEFT JOIN banco b ON b.id = i.banco_id
		LEFT JOIN grupo_item_finanzas g ON g.id = i.grupo_item_id
		LEFT JOIN movimiento_esperado_finanzas m ON m.id = i.movimiento_esperado_id;
	`

	var item models.FinanzasPlantillaResponse
	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.Tipo,
		estado,
		req.Mes,
		req.Anio,
		req.Nombre,
		req.Monto,
		req.BancoID,
		req.GrupoItemID,
		req.MovimientoEsperadoID,
	).Scan(
		&item.ID,
		&item.UserID,
		&item.Tipo,
		&item.FechaCreacion,
		&item.Estado,
		&item.Mes,
		&item.Anio,
		&item.Eliminado,
		&item.Nombre,
		&item.Monto,
		&item.BancoID,
		&item.BancoNombre,
		&item.GrupoItemID,
		&item.GrupoItemNombre,
		&item.MovimientoEsperadoID,
		&item.MovimientoEsperadoNombre,
	)

	if err != nil {
		log.Printf("[REPO:Finanzas.CreatePlantilla] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al registrar ítem de finanzas: %w", err)
	}

	return &item, nil
}

func (r *FinanzasRepository) GetPlantillaByPeriodo(ctx context.Context, userID int, anio int, mes int) ([]*models.FinanzasPlantillaResponse, error) {
	query := `
		SELECT 
			fp.id,
			fp.user_id,
			fp.tipo,
			fp.fecha_creacion,
			fp.estado,
			fp.mes,
			fp.anio,
			fp.eliminado,
			fp.nombre,
			fp.monto,
			fp.banco_id,
			b.nombre AS banco_nombre,
			fp.grupo_item_id,
			g.nombre AS grupo_item_nombre,
			fp.movimiento_esperado_id,
			m.nombre AS movimiento_esperado_nombre
		FROM finanzas_plantilla fp
		LEFT JOIN banco b ON b.id = fp.banco_id
		LEFT JOIN grupo_item_finanzas g ON g.id = fp.grupo_item_id
		LEFT JOIN movimiento_esperado_finanzas m ON m.id = fp.movimiento_esperado_id
		WHERE fp.user_id = $1 
		  AND fp.anio = $2 
		  AND fp.mes = $3
		  AND fp.eliminado = false
		ORDER BY fp.tipo DESC, fp.id ASC
	`

	rows, err := r.db.Query(ctx, query, userID, anio, mes)
	if err != nil {
		log.Printf("[REPO:Finanzas.GetPlantillaByPeriodo] Error en SQL SELECT: %v | user_id=%d anio=%d mes=%d", err, userID, anio, mes)
		return nil, fmt.Errorf("error al obtener finanzas del período: %w", err)
	}
	defer rows.Close()

	items := make([]*models.FinanzasPlantillaResponse, 0)
	for rows.Next() {
		var item models.FinanzasPlantillaResponse
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Tipo,
			&item.FechaCreacion,
			&item.Estado,
			&item.Mes,
			&item.Anio,
			&item.Eliminado,
			&item.Nombre,
			&item.Monto,
			&item.BancoID,
			&item.BancoNombre,
			&item.GrupoItemID,
			&item.GrupoItemNombre,
			&item.MovimientoEsperadoID,
			&item.MovimientoEsperadoNombre,
		)
		if err != nil {
			log.Printf("[REPO:Finanzas.GetPlantillaByPeriodo] Error al escanear fila: %v", err)
			return nil, fmt.Errorf("error al escanear ítem de finanzas: %w", err)
		}
		items = append(items, &item)
	}

	return items, rows.Err()
}

func (r *FinanzasRepository) GetPlantillaByID(ctx context.Context, id int, userID int) (*models.FinanzasPlantillaResponse, error) {
	query := `
		SELECT 
			fp.id,
			fp.user_id,
			fp.tipo,
			fp.fecha_creacion,
			fp.estado,
			fp.mes,
			fp.anio,
			fp.eliminado,
			fp.nombre,
			fp.monto,
			fp.banco_id,
			b.nombre AS banco_nombre,
			fp.grupo_item_id,
			g.nombre AS grupo_item_nombre,
			fp.movimiento_esperado_id,
			m.nombre AS movimiento_esperado_nombre
		FROM finanzas_plantilla fp
		LEFT JOIN banco b ON b.id = fp.banco_id
		LEFT JOIN grupo_item_finanzas g ON g.id = fp.grupo_item_id
		LEFT JOIN movimiento_esperado_finanzas m ON m.id = fp.movimiento_esperado_id
		WHERE fp.id = $1 AND fp.user_id = $2 AND fp.eliminado = false
	`

	var item models.FinanzasPlantillaResponse
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&item.ID,
		&item.UserID,
		&item.Tipo,
		&item.FechaCreacion,
		&item.Estado,
		&item.Mes,
		&item.Anio,
		&item.Eliminado,
		&item.Nombre,
		&item.Monto,
		&item.BancoID,
		&item.BancoNombre,
		&item.GrupoItemID,
		&item.GrupoItemNombre,
		&item.MovimientoEsperadoID,
		&item.MovimientoEsperadoNombre,
	)
	if err != nil {
		return nil, fmt.Errorf("no se encontró el ítem de finanzas o no tienes permisos: %w", err)
	}

	return &item, nil
}

func (r *FinanzasRepository) UpdatePlantilla(ctx context.Context, id int, userID int, req *models.FinanzasPlantillaUpdateRequest) (*models.FinanzasPlantillaResponse, error) {
	query := `
		WITH updated AS (
			UPDATE finanzas_plantilla
			SET tipo = COALESCE($1, tipo),
				estado = COALESCE($2, estado),
				mes = COALESCE($3, mes),
				anio = COALESCE($4, anio),
				nombre = COALESCE($5, nombre),
				monto = COALESCE($6, monto),
				banco_id = COALESCE($7, banco_id),
				grupo_item_id = COALESCE($8, grupo_item_id),
				movimiento_esperado_id = COALESCE($9, movimiento_esperado_id),
				eliminado = COALESCE($10, eliminado)
			WHERE id = $11 AND user_id = $12
			RETURNING id, user_id, tipo, fecha_creacion, estado, mes, anio, eliminado, nombre, monto, banco_id, grupo_item_id, movimiento_esperado_id
		)
		SELECT 
			u.id, u.user_id, u.tipo, u.fecha_creacion, u.estado, u.mes, u.anio, u.eliminado, u.nombre, u.monto,
			u.banco_id, b.nombre AS banco_nombre,
			u.grupo_item_id, g.nombre AS grupo_item_nombre,
			u.movimiento_esperado_id, m.nombre AS movimiento_esperado_nombre
		FROM updated u
		LEFT JOIN banco b ON b.id = u.banco_id
		LEFT JOIN grupo_item_finanzas g ON g.id = u.grupo_item_id
		LEFT JOIN movimiento_esperado_finanzas m ON m.id = u.movimiento_esperado_id;
	`

	var item models.FinanzasPlantillaResponse
	err := r.db.QueryRow(
		ctx,
		query,
		req.Tipo,
		req.Estado,
		req.Mes,
		req.Anio,
		req.Nombre,
		req.Monto,
		req.BancoID,
		req.GrupoItemID,
		req.MovimientoEsperadoID,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&item.ID,
		&item.UserID,
		&item.Tipo,
		&item.FechaCreacion,
		&item.Estado,
		&item.Mes,
		&item.Anio,
		&item.Eliminado,
		&item.Nombre,
		&item.Monto,
		&item.BancoID,
		&item.BancoNombre,
		&item.GrupoItemID,
		&item.GrupoItemNombre,
		&item.MovimientoEsperadoID,
		&item.MovimientoEsperadoNombre,
	)

	if err != nil {
		log.Printf("[REPO:Finanzas.UpdatePlantilla] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, fmt.Errorf("error al actualizar ítem de finanzas: %w", err)
	}

	return &item, nil
}

func (r *FinanzasRepository) DeletePlantilla(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE finanzas_plantilla
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Finanzas.DeletePlantilla] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró el ítem de finanzas o no tienes permisos")
	}

	return nil
}

// ==========================================
// 5. RESUMEN FINANCIERO Y CLONACIÓN MENSUAL
// ==========================================

// GetResumenPeriodo calcula ingresos, egresos y balance del mes en una sola consulta.
func (r *FinanzasRepository) GetResumenPeriodo(ctx context.Context, userID int, anio int, mes int) (*models.FinanzasResumenPeriodo, error) {
	query := `
		SELECT 
			COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS total_ingresos,
			COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS total_egresos
		FROM finanzas_plantilla
		WHERE user_id = $1
		  AND anio = $2
		  AND mes = $3
		  AND eliminado = false;
	`

	var totalIngresos, totalEgresos int
	err := r.db.QueryRow(ctx, query, userID, anio, mes).Scan(&totalIngresos, &totalEgresos)
	if err != nil {
		log.Printf("[REPO:Finanzas.GetResumenPeriodo] Error en SQL SELECT: %v | user_id=%d anio=%d mes=%d", err, userID, anio, mes)
		return nil, fmt.Errorf("error al calcular resumen de finanzas: %w", err)
	}

	return &models.FinanzasResumenPeriodo{
		Mes:           mes,
		Anio:          anio,
		TotalIngresos: totalIngresos,
		TotalEgresos:  totalEgresos,
		Balance:       totalIngresos - totalEgresos,
	}, nil
}

// ClonarPeriodo replica todos los ítems de un mes hacia otro mes nuevo (reseteando estado a 'pendiente').
func (r *FinanzasRepository) ClonarPeriodo(ctx context.Context, userID int, anioOrigen int, mesOrigen int, anioDestino int, mesDestino int) (int64, error) {
	query := `
		INSERT INTO finanzas_plantilla (
			user_id, tipo, estado, anio, mes, nombre, monto, banco_id, grupo_item_id, movimiento_esperado_id
		)
		SELECT 
			user_id, tipo, 'pendiente', $4, $5, nombre, monto, banco_id, grupo_item_id, movimiento_esperado_id
		FROM finanzas_plantilla
		WHERE user_id = $1
		  AND anio = $2
		  AND mes = $3
		  AND eliminado = false;
	`

	res, err := r.db.Exec(ctx, query, userID, anioOrigen, mesOrigen, anioDestino, mesDestino)
	if err != nil {
		log.Printf("[REPO:Finanzas.ClonarPeriodo] Error al clonar período: %v | user_id=%d de %d/%d a %d/%d", err, userID, anioOrigen, mesOrigen, anioDestino, mesDestino)
		return 0, fmt.Errorf("error al clonar período de finanzas: %w", err)
	}

	return res.RowsAffected(), nil
}
