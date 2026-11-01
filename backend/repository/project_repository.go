package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProjectRepository struct {
	db *pgxpool.Pool
}

// constructor del repo proyectos
func NewProjectRepository(db *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{db: db}
}

// crear un proyecto
func (r *ProjectRepository) Create(ctx context.Context, req *models.ProjectRequest) (*models.ProjectResponse, error) {
	var project models.ProjectResponse
	query := `
		INSERT INTO proyectos (
			nombre, descripcion, comentario, user_id, por_que, para_que, criterio_finalizacion, prioridad, fecha_limite, proyecto_padre_id, premortem
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULLIF($11, ''))
		RETURNING id, nombre, descripcion, comentario, fecha_creacion, fecha_terminado, fecha_actualizacion, estado, por_que, para_que, criterio_finalizacion, COALESCE(premortem, ''), prioridad, fecha_limite, proyecto_padre_id
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
		req.Premortem,
	).Scan(
		&project.ID,
		&project.Nombre,
		&project.Descripcion,
		&project.Comentario,
		&project.FechaCreacion,
		&project.FechaTerminado,
		&project.FechaActualizacion,
		&project.Estado,
		&project.PorQue,
		&project.ParaQue,
		&project.CriterioFinalizacion,
		&project.Premortem,
		&project.Prioridad,
		&project.FechaLimite,
		&project.ProyectoPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.Create] Error en SQL INSERT: %v | user_id=%d", err, req.UserID)
		return nil, err
	}
	return &project, nil
}

func (r *ProjectRepository) GetAll(ctx context.Context, UserID int) ([]models.ProjectResponse, error) {
	query := `
	SELECT 
		p.id,
		p.nombre,
		p.descripcion,
		p.comentario,
		p.fecha_creacion,
		p.fecha_terminado,
		p.fecha_actualizacion,
		p.estado,
		p.por_que,
		p.para_que,
		p.criterio_finalizacion,
		COALESCE(p.premortem, ''),
		p.prioridad,
		p.fecha_limite,
		p.proyecto_padre_id,
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.user_id = p.user_id AND sub.eliminado = false) as subproyectos_count,
		padre.nombre as nombre_padre,
		(SELECT max(e.ocurrido_en) FROM eventos e WHERE e.user_id = p.user_id AND e.proyecto_id = p.id) as ultima_actividad
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id AND padre.user_id = p.user_id
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

	var projects []models.ProjectResponse
	for rows.Next() {
		var p models.ProjectResponse
		err := rows.Scan(
			&p.ID,
			&p.Nombre,
			&p.Descripcion,
			&p.Comentario,
			&p.FechaCreacion,
			&p.FechaTerminado,
			&p.FechaActualizacion,
			&p.Estado,
			&p.PorQue,
			&p.ParaQue,
			&p.CriterioFinalizacion,
			&p.Premortem,
			&p.Prioridad,
			&p.FechaLimite,
			&p.ProyectoPadreID,
			&p.SubproyectosCount,
			&p.NombrePadre,
			&p.UltimaActividad,
		)
		if err != nil {
			log.Printf("[REPO:Proyect.GetAll] Error al escanear fila: %v | user_id=%d", err, UserID)
			return nil, err
		}

		projects = append(projects, p)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Proyect.GetAll] Error al iterar filas: %v | user_id=%d", err, UserID)
		return nil, err
	}
	return projects, nil
}

