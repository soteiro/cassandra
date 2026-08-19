package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// instanciar db
type NotasProyectoRepository struct {
	db *pgxpool.Pool
}

// constructor del repo
func NewNotasProyectoRepository(db *pgxpool.Pool) *NotasProyectoRepository {
	return &NotasProyectoRepository{db: db}
}

// funcion para crear una nota de proyecto
func (r *NotasProyectoRepository) Create(ctx context.Context, req *models.NotasProyectoRequest) (*models.NotasProyectoResponse, error) {
	var notaProyecto models.NotasProyectoResponse
	query := `
	INSERT INTO notas_proyecto (user_id, proyecto_id, nota_proyecto)
	VALUES ($1, $2, $3)
	RETURNING id, user_id, proyecto_id, nota_proyecto, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.ProyectoID,
		req.Nota,
	).Scan(
		&notaProyecto.ID,
		&notaProyecto.UserID,
		&notaProyecto.ProyectoID,
		&notaProyecto.Nota,
		&notaProyecto.FechaCreacion,
		&notaProyecto.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.Create] Error en SQL INSERT: %v | user_id=%d proyecto_id=%d", err, req.UserID, req.ProyectoID)
		return nil, fmt.Errorf("error al crear la nota de proyecto: %w", err)
	}

	return &notaProyecto, nil
}

func (r *NotasProyectoRepository) GetAll(ctx context.Context, userID int) ([]*models.NotasProyectoResponse, error) {
	query := `
	SELECT id,
		proyecto_id,
		user_id,
		nota_proyecto,
		fecha_creacion,
		eliminado 
	FROM notas_proyecto np
	WHERE eliminado = false
	  AND np.user_id = $1
	ORDER BY np.fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:NotasProyecto.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener las notas de proyecto: %w", err)
	}
	defer rows.Close()

	notasProyecto := make([]*models.NotasProyectoResponse, 0)

	for rows.Next() {
		var notaProyecto models.NotasProyectoResponse
		err := rows.Scan(
			&notaProyecto.ID,
			&notaProyecto.ProyectoID,
			&notaProyecto.UserID,
			&notaProyecto.Nota,
			&notaProyecto.FechaCreacion,
			&notaProyecto.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:NotasProyecto.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear la nota de proyecto: %w", err)
		}
		notasProyecto = append(notasProyecto, &notaProyecto)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:NotasProyecto.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return notasProyecto, nil
}

func (r *NotasProyectoRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
	UPDATE notas_proyecto
	SET eliminado = true
	WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:NotasProyecto.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar la nota de proyecto: %w", err)
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:NotasProyecto.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró la nota de proyecto con id %d o no tiene permisos", id)
	}

	return nil
}

func (r *NotasProyectoRepository) GetById(ctx context.Context, id int, userID int) (*models.NotasProyectoResponse, error) {
	var np models.NotasProyectoResponse
	query := `
	SELECT 
		id,
		proyecto_id,
		user_id,
		nota_proyecto,
		fecha_creacion,
		eliminado
	FROM notas_proyecto
	WHERE id = $1 
	  AND user_id = $2
	  AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&np.ID,
		&np.ProyectoID,
		&np.UserID,
		&np.Nota,
		&np.FechaCreacion,
		&np.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.GetById] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &np, nil
}

// UPDATE con COALESCE
func (r *NotasProyectoRepository) Update(ctx context.Context, id int, userID int, req *models.NotasProyectoUpdateRequest) (*models.NotasProyectoResponse, error) {
	var np models.NotasProyectoResponse

	query := `
	UPDATE notas_proyecto
	SET 
		nota_proyecto = COALESCE($1, nota_proyecto),
		eliminado = COALESCE($2, eliminado)
	WHERE id = $3 
	  AND user_id = $4
	  AND eliminado = false
	RETURNING id, proyecto_id, user_id, nota_proyecto, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.Nota, req.Eliminado, id, userID).Scan(
		&np.ID,
		&np.ProyectoID,
		&np.UserID,
		&np.Nota,
		&np.FechaCreacion,
		&np.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &np, nil
}

func (r *NotasProyectoRepository) GetByProyectoID(ctx context.Context, proyectoID int, userID int) ([]*models.NotasProyectoResponse, error) {
	query := `
	SELECT id, proyecto_id, user_id, nota_proyecto, fecha_creacion, eliminado 
	FROM notas_proyecto np
	WHERE eliminado = false
	  AND np.proyecto_id = $1
	  AND np.user_id = $2
	ORDER BY np.fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, proyectoID, userID)
	if err != nil {
		log.Printf("[REPO:NotasProyecto.GetByProyectoID] Error en SQL SELECT: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, fmt.Errorf("error al obtener las notas de proyecto por proyecto_id: %w", err)
	}
	defer rows.Close()

	notasProyecto := make([]*models.NotasProyectoResponse, 0)

	for rows.Next() {
		var notaProyecto models.NotasProyectoResponse
		err := rows.Scan(
			&notaProyecto.ID,
			&notaProyecto.ProyectoID,
			&notaProyecto.UserID,
			&notaProyecto.Nota,
			&notaProyecto.FechaCreacion,
			&notaProyecto.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:NotasProyecto.GetByProyectoID] Error al escanear fila: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
			return nil, fmt.Errorf("error al escanear la nota de proyecto: %w", err)
		}
		notasProyecto = append(notasProyecto, &notaProyecto)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:NotasProyecto.GetByProyectoID] Error al iterar filas: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, err
	}

	return notasProyecto, nil
}