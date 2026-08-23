package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type InteraccionesRepository struct {
	db *pgxpool.Pool
}

func NewInteraccionesRepository(db *pgxpool.Pool) *InteraccionesRepository {
	return &InteraccionesRepository{db: db}
}

// Create inserta una nueva interacción
func (r *InteraccionesRepository) Create(ctx context.Context, req *models.InteraccionRequest) (*models.InteraccionResponse, error) {
	var interaccion models.InteraccionResponse
	query := `
	INSERT INTO interacciones (user_id, persona_id, interaccion)
	VALUES ($1, $2, $3)
	RETURNING id, user_id, persona_id, interaccion, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.PersonaID,
		req.Interaccion,
	).Scan(
		&interaccion.ID,
		&interaccion.UserID,
		&interaccion.PersonaID,
		&interaccion.Interaccion,
		&interaccion.FechaCreacion,
		&interaccion.FechaActualizacion,
		&interaccion.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Interacciones.Create] Error en SQL INSERT: %v | user_id=%d persona_id=%d", err, req.UserID, req.PersonaID)
		return nil, fmt.Errorf("error al crear la interacción: %w", err)
	}

	return &interaccion, nil
}

// GetAll obtiene todas las interacciones activas de un usuario
func (r *InteraccionesRepository) GetAll(ctx context.Context, userID int) ([]*models.InteraccionResponse, error) {
	query := `
	SELECT 
		id,
		user_id,
		persona_id,
		interaccion,
		fecha_creacion,
		fecha_actualizacion,
		eliminado 
	FROM interacciones
	WHERE eliminado = false
	  AND user_id = $1
	ORDER BY fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[REPO:Interacciones.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
		return nil, fmt.Errorf("error al obtener las interacciones: %w", err)
	}
	defer rows.Close()

	interacciones := make([]*models.InteraccionResponse, 0)

	for rows.Next() {
		var interaccion models.InteraccionResponse
		err := rows.Scan(
			&interaccion.ID,
			&interaccion.UserID,
			&interaccion.PersonaID,
			&interaccion.Interaccion,
			&interaccion.FechaCreacion,
			&interaccion.FechaActualizacion,
			&interaccion.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:Interacciones.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear la interacción: %w", err)
		}
		interacciones = append(interacciones, &interaccion)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Interacciones.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return interacciones, nil
}

// GetByID obtiene una interacción por ID
func (r *InteraccionesRepository) GetByID(ctx context.Context, id int, userID int) (*models.InteraccionResponse, error) {
	var interaccion models.InteraccionResponse
	query := `
	SELECT 
		id,
		user_id,
		persona_id,
		interaccion,
		fecha_creacion,
		fecha_actualizacion,
		eliminado
	FROM interacciones
	WHERE id = $1 
	  AND user_id = $2
	  AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&interaccion.ID,
		&interaccion.UserID,
		&interaccion.PersonaID,
		&interaccion.Interaccion,
		&interaccion.FechaCreacion,
		&interaccion.FechaActualizacion,
		&interaccion.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Interacciones.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &interaccion, nil
}

// GetByPersonaID obtiene todas las interacciones activas asociadas a una persona
func (r *InteraccionesRepository) GetByPersonaID(ctx context.Context, personaID int, userID int) ([]*models.InteraccionResponse, error) {
	query := `
	SELECT 
		id,
		user_id,
		persona_id,
		interaccion,
		fecha_creacion,
		fecha_actualizacion,
		eliminado 
	FROM interacciones
	WHERE eliminado = false
	  AND persona_id = $1
	  AND user_id = $2
	ORDER BY fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, personaID, userID)
	if err != nil {
		log.Printf("[REPO:Interacciones.GetByPersonaID] Error en SQL SELECT: %v | persona_id=%d user_id=%d", err, personaID, userID)
		return nil, fmt.Errorf("error al obtener interacciones por persona_id: %w", err)
	}
	defer rows.Close()

	interacciones := make([]*models.InteraccionResponse, 0)

	for rows.Next() {
		var interaccion models.InteraccionResponse
		err := rows.Scan(
			&interaccion.ID,
			&interaccion.UserID,
			&interaccion.PersonaID,
			&interaccion.Interaccion,
			&interaccion.FechaCreacion,
			&interaccion.FechaActualizacion,
			&interaccion.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:Interacciones.GetByPersonaID] Error al escanear fila: %v | persona_id=%d user_id=%d", err, personaID, userID)
			return nil, fmt.Errorf("error al escanear interacción: %w", err)
		}
		interacciones = append(interacciones, &interaccion)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Interacciones.GetByPersonaID] Error al iterar filas: %v | persona_id=%d user_id=%d", err, personaID, userID)
		return nil, err
	}

	return interacciones, nil
}

// Update actualiza el contenido o estado de una interacción
func (r *InteraccionesRepository) Update(ctx context.Context, id int, userID int, req *models.InteraccionUpdateRequest) (*models.InteraccionResponse, error) {
	var interaccion models.InteraccionResponse

	query := `
	UPDATE interacciones
	SET 
		interaccion = COALESCE($1, interaccion),
		eliminado = COALESCE($2, eliminado),
		fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $3 
	  AND user_id = $4
	  AND eliminado = false
	RETURNING id, user_id, persona_id, interaccion, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(ctx, query, req.Interaccion, req.Eliminado, id, userID).Scan(
		&interaccion.ID,
		&interaccion.UserID,
		&interaccion.PersonaID,
		&interaccion.Interaccion,
		&interaccion.FechaCreacion,
		&interaccion.FechaActualizacion,
		&interaccion.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Interacciones.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &interaccion, nil
}

// Delete realiza un soft-delete de una interacción
func (r *InteraccionesRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
	UPDATE interacciones
	SET eliminado = true, fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Interacciones.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar la interacción: %w", err)
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Interacciones.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró la interacción con id %d o no tiene permisos", id)
	}

	return nil
}