func (r *ProjectRepository) GetSubproyectos(ctx context.Context, parentID int, userID int) ([]models.ProjectResponse, error) {
	query := `
	SELECT 
		p.id,
		p.nombre,
		p.descripcion,
		p.comentario,
		p.fecha_creacion,
		p.fecha_terminado,
		p.fecha_actualizacion,
		p.estado,
		p.por_que,
		p.para_que,
		p.criterio_finalizacion,
		COALESCE(p.premortem, ''),
		p.prioridad,
		p.fecha_limite,
		p.proyecto_padre_id,
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.user_id = p.user_id AND sub.eliminado = false) as subproyectos_count,
		padre.nombre as nombre_padre,
		(SELECT max(e.ocurrido_en) FROM eventos e WHERE e.user_id = p.user_id AND e.proyecto_id = p.id) as ultima_actividad
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id AND padre.user_id = p.user_id
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

	var projects []models.ProjectResponse
	for rows.Next() {
		var p models.ProjectResponse
		err := rows.Scan(
			&p.ID,
			&p.Nombre,
			&p.Descripcion,
			&p.Comentario,
			&p.FechaCreacion,
			&p.FechaTerminado,
			&p.FechaActualizacion,
			&p.Estado,
			&p.PorQue,
			&p.ParaQue,
			&p.CriterioFinalizacion,
			&p.Premortem,
			&p.Prioridad,
			&p.FechaLimite,
			&p.ProyectoPadreID,
			&p.SubproyectosCount,
			&p.NombrePadre,
			&p.UltimaActividad,
		)
		if err != nil {
			log.Printf("[REPO:Proyect.GetSubproyectos] Error al escanear fila: %v | parent_id=%d user_id=%d", err, parentID, userID)
			return nil, err
		}

		projects = append(projects, p)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Proyect.GetSubproyectos] Error al iterar filas: %v | parent_id=%d user_id=%d", err, parentID, userID)
		return nil, err
	}
	return projects, nil
}

func (r *ProjectRepository) Delete(ctx context.Context, id int, user_id int) (*models.ProjectResponse, error) {
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
		return nil, fmt.Errorf("%w: no se encontro el proyecto con id: %d", ErrNoEncontrado, id)
	}

	return nil, nil
}

func (r *ProjectRepository) GetById(ctx context.Context, id int, userID int) (*models.ProjectResponse, error) {
	var p models.ProjectResponse
	query := `
	SELECT 
		p.id, 
		p.nombre, 
		p.descripcion, 
		p.comentario, 
		p.fecha_creacion, 
		p.fecha_terminado,
		p.fecha_actualizacion,
		p.estado, 
		p.por_que, 
		p.para_que, 
		p.criterio_finalizacion,
		COALESCE(p.premortem, ''),
		p.prioridad, 
		p.fecha_limite, 
		p.proyecto_padre_id, 
		(SELECT COUNT(*) FROM proyectos sub WHERE sub.proyecto_padre_id = p.id AND sub.user_id = p.user_id AND sub.eliminado = false) as subproyectos_count, 
		padre.nombre as nombre_padre,
		(SELECT max(e.ocurrido_en) FROM eventos e WHERE e.user_id = p.user_id AND e.proyecto_id = p.id) as ultima_actividad
	FROM proyectos p
	LEFT JOIN proyectos padre ON p.proyecto_padre_id = padre.id AND padre.user_id = p.user_id
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
		&p.FechaTerminado,
		&p.FechaActualizacion,
		&p.Estado,
		&p.PorQue,
		&p.ParaQue,
		&p.CriterioFinalizacion,
		&p.Premortem,
		&p.Prioridad,
		&p.FechaLimite,
		&p.ProyectoPadreID,
		&p.SubproyectosCount,
		&p.NombrePadre,
		&p.UltimaActividad,
	)

	if err != nil {
		log.Printf("[REPO:Proyect.GetById] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &p, nil
}

// Update con COALESCE
func (r *ProjectRepository) Update(ctx context.Context, id int, userID int, req *models.ProjectUpdateRequest) (*models.ProjectUpdateResponse, error) {
	var p models.ProjectUpdateResponse
	var modoFechaTerminado int // 0 = no change, 1 = completado (NOW si null), 2 = reabierto (NULL)
	if req.Estado != nil {
		if *req.Estado == "Completado" || *req.Estado == "Terminado" {
			modoFechaTerminado = 1
		} else {
			modoFechaTerminado = 2
		}
	}

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
			proyecto_padre_id = COALESCE($10, proyecto_padre_id),
			premortem = COALESCE($14, premortem),
			fecha_terminado = CASE
				WHEN $11 = 1 THEN COALESCE(fecha_terminado, NOW())
				WHEN $11 = 2 THEN NULL
				ELSE fecha_terminado
			END
		WHERE id = $12
		AND user_id = $13
		AND eliminado = false
		RETURNING id, nombre, descripcion, comentario, estado, fecha_terminado, por_que, para_que, criterio_finalizacion, COALESCE(premortem, ''), prioridad, fecha_limite, proyecto_padre_id
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
		modoFechaTerminado,
		id,
		userID,
		req.Premortem,
	).Scan(
		&p.ID,
		&p.Nombre,
		&p.Descripcion,
		&p.Comentario,
		&p.Estado,
		&p.FechaTerminado,
		&p.PorQue,
		&p.ParaQue,
		&p.CriterioFinalizacion,
		&p.Premortem,
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
