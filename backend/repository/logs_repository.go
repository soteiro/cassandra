package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LogsRepository struct {
	db *pgxpool.Pool
}

func NewLogsRepository(db *pgxpool.Pool) *LogsRepository {
	return &LogsRepository{db: db}
}

// Guardar un log en crudo
func (r *LogsRepository) Create(ctx context.Context, userID int, req *models.CreateProjectLogRequest) (*models.ProjectLog, error) {
	var l models.ProjectLog
	query := `
		INSERT INTO project_logs (proyecto_id, user_id, titulo, contenido_raw)
		VALUES ($1, $2, $3, $4)
		RETURNING id, proyecto_id, user_id, titulo, contenido_raw, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.ProyectoID,
		userID,
		req.Titulo,
		req.ContenidoRaw,
	).Scan(
		&l.ID,
		&l.ProyectoID,
		&l.UserID,
		&l.Titulo,
		&l.ContenidoRaw,
		&l.FechaCreacion,
		&l.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Logs.Create] Error en SQL INSERT: %v | user_id=%d proyecto_id=%d", err, userID, req.ProyectoID)
		return nil, err
	}

	return &l, nil
}

// Obtener todos los logs de un proyecto para el usuario autenticado
func (r *LogsRepository) GetByProyectoID(ctx context.Context, userID int, proyectoID int) ([]models.ProjectLog, error) {
	query := `
		SELECT id, proyecto_id, user_id, titulo, contenido_raw, fecha_creacion, eliminado
		FROM project_logs
		WHERE proyecto_id = $1
		  AND user_id = $2
		  AND eliminado IS false
		ORDER BY fecha_creacion DESC
	`

	rows, err := r.db.Query(ctx, query, proyectoID, userID)
	if err != nil {
		log.Printf("[REPO:Logs.GetByProyectoID] Error en SQL SELECT: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		return nil, err
	}
	defer rows.Close()

	var logsList []models.ProjectLog
	for rows.Next() {
		var l models.ProjectLog
		err := rows.Scan(
			&l.ID,
			&l.ProyectoID,
			&l.UserID,
			&l.Titulo,
			&l.ContenidoRaw,
			&l.FechaCreacion,
			&l.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:Logs.GetByProyectoID] Error al escanear fila: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
			return nil, err
		}
		logsList = append(logsList, l)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Logs.GetByProyectoID] Error al iterar filas: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		return nil, err
	}

	if logsList == nil {
		logsList = []models.ProjectLog{}
	}

	return logsList, nil
}

// Obtener un log por su ID
func (r *LogsRepository) GetByID(ctx context.Context, userID int, id int) (*models.ProjectLog, error) {
	var l models.ProjectLog
	query := `
		SELECT id, proyecto_id, user_id, titulo, contenido_raw, fecha_creacion, eliminado
		FROM project_logs
		WHERE id = $1
		  AND user_id = $2
		  AND eliminado IS false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&l.ID,
		&l.ProyectoID,
		&l.UserID,
		&l.Titulo,
		&l.ContenidoRaw,
		&l.FechaCreacion,
		&l.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Logs.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &l, nil
}

// Actualizar un log en crudo
func (r *LogsRepository) Update(ctx context.Context, userID int, id int, req *models.UpdateProjectLogRequest) (*models.ProjectLog, error) {
	var l models.ProjectLog
	query := `
		UPDATE project_logs
		SET 
			titulo = COALESCE($1, titulo),
			contenido_raw = COALESCE($2, contenido_raw)
		WHERE id = $3
		  AND user_id = $4
		  AND eliminado = false
		RETURNING id, proyecto_id, user_id, titulo, contenido_raw, fecha_creacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Titulo,
		req.ContenidoRaw,
		id,
		userID,
	).Scan(
		&l.ID,
		&l.ProyectoID,
		&l.UserID,
		&l.Titulo,
		&l.ContenidoRaw,
		&l.FechaCreacion,
		&l.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:Logs.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &l, nil
}

// Soft delete de un log
func (r *LogsRepository) Delete(ctx context.Context, userID int, id int) error {
	query := `
		UPDATE project_logs
		SET eliminado = true
		WHERE id = $1
		  AND user_id = $2
		  AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Logs.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Logs.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró el log con id: %d o no tiene permisos", id)
	}

	return nil
}

