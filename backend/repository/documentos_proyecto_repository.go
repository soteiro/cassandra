package repository

import (
	"context"
	"fmt"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DocumentosProyectoRepository struct {
	db *pgxpool.Pool
}

func NewDocumentosProyectoRepository(db *pgxpool.Pool) *DocumentosProyectoRepository {
	return &DocumentosProyectoRepository{db: db}
}

func (r *DocumentosProyectoRepository) Create(ctx context.Context, req *models.CreateDocumentoRequest) (*models.DocumentoResponse, error) {
	var doc models.DocumentoResponse
	tipo := "general"
	if req.Tipo != "" {
		tipo = req.Tipo
	}

	query := `
	INSERT INTO documentos_proyecto (proyecto_id, user_id, titulo, contenido, tipo, tags)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING id, proyecto_id, user_id, titulo, contenido, tipo, tags, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.ProyectoID,
		req.UserID,
		req.Titulo,
		req.Contenido,
		tipo,
		req.Tags,
	).Scan(
		&doc.ID,
		&doc.ProyectoID,
		&doc.UserID,
		&doc.Titulo,
		&doc.Contenido,
		&doc.Tipo,
		&doc.Tags,
		&doc.FechaCreacion,
		&doc.FechaActualizacion,
		&doc.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:DocumentosProyecto.Create] Error en SQL INSERT: %v | user_id=%d proyecto_id=%d", err, req.UserID, req.ProyectoID)
		return nil, fmt.Errorf("error al crear el documento: %w", err)
	}

	return &doc, nil
}

func (r *DocumentosProyectoRepository) GetByProyectoID(ctx context.Context, proyectoID int, userID int, tipoFilter string) ([]*models.DocumentoResponse, error) {
	var query string
	var args []interface{}

	if tipoFilter != "" && tipoFilter != "todas" && tipoFilter != "todos" {
		query = `
		SELECT id, proyecto_id, user_id, titulo, contenido, tipo, tags, fecha_creacion, fecha_actualizacion, eliminado
		FROM documentos_proyecto
		WHERE proyecto_id = $1
		  AND user_id = $2
		  AND eliminado = false
		  AND tipo = $3
		ORDER BY fecha_actualizacion DESC, id DESC
		`
		args = []interface{}{proyectoID, userID, tipoFilter}
	} else {
		query = `
		SELECT id, proyecto_id, user_id, titulo, contenido, tipo, tags, fecha_creacion, fecha_actualizacion, eliminado
		FROM documentos_proyecto
		WHERE proyecto_id = $1
		  AND user_id = $2
		  AND eliminado = false
		ORDER BY fecha_actualizacion DESC, id DESC
		`
		args = []interface{}{proyectoID, userID}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("[REPO:DocumentosProyecto.GetByProyectoID] Error en SQL SELECT: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, fmt.Errorf("error al obtener documentos del proyecto: %w", err)
	}
	defer rows.Close()

	docs := make([]*models.DocumentoResponse, 0)
	for rows.Next() {
		var doc models.DocumentoResponse
		err := rows.Scan(
			&doc.ID,
			&doc.ProyectoID,
			&doc.UserID,
			&doc.Titulo,
			&doc.Contenido,
			&doc.Tipo,
			&doc.Tags,
			&doc.FechaCreacion,
			&doc.FechaActualizacion,
			&doc.Eliminado,
		)
		if err != nil {
			log.Printf("[REPO:DocumentosProyecto.GetByProyectoID] Error al escanear fila: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
			return nil, fmt.Errorf("error al escanear fila: %w", err)
		}
		docs = append(docs, &doc)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:DocumentosProyecto.GetByProyectoID] Error al iterar filas: %v", err)
		return nil, err
	}

	return docs, nil
}

func (r *DocumentosProyectoRepository) GetByID(ctx context.Context, id int, userID int) (*models.DocumentoResponse, error) {
	var doc models.DocumentoResponse
	query := `
	SELECT id, proyecto_id, user_id, titulo, contenido, tipo, tags, fecha_creacion, fecha_actualizacion, eliminado
	FROM documentos_proyecto
	WHERE id = $1
	  AND user_id = $2
	  AND eliminado = false
	`

	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&doc.ID,
		&doc.ProyectoID,
		&doc.UserID,
		&doc.Titulo,
		&doc.Contenido,
		&doc.Tipo,
		&doc.Tags,
		&doc.FechaCreacion,
		&doc.FechaActualizacion,
		&doc.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:DocumentosProyecto.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &doc, nil
}

func (r *DocumentosProyectoRepository) Update(ctx context.Context, id int, userID int, req *models.UpdateDocumentoRequest) (*models.DocumentoResponse, error) {
	var doc models.DocumentoResponse

	query := `
	UPDATE documentos_proyecto
	SET
		titulo = COALESCE($1, titulo),
		contenido = COALESCE($2, contenido),
		tipo = COALESCE($3, tipo),
		tags = COALESCE($4, tags),
		eliminado = COALESCE($5, eliminado),
		fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $6
	  AND user_id = $7
	  AND eliminado = false
	RETURNING id, proyecto_id, user_id, titulo, contenido, tipo, tags, fecha_creacion, fecha_actualizacion, eliminado
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Titulo,
		req.Contenido,
		req.Tipo,
		req.Tags,
		req.Eliminado,
		id,
		userID,
	).Scan(
		&doc.ID,
		&doc.ProyectoID,
		&doc.UserID,
		&doc.Titulo,
		&doc.Contenido,
		&doc.Tipo,
		&doc.Tags,
		&doc.FechaCreacion,
		&doc.FechaActualizacion,
		&doc.Eliminado,
	)

	if err != nil {
		log.Printf("[REPO:DocumentosProyecto.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &doc, nil
}

func (r *DocumentosProyectoRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
	UPDATE documentos_proyecto
	SET eliminado = true, fecha_actualizacion = CURRENT_TIMESTAMP
	WHERE id = $1 AND user_id = $2 AND eliminado = false
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:DocumentosProyecto.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return fmt.Errorf("error al eliminar documento: %w", err)
	}

	if res.RowsAffected() == 0 {
		return fmt.Errorf("documento no encontrado o sin permisos")
	}

	return nil
}
