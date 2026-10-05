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
	WITH inserted AS (
		INSERT INTO notas_proyecto (user_id, proyecto_id, tarea_id, nota_proyecto)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, proyecto_id, tarea_id, nota_proyecto, fecha_creacion, eliminado
	)
	SELECT 
		i.id, 
		i.user_id, 
		i.proyecto_id, 
		i.tarea_id, 
		i.nota_proyecto, 
		i.fecha_creacion, 
		i.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM inserted i
	LEFT JOIN tareas_proyectos t ON t.id = i.tarea_id AND t.user_id = i.user_id
	`

	var tareaNombre string
	err := r.db.QueryRow(
		ctx,
		query,
		req.UserID,
		req.ProyectoID,
		req.TareaID,
		req.Nota,
	).Scan(
		&notaProyecto.ID,
		&notaProyecto.UserID,
		&notaProyecto.ProyectoID,
		&notaProyecto.TareaID,
		&notaProyecto.Nota,
		&notaProyecto.FechaCreacion,
		&notaProyecto.Eliminado,
		&tareaNombre,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.Create] Error en SQL INSERT: %v | user_id=%d proyecto_id=%d", err, req.UserID, req.ProyectoID)
		return nil, fmt.Errorf("error al crear la nota de proyecto: %w", err)
	}

	if tareaNombre != "" {
		notaProyecto.TareaNombre = &tareaNombre
	}

	return &notaProyecto, nil
}

func (r *NotasProyectoRepository) GetAll(ctx context.Context, userID int) ([]*models.NotasProyectoResponse, error) {
	query := `
	SELECT 
		np.id,
		np.proyecto_id,
		np.user_id,
		np.tarea_id,
		np.nota_proyecto,
		np.fecha_creacion,
		np.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM notas_proyecto np
	LEFT JOIN tareas_proyectos t ON t.id = np.tarea_id AND t.user_id = np.user_id
	WHERE np.eliminado = false
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
		var tareaNombre string
		err := rows.Scan(
			&notaProyecto.ID,
			&notaProyecto.ProyectoID,
			&notaProyecto.UserID,
			&notaProyecto.TareaID,
			&notaProyecto.Nota,
			&notaProyecto.FechaCreacion,
			&notaProyecto.Eliminado,
			&tareaNombre,
		)
		if err != nil {
			log.Printf("[REPO:NotasProyecto.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, fmt.Errorf("error al escanear la nota de proyecto: %w", err)
		}
		if tareaNombre != "" {
			notaProyecto.TareaNombre = &tareaNombre
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
		return fmt.Errorf("%w: no se encontró la nota de proyecto con id %d o no tiene permisos", ErrNoEncontrado, id)
	}

	return nil
}

func (r *NotasProyectoRepository) GetById(ctx context.Context, id int, userID int) (*models.NotasProyectoResponse, error) {
	var np models.NotasProyectoResponse
	var tareaNombre string
	query := `
	SELECT 
		np.id,
		np.proyecto_id,
		np.user_id,
		np.tarea_id,
		np.nota_proyecto,
		np.fecha_creacion,
		np.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM notas_proyecto np
	LEFT JOIN tareas_proyectos t ON t.id = np.tarea_id AND t.user_id = np.user_id
	WHERE np.id = $1 
	  AND np.user_id = $2
	  AND np.eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&np.ID,
		&np.ProyectoID,
		&np.UserID,
		&np.TareaID,
		&np.Nota,
		&np.FechaCreacion,
		&np.Eliminado,
		&tareaNombre,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.GetById] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	if tareaNombre != "" {
		np.TareaNombre = &tareaNombre
	}

	return &np, nil
}

// UPDATE con COALESCE y soporte para limpiar o actualizar tarea_id
func (r *NotasProyectoRepository) Update(ctx context.Context, id int, userID int, req *models.NotasProyectoUpdateRequest) (*models.NotasProyectoResponse, error) {
	var np models.NotasProyectoResponse
	var tareaNombre string

	clearTarea := false
	if req.ClearTareaID != nil && *req.ClearTareaID {
		clearTarea = true
	}

	query := `
	WITH updated AS (
		UPDATE notas_proyecto
		SET 
			nota_proyecto = COALESCE($1, nota_proyecto),
			tarea_id = CASE 
				WHEN $2 = true THEN NULL 
				WHEN $3::int IS NOT NULL THEN $3::int 
				ELSE tarea_id 
			END,
			eliminado = COALESCE($4, eliminado)
		WHERE id = $5 
		  AND user_id = $6
		  AND eliminado = false
		RETURNING id, proyecto_id, user_id, tarea_id, nota_proyecto, fecha_creacion, eliminado
	)
	SELECT 
		u.id, 
		u.proyecto_id, 
		u.user_id, 
		u.tarea_id, 
		u.nota_proyecto, 
		u.fecha_creacion, 
		u.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM updated u
	LEFT JOIN tareas_proyectos t ON t.id = u.tarea_id AND t.user_id = u.user_id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nota,
		clearTarea,
		req.TareaID,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&np.ID,
		&np.ProyectoID,
		&np.UserID,
		&np.TareaID,
		&np.Nota,
		&np.FechaCreacion,
		&np.Eliminado,
		&tareaNombre,
	)

	if err != nil {
		log.Printf("[REPO:NotasProyecto.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	if tareaNombre != "" {
		np.TareaNombre = &tareaNombre
	}

	return &np, nil
}

