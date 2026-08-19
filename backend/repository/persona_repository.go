package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PersonaRepository struct {
	db *pgxpool.Pool
}

func NewPersonaRepository(db *pgxpool.Pool) *PersonaRepository {
	return &PersonaRepository{db: db}
}

// Create inserta una nueva persona
func (r *PersonaRepository) Create(ctx context.Context, req *models.PersonaRequest) (*models.PersonaResponse, error) {
	var p models.PersonaResponse
	query := `
	INSERT INTO persona (user_id, nombre, alias, entorno, informacion)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id, user_id, nombre, alias, entorno, informacion, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.Nombre,
		req.Alias,
		req.Entorno,
		req.Informacion,
	).Scan(
		&p.ID,
		&p.UserID,
		&p.Nombre,
		&p.Alias,
		&p.Entorno,
		&p.Informacion,
		&p.FechaCreacion,
		&p.Eliminado,
	)

	if err != nil {
		log.Printf("error al crear persona: %v", err)
		return nil, fmt.Errorf("error al crear persona: %w", err)
	}

	return &p, nil
}

// GetAll obtiene todas las personas activas de un usuario
func (r *PersonaRepository) GetAll(ctx context.Context, userID int) ([]*models.PersonaResponse, error) {
	query := `
	SELECT id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado
	FROM persona
	WHERE user_id = $1
	  AND eliminado = false
	ORDER BY id DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("error al obtener personas: %v", err)
		return nil, fmt.Errorf("error al obtener personas: %w", err)
	}
	defer rows.Close()

	personas := make([]*models.PersonaResponse, 0)

	for rows.Next() {
		var p models.PersonaResponse
		err := rows.Scan(
			&p.ID,
			&p.UserID,
			&p.Nombre,
			&p.Alias,
			&p.Entorno,
			&p.Informacion,
			&p.FechaCreacion,
			&p.Eliminado,
		)
		if err != nil {
			log.Printf("error al escanear persona: %v", err)
			return nil, fmt.Errorf("error al escanear persona: %w", err)
		}
		personas = append(personas, &p)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return personas, nil
}

// GetById obtiene una persona específica por ID
func (r *PersonaRepository) GetById(ctx context.Context, id int, userID int) (*models.PersonaResponse, error) {
	var p models.PersonaResponse
	query := `
	SELECT id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado
	FROM persona
	WHERE id = $1
	  AND user_id = $2
	  AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&p.ID,
		&p.UserID,
		&p.Nombre,
		&p.Alias,
		&p.Entorno,
		&p.Informacion,
		&p.FechaCreacion,
		&p.Eliminado,
	)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

// Update actualiza una persona con COALESCE
func (r *PersonaRepository) Update(ctx context.Context, id int, userID int, req *models.PersonaUpdateRequest) (*models.PersonaResponse, error) {
	var p models.PersonaResponse
	query := `
	UPDATE persona
	SET 
		nombre = COALESCE($1, nombre),
		alias = COALESCE($2, alias),
		entorno = COALESCE($3, entorno),
		informacion = COALESCE($4, informacion),
		eliminado = COALESCE($5, eliminado)
	WHERE id = $6
	  AND user_id = $7
	  AND eliminado = false
	RETURNING id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Alias,
		req.Entorno,
		req.Informacion,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&p.ID,
		&p.UserID,
		&p.Nombre,
		&p.Alias,
		&p.Entorno,
		&p.Informacion,
		&p.FechaCreacion,
		&p.Eliminado,
	)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

// Delete realiza el borrado lógico (soft delete)
func (r *PersonaRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
	UPDATE persona
	SET eliminado = true
	WHERE id = $1
	  AND user_id = $2
	  AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("error al eliminar persona: %v", err)
		return fmt.Errorf("error al eliminar persona: %w", err)
	}

	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró la persona con id %d o no tiene permisos", id)
	}

	return nil
}
