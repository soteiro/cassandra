package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProyectRepository struct {
	db *pgxpool.Pool
}

// constructor del repo proyectos
func NewProyectRepository(db *pgxpool.Pool) *ProyectRepository{
	return &ProyectRepository{db : db}
}

// crear un proyecto
func (r *ProyectRepository) Create(ctx context.Context, req *models.ProyectRequest) (*models.ProyectResponse, error){
	var proyect models.ProyectResponse
	query := `
		INSERT INTO proyectos (nombre, descripcion, comentario, user_id)
		VALUES ($1, $2,$3, $4)
		RETURNING id, nombre, descripcion, comentario, fecha_creacion
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.UserID,
	).Scan(
		&proyect.ID,
		&proyect.Nombre,
		&proyect.Descripcion,
		&proyect.Comentario,
		&proyect.FechaCreacion,
	)

	if err != nil {
		log.Printf("error al crear el proyecto: %v", err)
		return nil, err
	}
	return &proyect, nil
}

func (r *ProyectRepository) GetAll(ctx context.Context, UserID int) ([]models.ProyectResponse, error){
	query := `
	SELECT 
	p.id,
	p.nombre,
	p.descripcion,
	p.comentario,
	p.fecha_creacion,
	p.estado 
	from proyectos p
	WHERE p.user_id = $1
	AND p.eliminado is false
	`

	rows, err := r.db.Query(
		ctx,
		query,
		UserID, 
		)

	if err != nil {
		return  nil, err
	}
	// terminar la conexion 
	defer rows.Close()

	var proyects []models.ProyectResponse
	for rows.Next() {
		var p models.ProyectResponse
		err := rows.Scan(
			&p.ID,
			&p.Nombre,
			&p.Descripcion,
			&p.Comentario,
			&p.FechaCreacion,
			&p.Estado,
		)
		if err != nil {
			return nil, err
		}

		proyects = append(proyects, p)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return proyects, nil
}

func (r *ProyectRepository) Delete(ctx context.Context, id int, user_id int) (*models.ProyectResponse, error) {
	query := `
	UPDATE proyectos
	SET eliminado = true
	WHERE id = $1
	AND user_id = $2
	`

	res , err := r.db.Exec(ctx, query, id, user_id)
	if err != nil {
		log.Printf("error al borrar el proyecto: %v", err)
		return nil, err
	}
	if res.RowsAffected() == 0{
		return nil, fmt.Errorf("no se encontro el proyecto con id: %d", id) 
	}

	return nil, nil
}

//
func (r *ProyectRepository) GetById(ctx context.Context, id int, userID int) (*models.ProyectResponse, error) {
	var p models.ProyectResponse
	query := `
	SELECT 
	id, 
	nombre, 
	descripcion, 
	comentario,
	fecha_creacion,
	estado
	FROM proyectos
	WHERE id = $1
	AND user_id  = $2
	AND eliminado IS false
	`
	err := r.db.QueryRow(
		ctx,
		query,
		id,
		userID,
	).Scan(
		&p.ID,
		&p.Nombre,
		&p.Descripcion,
		&p.Comentario,
		&p.FechaCreacion,
		&p.Estado,
	)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

// Update con COALLECENCE
func (r *ProyectRepository) Update(ctx context.Context, id int, userID int, req *models.ProyectUpdateRequest) (*models.ProyectUpdateResponse, error) {
	var p models.ProyectUpdateResponse

	query := `
		UPDATE proyectos
		SET 
			nombre = COALESCE($1, nombre),
			descripcion = COALESCE($2, descripcion),
			comentario = COALESCE($3, comentario),
			estado = COALESCE($4, estado)
		WHERE id = $5
		AND user_id = $6
		AND eliminado = false
		RETURNING id, nombre, descripcion, comentario, estado
	`
	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.Estado,
		id,
		userID,
	).Scan(
		&p.ID,
		&p.Nombre,
		&p.Descripcion,
		&p.Comentario,
		&p.Estado,
	)

	if err != nil {
		log.Printf("error al modificar el proyecto: %v", err)
		return nil, err
	}

	return &p, nil
}