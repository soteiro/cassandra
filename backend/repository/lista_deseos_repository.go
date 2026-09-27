package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ListaDeseosRepository struct {
	db *pgxpool.Pool
}

func NewListaDeseosRepository(db *pgxpool.Pool) *ListaDeseosRepository {
	return &ListaDeseosRepository{db: db}
}

// Create inserta un nuevo ítem en la lista de deseos y retorna el registro enriquecido
func (r *ListaDeseosRepository) Create(ctx context.Context, req *models.CreateListaDeseosRequest) (*models.ListaDeseosResponse, error) {
	var fechaCompra *time.Time
	if req.Comprado {
		if req.FechaCompra != nil {
			fechaCompra = req.FechaCompra
		} else {
			now := time.Now()
			fechaCompra = &now
		}
	} else {
		fechaCompra = req.FechaCompra
	}

	query := `
		WITH inserted AS (
			INSERT INTO lista_deseos (
				user_id, nombre, presupuesto, valor_estimado, comprado,
				justificacion, fecha_compra, grupo_item_finanzas_id
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, user_id, nombre, presupuesto, valor_estimado, comprado,
			          justificacion, fecha_creacion, fecha_actualizacion, fecha_compra,
			          grupo_item_finanzas_id, eliminado
		)
		SELECT 
			i.id, i.user_id, i.nombre, i.presupuesto, i.valor_estimado, i.comprado,
			i.justificacion, i.fecha_creacion, i.fecha_actualizacion, i.fecha_compra,
			i.grupo_item_finanzas_id, g.nombre AS grupo_item_finanzas_nombre, i.eliminado
		FROM inserted i
		LEFT JOIN grupo_item_finanzas g ON g.id = i.grupo_item_finanzas_id;
	`

	var item models.ListaDeseosResponse
	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.Nombre,
		req.Presupuesto,
		req.ValorEstimado,
		req.Comprado,
		req.Justificacion,
		fechaCompra,
		req.GrupoItemFinanzasID,
	).Scan(
		&item.ID,
		&item.UserID,
		&item.Nombre,
		&item.Presupuesto,
		&item.ValorEstimado,
		&item.Comprado,
		&item.Justificacion,
		&item.FechaCreacion,
		&item.FechaActualizacion,
		&item.FechaCompra,
		&item.GrupoItemFinanzasID,
		&item.GrupoItemFinanzasNombre,
		&item.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:ListaDeseos.Create] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear ítem de lista de deseos: %w", err)
	}

	return &item, nil
}

// GetAll obtiene todos los ítems de lista de deseos activos del usuario con filtros opcionales
func (r *ListaDeseosRepository) GetAll(ctx context.Context, userID int, compradoFilter *bool, grupoIDFilter *int) ([]*models.ListaDeseosResponse, error) {
	query := `
		SELECT 
			l.id, l.user_id, l.nombre, l.presupuesto, l.valor_estimado, l.comprado,
			l.justificacion, l.fecha_creacion, l.fecha_actualizacion, l.fecha_compra,
			l.grupo_item_finanzas_id, g.nombre AS grupo_item_finanzas_nombre, l.eliminado
		FROM lista_deseos l
		LEFT JOIN grupo_item_finanzas g ON g.id = l.grupo_item_finanzas_id
		WHERE l.user_id = $1
		  AND l.eliminado = false
	`
	args := []interface{}{userID}
	argIndex := 2

	if compradoFilter != nil {
		query += fmt.Sprintf(" AND l.comprado = $%d", argIndex)
		args = append(args, *compradoFilter)
		argIndex++
	}

	if grupoIDFilter != nil {
		query += fmt.Sprintf(" AND l.grupo_item_finanzas_id = $%d", argIndex)
		args = append(args, *grupoIDFilter)
		argIndex++
	}

	query += " ORDER BY l.comprado ASC, l.fecha_creacion DESC, l.id DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("[REPO:ListaDeseos.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener lista de deseos: %w", err)
	}
	defer rows.Close()

	items := make([]*models.ListaDeseosResponse, 0)
	for rows.Next() {
		var item models.ListaDeseosResponse
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Nombre,
			&item.Presupuesto,
			&item.ValorEstimado,
			&item.Comprado,
			&item.Justificacion,
			&item.FechaCreacion,
			&item.FechaActualizacion,
			&item.FechaCompra,
			&item.GrupoItemFinanzasID,
			&item.GrupoItemFinanzasNombre,
			&item.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:ListaDeseos.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear ítem de lista de deseos: %w", err)
		}
		items = append(items, &item)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:ListaDeseos.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return items, nil
}

