package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TareasRepository struct {
	db *pgxpool.Pool
}

// constructor del repo tareas
func NewTareasRepository(db *pgxpool.Pool) *TareasRepository {
	return &TareasRepository{db: db}
}

// crear una tarea
func (r *TareasRepository) Create(ctx context.Context, req *models.TareaRequest) (*models.TareaResponse, error) {
	var tarea models.TareaResponse
	query := `
		INSERT INTO tareas (
			nombre, 
			descripcion, 
			comentario, 
			user_id, 
			estado,
			proyecto_id
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, nombre, descripcion, comentario, fecha_creacion, estado, user_id, proyecto_id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.UserID,
		req.Estado,
		req.ProyectID,
	).Scan(
		&tarea.ID,
		&tarea.Nombre,
		&tarea.Descripcion,
		&tarea.Comentario,
		&tarea.FechaCreacion,
		&tarea.Estado,
		&tarea.UserID,
		&tarea.ProyectID,
	)

	if err != nil {
		log.Printf("error al crear la tarea: %v", err)
		return nil, err
	}
	return &tarea, nil
}

// GetAll obtiene todas las tareas de un usuario específico
func (r *TareasRepository) GetAll(ctx context.Context, userID int) ([]models.TareaResponse, error) {
	query := `
		SELECT id, nombre, descripcion, comentario, fecha_creacion, estado, user_id, proyecto_id
		FROM tareas
		WHERE user_id = $1
		AND eliminado = false
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		log.Printf("error al obtener las tareas: %v", err)
		return nil, err
	}
	defer rows.Close()

	var tareas []models.TareaResponse

	for rows.Next() {
		var tarea models.TareaResponse
		err := rows.Scan(
			&tarea.ID,
			&tarea.Nombre,
			&tarea.Descripcion,
			&tarea.Comentario,
			&tarea.FechaCreacion,
			&tarea.Estado,
			&tarea.UserID,
			&tarea.ProyectID,
		)
		if err != nil {
			log.Printf("error al escanear la tarea: %v", err)
			return nil, err
		}
		tareas = append(tareas, tarea)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return tareas, nil
}

// GetByID obtiene una tarea específica validando que le pertenezca al usuario
func (r *TareasRepository) GetByID(ctx context.Context, id int, userID int) (*models.TareaResponse, error) {
	var tarea models.TareaResponse
	query := `
		SELECT id, nombre, descripcion, comentario, fecha_creacion, estado, user_id, proyecto_id
		FROM tareas
		WHERE id = $1
		AND user_id = $2
		AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&tarea.ID,
		&tarea.Nombre,
		&tarea.Descripcion,
		&tarea.Comentario,
		&tarea.FechaCreacion,
		&tarea.Estado,
		&tarea.UserID,
		&tarea.ProyectID,
	)

	if err != nil {
		log.Printf("error al obtener la tarea por ID: %v", err)
		return nil, err
	}

	return &tarea, nil
}

// Update actualiza una tarea usando COALESCE y asegurando la pertenencia del usuario
func (r *TareasRepository) Update(ctx context.Context, id int, userID int, req *models.TareaUpdateRequest) (*models.TareaUpdateResponse, error) {
	var tarea models.TareaUpdateResponse
	query := `
		UPDATE tareas
		SET nombre = COALESCE($1, nombre),
			descripcion = COALESCE($2, descripcion),
			comentario = COALESCE($3, comentario),
			estado = COALESCE($4, estado),
			eliminado = COALESCE($5, eliminado)
		WHERE id = $6 AND user_id = $7
		RETURNING id, nombre, descripcion, comentario, estado, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.Estado,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&tarea.ID,
		&tarea.Nombre,
		&tarea.Descripcion,
		&tarea.Comentario,
		&tarea.Estado,
		&tarea.Eliminado,
	)

	if err != nil {
		log.Printf("error al modificar la tarea: %v", err)
		return nil, err
	}

	return &tarea, nil
}

// Delete realiza el borrado lógico de una tarea asegurando la pertenencia del usuario
func (r *TareasRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE tareas
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("error al eliminar la tarea: %v", err)
		return err
	}

	if res.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró la tarea o no tienes permisos para eliminarla")
	}

	return nil
}