func (r *NotasProyectoRepository) GetByProyectoID(ctx context.Context, proyectoID int, userID int) ([]*models.NotasProyectoResponse, error) {
	query := `
	SELECT 
		np.id, 
		np.proyecto_id, 
		np.user_id, 
		np.tarea_id,
		np.nota_proyecto, 
		np.fecha_creacion, 
		np.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM notas_proyecto np
	LEFT JOIN tareas_proyectos t ON t.id = np.tarea_id AND t.user_id = np.user_id
	WHERE np.eliminado = false
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
		var tareaNombre string
		err := rows.Scan(
			&notaProyecto.ID,
			&notaProyecto.ProyectoID,
			&notaProyecto.UserID,
			&notaProyecto.TareaID,
			&notaProyecto.Nota,
			&notaProyecto.FechaCreacion,
			&notaProyecto.Eliminado,
			&tareaNombre,
		)
		if err != nil {
			log.Printf("[REPO:NotasProyecto.GetByProyectoID] Error al escanear fila: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
			return nil, fmt.Errorf("error al escanear la nota de proyecto: %w", err)
		}
		if tareaNombre != "" {
			notaProyecto.TareaNombre = &tareaNombre
		}
		notasProyecto = append(notasProyecto, &notaProyecto)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:NotasProyecto.GetByProyectoID] Error al iterar filas: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, err
	}

	return notasProyecto, nil
}

// GetByTareaID obtiene todas las notas asociadas a una tarea específica
func (r *NotasProyectoRepository) GetByTareaID(ctx context.Context, tareaID int, userID int) ([]*models.NotasProyectoResponse, error) {
	query := `
	SELECT 
		np.id, 
		np.proyecto_id, 
		np.user_id, 
		np.tarea_id,
		np.nota_proyecto, 
		np.fecha_creacion, 
		np.eliminado,
		COALESCE(t.nombre, '') AS tarea_nombre
	FROM notas_proyecto np
	LEFT JOIN tareas_proyectos t ON t.id = np.tarea_id AND t.user_id = np.user_id
	WHERE np.eliminado = false
	  AND np.tarea_id = $1
	  AND np.user_id = $2
	ORDER BY np.fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, tareaID, userID)
	if err != nil {
		log.Printf("[REPO:NotasProyecto.GetByTareaID] Error en SQL SELECT: %v | tarea_id=%d user_id=%d", err, tareaID, userID)
		return nil, fmt.Errorf("error al obtener las notas por tarea_id: %w", err)
	}
	defer rows.Close()

	notasProyecto := make([]*models.NotasProyectoResponse, 0)

	for rows.Next() {
		var notaProyecto models.NotasProyectoResponse
		var tareaNombre string
		err := rows.Scan(
			&notaProyecto.ID,
			&notaProyecto.ProyectoID,
			&notaProyecto.UserID,
			&notaProyecto.TareaID,
			&notaProyecto.Nota,
			&notaProyecto.FechaCreacion,
			&notaProyecto.Eliminado,
			&tareaNombre,
		)
		if err != nil {
			log.Printf("[REPO:NotasProyecto.GetByTareaID] Error al escanear fila: %v | tarea_id=%d user_id=%d", err, tareaID, userID)
			return nil, fmt.Errorf("error al escanear la nota de proyecto: %w", err)
		}
		if tareaNombre != "" {
			notaProyecto.TareaNombre = &tareaNombre
		}
		notasProyecto = append(notasProyecto, &notaProyecto)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:NotasProyecto.GetByTareaID] Error al iterar filas: %v | tarea_id=%d user_id=%d", err, tareaID, userID)
		return nil, err
	}

	return notasProyecto, nil
}

// GetProyectoIDByTareaID obtiene el proyecto_id asociado a una tarea validando que pertenezca al usuario
func (r *NotasProyectoRepository) GetProyectoIDByTareaID(ctx context.Context, tareaID int, userID int) (int, error) {
	var proyectoID int
	query := `SELECT proyecto_id FROM tareas_proyectos WHERE id = $1 AND user_id = $2 AND eliminado = false`
	err := r.db.QueryRow(ctx, query, tareaID, userID).Scan(&proyectoID)
	if err != nil {
		return 0, err
	}
	return proyectoID, nil
}