// GetByID obtiene un ítem específico por ID y UserID
func (r *ListaDeseosRepository) GetByID(ctx context.Context, id int, userID int) (*models.ListaDeseosResponse, error) {
	query := `
		SELECT 
			l.id, l.user_id, l.nombre, l.presupuesto, l.valor_estimado, l.comprado,
			l.justificacion, l.fecha_creacion, l.fecha_actualizacion, l.fecha_compra,
			l.grupo_item_finanzas_id, g.nombre AS grupo_item_finanzas_nombre, l.eliminado
		FROM lista_deseos l
		LEFT JOIN grupo_item_finanzas g ON g.id = l.grupo_item_finanzas_id
		WHERE l.id = $1
		  AND l.user_id = $2
		  AND l.eliminado = false
	`

	var item models.ListaDeseosResponse
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&item.ID,
		&item.UserID,
		&item.Nombre,
		&item.Presupuesto,
		&item.ValorEstimado,
		&item.Comprado,
		&item.Justificacion,
		&item.FechaCreacion,
		&item.FechaActualizacion,
		&item.FechaCompra,
		&item.GrupoItemFinanzasID,
		&item.GrupoItemFinanzasNombre,
		&item.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:ListaDeseos.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &item, nil
}

// Update actualiza un ítem de la lista de deseos
func (r *ListaDeseosRepository) Update(ctx context.Context, id int, userID int, req *models.UpdateListaDeseosRequest) (*models.ListaDeseosResponse, error) {
	var modoFechaCompra int // 0 = no change, 1 = comprar/asignar fecha, 2 = no comprado (NULL)
	var fechaCompraVal *time.Time

	if req.Comprado != nil {
		if *req.Comprado {
			modoFechaCompra = 1
			if req.FechaCompra != nil {
				fechaCompraVal = req.FechaCompra
			} else {
				now := time.Now()
				fechaCompraVal = &now
			}
		} else {
			modoFechaCompra = 2
		}
	} else if req.FechaCompra != nil {
		modoFechaCompra = 1
		fechaCompraVal = req.FechaCompra
	}

	query := `
		WITH updated AS (
			UPDATE lista_deseos
			SET 
				nombre = COALESCE($1, nombre),
				presupuesto = COALESCE($2, presupuesto),
				valor_estimado = COALESCE($3, valor_estimado),
				comprado = COALESCE($4, comprado),
				justificacion = COALESCE($5, justificacion),
				fecha_compra = CASE 
					WHEN $6 = 1 THEN COALESCE($7, fecha_compra, CURRENT_TIMESTAMP)
					WHEN $6 = 2 THEN NULL
					ELSE fecha_compra
				END,
				grupo_item_finanzas_id = COALESCE($8, grupo_item_finanzas_id),
				eliminado = COALESCE($9, eliminado),
				fecha_actualizacion = CURRENT_TIMESTAMP
			WHERE id = $10 AND user_id = $11 AND eliminado = false
			RETURNING id, user_id, nombre, presupuesto, valor_estimado, comprado,
			          justificacion, fecha_creacion, fecha_actualizacion, fecha_compra,
			          grupo_item_finanzas_id, eliminado
		)
		SELECT 
			u.id, u.user_id, u.nombre, u.presupuesto, u.valor_estimado, u.comprado,
			u.justificacion, u.fecha_creacion, u.fecha_actualizacion, u.fecha_compra,
			u.grupo_item_finanzas_id, g.nombre AS grupo_item_finanzas_nombre, u.eliminado
		FROM updated u
		LEFT JOIN grupo_item_finanzas g ON g.id = u.grupo_item_finanzas_id;
	`

	var item models.ListaDeseosResponse
	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Presupuesto,
		req.ValorEstimado,
		req.Comprado,
		req.Justificacion,
		modoFechaCompra,
		fechaCompraVal,
		req.GrupoItemFinanzasID,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&item.ID,
		&item.UserID,
		&item.Nombre,
		&item.Presupuesto,
		&item.ValorEstimado,
		&item.Comprado,
		&item.Justificacion,
		&item.FechaCreacion,
		&item.FechaActualizacion,
		&item.FechaCompra,
		&item.GrupoItemFinanzasID,
		&item.GrupoItemFinanzasNombre,
		&item.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:ListaDeseos.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &item, nil
}

// Delete realiza el borrado lógico (soft delete)
func (r *ListaDeseosRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE lista_deseos
		SET eliminado = true, fecha_actualizacion = CURRENT_TIMESTAMP
		WHERE id = $1
		  AND user_id = $2
		  AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:ListaDeseos.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar ítem de lista de deseos: %w", err)
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:ListaDeseos.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró el ítem con id %d o no tiene permisos", id)
	}

	return nil
}
