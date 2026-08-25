package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReflexionesRepository struct {
	db *pgxpool.Pool
}

func NewReflexionesRepository(db *pgxpool.Pool) *ReflexionesRepository {
	return &ReflexionesRepository{db: db}
}

// Create inserta una nueva reflexión
func (r *ReflexionesRepository) Create(ctx context.Context, req *models.CreateReflexionRequest) (*models.ReflexionResponse, error) {
	tipo := req.Tipo
	if tipo == "" {
		tipo = "reflexion"
	}

	var res models.ReflexionResponse
	query := `
	INSERT INTO reflexiones (user_id, reflexion, tipo)
	VALUES ($1, $2, $3)
	RETURNING id, user_id, reflexion, tipo, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.Reflexion,
		tipo,
	).Scan(
		&res.ID,
		&res.UserID,
		&res.Reflexion,
		&res.Tipo,
		&res.FechaCreacion,
		&res.FechaActualizacion,
		&res.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Reflexiones.Create] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear reflexión: %w", err)
	}

	return &res, nil
}

// GetAll obtiene todas las reflexiones activas de un usuario (con filtro opcional de tipo)
func (r *ReflexionesRepository) GetAll(ctx context.Context, userID int, tipoFilter string) ([]*models.ReflexionResponse, error) {
	var query string
	var args []interface{}

	if tipoFilter != "" {
		query = `
		SELECT id, user_id, reflexion, tipo, fecha_creacion, fecha_actualizacion, eliminado
		FROM reflexiones
		WHERE user_id = $1
		  AND tipo = $2
		  AND eliminado = false
		ORDER BY fecha_creacion DESC, id DESC
		`
		args = []interface{}{userID, tipoFilter}
	} else {
		query = `
		SELECT id, user_id, reflexion, tipo, fecha_creacion, fecha_actualizacion, eliminado
		FROM reflexiones
		WHERE user_id = $1
		  AND eliminado = false
		ORDER BY fecha_creacion DESC, id DESC
		`
		args = []interface{}{userID}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("[REPO:Reflexiones.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener reflexiones: %w", err)
	}
	defer rows.Close()

	reflexiones := make([]*models.ReflexionResponse, 0)

	for rows.Next() {
		var item models.ReflexionResponse
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Reflexion,
			&item.Tipo,
			&item.FechaCreacion,
			&item.FechaActualizacion,
			&item.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:Reflexiones.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear reflexión: %w", err)
		}
		reflexiones = append(reflexiones, &item)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Reflexiones.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return reflexiones, nil
}

// GetByID obtiene una reflexión específica por ID y UserID
func (r *ReflexionesRepository) GetByID(ctx context.Context, id int, userID int) (*models.ReflexionResponse, error) {
	var res models.ReflexionResponse
	query := `
	SELECT id, user_id, reflexion, tipo, fecha_creacion, fecha_actualizacion, eliminado
	FROM reflexiones
	WHERE id = $1
	  AND user_id = $2
	  AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&res.ID,
		&res.UserID,
		&res.Reflexion,
		&res.Tipo,
		&res.FechaCreacion,
		&res.FechaActualizacion,
		&res.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Reflexiones.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &res, nil
}

// Update actualiza una reflexión con COALESCE
func (r *ReflexionesRepository) Update(ctx context.Context, id int, userID int, req *models.UpdateReflexionRequest) (*models.ReflexionResponse, error) {
	var res models.ReflexionResponse
	query := `
	UPDATE reflexiones
	SET 
		reflexion = COALESCE($1, reflexion),
		tipo = COALESCE($2, tipo),
		eliminado = COALESCE($3, eliminado),
		fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $4
	  AND user_id = $5
	  AND eliminado = false
	RETURNING id, user_id, reflexion, tipo, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Reflexion,
		req.Tipo,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&res.ID,
		&res.UserID,
		&res.Reflexion,
		&res.Tipo,
		&res.FechaCreacion,
		&res.FechaActualizacion,
		&res.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Reflexiones.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &res, nil
}

// Delete realiza el borrado lógico (soft delete)
func (r *ReflexionesRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
	UPDATE reflexiones
	SET eliminado = true, fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $1
	  AND user_id = $2
	  AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Reflexiones.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar reflexión: %w", err)
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Reflexiones.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró la reflexión con id %d o no tiene permisos", id)
	}

	return nil
}
