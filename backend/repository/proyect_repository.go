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
func NewProyectRepository(db *pgxpool.Pool) *ProyectRepository {
	return &ProyectRepository{db: db}
}

// crear un proyecto
func (r *ProyectRepository) Create(ctx context.Context, req *models.ProyectRequest) (*models.ProyectResponse, error) {
	var proyect models.ProyectResponse
	query := `
		INSERT INTO proyectos (
			nombre, descripcion, comentario, user_id, por_que, para_que, criterio_finalizacion, prioridad, fecha_limite, proyecto_padre_id
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, nombre, descripcion, comentario, fecha_creacion, estado, por_que, para_que, criterio_finalizacion, prioridad, fecha_limite, proyecto_padre_id
	`

	if req.Prioridad == "" {
		req.Prioridad = "Media"
	}

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.UserID,
		req.PorQue,
		req.ParaQue,
		req.CriterioFinalizacion,
		req.Prioridad,
		req.FechaLimite,
		req.ProyectoPadreID,
	).Scan(
		&proyect.ID,
		&proyect.Nombre,
		&proyect.Descripcion,
		&proyect.Comentario,
		&proyect.FechaCreacion,
		&proyect.Estado,
		&proyect.PorQue,
		&proyect.ParaQue,
		&proyect.CriterioFinalizacion,
		&proyect.Prioridad,
		&proyect.FechaLimite,
		&proyect.ProyectoPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.Create] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, err
	}
	return &proyect, nil
}

func (r *ProyectRepository) GetAll(ctx context.Context, UserID int) ([]models.ProyectResponse, error) {
	query := `
	SELECT 
		p.id,
		p.nombre,
		p.descripcion,
		p.comentario,
		p.fecha_creacion,
		p.estado,
		p.por_que,
		p.para_que,
		p.criterio_finalizacion,
		p.prioridad,
		p.fecha_limite,
		p.proyecto_padre_id,
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.eliminado = false) as subproyectos_count,
		padre.nombre as nombre_padre
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id
	WHERE p.user_id = $1
	AND p.eliminado IS false
	ORDER BY p.id DESC
	`

	rows, err := r.db.Query(
		ctx,
		query,
		UserID,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.GetAll] Error en SQL SELECT: %v | user_id=%d", err, UserID)
		return nil, err
	}
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
			&p.PorQue,
			&p.ParaQue,
			&p.CriterioFinalizacion,
			&p.Prioridad,
			&p.FechaLimite,
			&p.ProyectoPadreID,
			&p.SubproyectosCount,
			&p.NombrePadre,
		)
		if err != nil {
			log.Printf("[REPO:Proyect.GetAll] Error al escanear fila: %v | user_id=%d", err, UserID)
			return nil, err
		}

		proyects = append(proyects, p)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Proyect.GetAll] Error al iterar filas: %v | user_id=%d", err, UserID)
		return nil, err
	}
	return proyects, nil
}

func (r *ProyectRepository) GetSubproyectos(ctx context.Context, parentID int, userID int) ([]models.ProyectResponse, error) {
	query := `
	SELECT 
		p.id,
		p.nombre,
		p.descripcion,
		p.comentario,
		p.fecha_creacion,
		p.estado,
		p.por_que,
		p.para_que,
		p.criterio_finalizacion,
		p.prioridad,
		p.fecha_limite,
		p.proyecto_padre_id,
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.eliminado = false) as subproyectos_count,
		padre.nombre as nombre_padre
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id
	WHERE p.proyecto_padre_id = $1
	AND p.user_id = $2
	AND p.eliminado IS false
	ORDER BY p.id ASC
	`

	rows, err := r.db.Query(
		ctx,
		query,
		parentID,
		userID,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.GetSubproyectos] Error en SQL SELECT: %v | parent_id=%d user_id=%d", err, parentID, userID)
		return nil, err
	}
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
			&p.PorQue,
			&p.ParaQue,
			&p.CriterioFinalizacion,
			&p.Prioridad,
			&p.FechaLimite,
			&p.ProyectoPadreID,
			&p.SubproyectosCount,
			&p.NombrePadre,
		)
		if err != nil {
			log.Printf("[REPO:Proyect.GetSubproyectos] Error al escanear fila: %v | parent_id=%d user_id=%d", err, parentID, userID)
			return nil, err
		}

		proyects = append(proyects, p)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Proyect.GetSubproyectos] Error al iterar filas: %v | parent_id=%d user_id=%d", err, parentID, userID)
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

	res, err := r.db.Exec(ctx, query, id, user_id)
	if err != nil {
		log.Printf("[REPO:Proyect.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, user_id)
		return nil, err
	}
	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Proyect.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, user_id)
		return nil, fmt.Errorf("no se encontro el proyecto con id: %d", id)
	}

	return nil, nil
}

func (r *ProyectRepository) GetById(ctx context.Context, id int, userID int) (*models.ProyectResponse, error) {
	var p models.ProyectResponse
	query := `
	SELECT 
		p.id, 
		p.nombre, 
		p.descripcion, 
		p.comentario,
		p.fecha_creacion,
		p.estado,
		p.por_que,
		p.para_que,
		p.criterio_finalizacion,
		p.prioridad,
		p.fecha_limite,
		p.proyecto_padre_id,
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.eliminado = false) as subproyectos_count,
		padre.nombre as nombre_padre
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id
	WHERE p.id = $1
	AND p.user_id = $2
	AND p.eliminado IS false
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
		&p.PorQue,
		&p.ParaQue,
		&p.CriterioFinalizacion,
		&p.Prioridad,
		&p.FechaLimite,
		&p.ProyectoPadreID,
		&p.SubproyectosCount,
		&p.NombrePadre,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.GetById] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &p, nil
}

// Update con COALESCE
func (r *ProyectRepository) Update(ctx context.Context, id int, userID int, req *models.ProyectUpdateRequest) (*models.ProyectUpdateResponse, error) {
	var p models.ProyectUpdateResponse

	query := `
		UPDATE proyectos
		SET 
			nombre = COALESCE($1, nombre),
			descripcion = COALESCE($2, descripcion),
			comentario = COALESCE($3, comentario),
			estado = COALESCE($4, estado),
			por_que = COALESCE($5, por_que),
			para_que = COALESCE($6, para_que),
			criterio_finalizacion = COALESCE($7, criterio_finalizacion),
			prioridad = COALESCE($8, prioridad),
			fecha_limite = COALESCE($9, fecha_limite),
			proyecto_padre_id = COALESCE($10, proyecto_padre_id)
		WHERE id = $11
		AND user_id = $12
		AND eliminado = false
		RETURNING id, nombre, descripcion, comentario, estado, por_que, para_que, criterio_finalizacion, prioridad, fecha_limite, proyecto_padre_id
	`
	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.Estado,
		req.PorQue,
		req.ParaQue,
		req.CriterioFinalizacion,
		req.Prioridad,
		req.FechaLimite,
		req.ProyectoPadreID,
		id,
		userID,
	).Scan(
		&p.ID,
		&p.Nombre,
		&p.Descripcion,
		&p.Comentario,
		&p.Estado,
		&p.PorQue,
		&p.ParaQue,
		&p.CriterioFinalizacion,
		&p.Prioridad,
		&p.FechaLimite,
		&p.ProyectoPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &p, nil
}