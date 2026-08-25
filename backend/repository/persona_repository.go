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
	INSERT INTO persona (user_id, nombre, alias, entorno, informacion, es_yo)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING id, user_id, nombre, alias, entorno, informacion, fecha_creacion, eliminado, es_yo
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.Nombre,
		req.Alias,
		req.Entorno,
		req.Informacion,
		req.EsYo,
	).Scan(
		&p.ID,
		&p.UserID,
		&p.Nombre,
		&p.Alias,
		&p.Entorno,
		&p.Informacion,
		&p.FechaCreacion,
		&p.Eliminado,
		&p.EsYo,
	)

	if err != nil {
		log.Printf("[REPO:Persona.Create] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, fmt.Errorf("error al crear persona: %w", err)
	}

	return &p, nil
}

// GetAll obtiene todas las personas activas de un usuario
func (r *PersonaRepository) GetAll(ctx context.Context, userID int) ([]*models.PersonaResponse, error) {
	query := `
	SELECT id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado, es_yo
	FROM persona
	WHERE user_id = $1
	  AND eliminado = false
	ORDER BY es_yo DESC, id DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:Persona.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
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
			&p.EsYo,
		)
		if err != nil {
			log.Printf("[REPO:Persona.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear persona: %w", err)
		}
		personas = append(personas, &p)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Persona.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return personas, nil
}

// GetById obtiene una persona específica por ID
func (r *PersonaRepository) GetById(ctx context.Context, id int, userID int) (*models.PersonaResponse, error) {
	var p models.PersonaResponse
	query := `
	SELECT id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado, es_yo
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
		&p.EsYo,
	)

	if err != nil {
		log.Printf("[REPO:Persona.GetById] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
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
		eliminado = COALESCE($5, eliminado),
		es_yo = COALESCE($6, es_yo)
	WHERE id = $7
	  AND user_id = $8
	  AND eliminado = false
	RETURNING id, user_id, nombre, COALESCE(alias, ''), COALESCE(entorno, ''), COALESCE(informacion, ''), fecha_creacion, eliminado, es_yo
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Alias,
		req.Entorno,
		req.Informacion,
		req.Eliminado,
		req.EsYo,
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
		&p.EsYo,
	)

	if err != nil {
		log.Printf("[REPO:Persona.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
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
		log.Printf("[REPO:Persona.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar persona: %w", err)
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Persona.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró la persona con id %d o no tiene permisos", id)
	}

	return nil
}

