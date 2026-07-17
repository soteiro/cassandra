package repository

import (
	"cassandra/models"
	"context"
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

