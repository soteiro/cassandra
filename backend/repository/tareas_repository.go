package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"
	"time"

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
	var fechaTerminado *time.Time
	if req.Estado != nil && (*req.Estado == "Terminado" || *req.Estado == "Completado") {
		now := time.Now()
		fechaTerminado = &now
	}

	var prioridad string = "normal"
	if req.Prioridad != nil && *req.Prioridad != "" {
		prioridad = *req.Prioridad
	}

	query := `
		INSERT INTO tareas_proyectos (
			nombre, 
			descripcion, 
			comentario, 
			user_id, 
			estado,
			prioridad,
			proyecto_id,
			tarea_padre_id,
			fecha_terminado
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, nombre, descripcion, comentario, fecha_creacion, fecha_terminado, estado, prioridad, user_id, proyecto_id, tarea_padre_id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.UserID,
		req.Estado,
		prioridad,
		req.ProyectID,
		req.TareaPadreID,
		fechaTerminado,
	).Scan(
		&tarea.ID,
		&tarea.Nombre,
		&tarea.Descripcion,
		&tarea.Comentario,
		&tarea.FechaCreacion,
		&tarea.FechaTerminado,
		&tarea.Estado,
		&tarea.Prioridad,
		&tarea.UserID,
		&tarea.ProyectID,
		&tarea.TareaPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Tareas.Create] Error en SQL INSERT: %v | user_id=%d proyect_id=%d", err, req.UserID, req.ProyectID)
		return nil, err
	}
	return &tarea, nil
}

// GetAll obtiene todas las tareas de un usuario específico con filtro opcional por estado
func (r *TareasRepository) GetAll(ctx context.Context, userID int, estadoFilter string) ([]models.TareaResponse, error) {
	var query string
	var args []interface{}

	if estadoFilter != "" {
		query = `
			SELECT 
				t.id, t.nombre, t.descripcion, t.comentario, t.fecha_creacion, t.fecha_terminado, t.estado, t.prioridad, t.user_id, t.proyecto_id, t.tarea_padre_id,
				COALESCE(p.nombre, '') AS proyecto_nombre
			FROM tareas_proyectos t
			LEFT JOIN proyectos p ON p.id = t.proyecto_id
			WHERE t.user_id = $1
			  AND t.eliminado = false
			  AND t.estado ILIKE $2
			ORDER BY t.id ASC
		`
		args = []interface{}{userID, estadoFilter}
	} else {
		query = `
			SELECT 
				t.id, t.nombre, t.descripcion, t.comentario, t.fecha_creacion, t.fecha_terminado, t.estado, t.prioridad, t.user_id, t.proyecto_id, t.tarea_padre_id,
				COALESCE(p.nombre, '') AS proyecto_nombre
			FROM tareas_proyectos t
			LEFT JOIN proyectos p ON p.id = t.proyecto_id
			WHERE t.user_id = $1
			  AND t.eliminado = false
			ORDER BY t.id ASC
		`
		args = []interface{}{userID}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("[REPO:Tareas.GetAll] Error en SQL SELECT: %v | user_id=%d", err, userID)
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
			&tarea.FechaTerminado,
			&tarea.Estado,
			&tarea.Prioridad,
			&tarea.UserID,
			&tarea.ProyectID,
			&tarea.TareaPadreID,
			&tarea.ProyectoNombre,
		)
		if err != nil {
			log.Printf("[REPO:Tareas.GetAll] Error al escanear fila: %v | user_id=%d", err, userID)
			return nil, err
		}
		tareas = append(tareas, tarea)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Tareas.GetAll] Error al iterar filas: %v | user_id=%d", err, userID)
		return nil, err
	}

	return tareas, nil
}

// GetByProyectoID obtiene las tareas de un proyecto pertenecientes a un usuario agrupadas jerárquicamente con sus subtareas
func (r *TareasRepository) GetByProyectoID(ctx context.Context, proyectoID int, userID int) ([]models.TareaResponse, error) {
	query := `
		SELECT id, nombre, descripcion, comentario, fecha_creacion, fecha_terminado, estado, prioridad, user_id, proyecto_id, tarea_padre_id
		FROM tareas_proyectos
		WHERE proyecto_id = $1
		AND user_id = $2
		AND eliminado = false
		ORDER BY id DESC
	`

	rows, err := r.db.Query(ctx, query, proyectoID, userID)
	if err != nil {
		log.Printf("[REPO:Tareas.GetByProyectoID] Error en SQL SELECT: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, err
	}
	defer rows.Close()

	var todas []models.TareaResponse

	for rows.Next() {
		var tarea models.TareaResponse
		err := rows.Scan(
			&tarea.ID,
			&tarea.Nombre,
			&tarea.Descripcion,
			&tarea.Comentario,
			&tarea.FechaCreacion,
			&tarea.FechaTerminado,
			&tarea.Estado,
			&tarea.Prioridad,
			&tarea.UserID,
			&tarea.ProyectID,
			&tarea.TareaPadreID,
		)
		if err != nil {
			log.Printf("[REPO:Tareas.GetByProyectoID] Error al escanear fila: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
			return nil, err
		}
		todas = append(todas, tarea)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:Tareas.GetByProyectoID] Error al iterar filas: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		return nil, err
	}

	// Construir jerarquía: separar tareas principales y asignar subtareas
	tareaMap := make(map[int]*models.TareaResponse)
	for i := range todas {
		todas[i].Subtareas = []models.TareaResponse{}
		tareaMap[todas[i].ID] = &todas[i]
	}

	// 1. Asignar cada subtarea a su respectivo padre en tareaMap
	for _, t := range todas {
		if t.TareaPadreID != nil {
			if padre, ok := tareaMap[*t.TareaPadreID]; ok {
				padre.Subtareas = append(padre.Subtareas, t)
			}
		}
	}

	// 2. Extraer tareas principales (con sus subtareas ya asignadas)
	var principales []models.TareaResponse
	for _, t := range todas {
		if t.TareaPadreID == nil {
			principales = append(principales, *tareaMap[t.ID])
		} else if _, ok := tareaMap[*t.TareaPadreID]; !ok {
			// Si es subtarea huérfana, incluirla como principal
			principales = append(principales, *tareaMap[t.ID])
		}
	}

	return principales, nil
}

// GetByID obtiene una tarea específica validando que le pertenezca al usuario con sus subtareas
func (r *TareasRepository) GetByID(ctx context.Context, id int, userID int) (*models.TareaResponse, error) {
	var tarea models.TareaResponse
	query := `
		SELECT id, nombre, descripcion, comentario, fecha_creacion, fecha_terminado, estado, prioridad, user_id, proyecto_id, tarea_padre_id
		FROM tareas_proyectos
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
		&tarea.FechaTerminado,
		&tarea.Estado,
		&tarea.Prioridad,
		&tarea.UserID,
		&tarea.ProyectID,
		&tarea.TareaPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Tareas.GetByID] Error en SQL SELECT: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	// Buscar subtareas directas
	subQuery := `
		SELECT id, nombre, descripcion, comentario, fecha_creacion, fecha_terminado, estado, prioridad, user_id, proyecto_id, tarea_padre_id
		FROM tareas_proyectos
		WHERE tarea_padre_id = $1
		AND user_id = $2
		AND eliminado = false
		ORDER BY id ASC
	`
	rows, err := r.db.Query(ctx, subQuery, id, userID)
	if err == nil {
		defer rows.Close()
		var subtareas []models.TareaResponse
		for rows.Next() {
			var sub models.TareaResponse
			if err := rows.Scan(
				&sub.ID,
				&sub.Nombre,
				&sub.Descripcion,
				&sub.Comentario,
				&sub.FechaCreacion,
				&sub.FechaTerminado,
				&sub.Estado,
				&sub.Prioridad,
				&sub.UserID,
				&sub.ProyectID,
				&sub.TareaPadreID,
			); err == nil {
				subtareas = append(subtareas, sub)
			}
		}
		tarea.Subtareas = subtareas
	}

	return &tarea, nil
}

// Update actualiza una tarea usando COALESCE y asegurando la pertenencia del usuario
func (r *TareasRepository) Update(ctx context.Context, id int, userID int, req *models.TareaUpdateRequest) (*models.TareaUpdateResponse, error) {
	var tarea models.TareaUpdateResponse
	var modoFechaTerminado int // 0 = no change, 1 = completado (NOW si null), 2 = reabierto (NULL)
	if req.Estado != nil {
		if *req.Estado == "Terminado" || *req.Estado == "Completado" {
			modoFechaTerminado = 1
		} else {
			modoFechaTerminado = 2
		}
	}

	query := `
		UPDATE tareas_proyectos
		SET nombre = COALESCE($1, nombre),
			descripcion = COALESCE($2, descripcion),
			comentario = COALESCE($3, comentario),
			estado = COALESCE($4, estado),
			prioridad = COALESCE($5, prioridad),
			eliminado = COALESCE($6, eliminado),
			tarea_padre_id = COALESCE($7, tarea_padre_id),
			fecha_terminado = CASE 
				WHEN $8 = 1 THEN COALESCE(fecha_terminado, NOW())
				WHEN $8 = 2 THEN NULL
				ELSE fecha_terminado
			END
		WHERE id = $9 AND user_id = $10
		RETURNING id, nombre, descripcion, comentario, estado, prioridad, fecha_terminado, eliminado, tarea_padre_id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Descripcion,
		req.Comentario,
		req.Estado,
		req.Prioridad,
		req.Eliminado,
		req.TareaPadreID,
		modoFechaTerminado,
		id,
		userID,
	).Scan(
		&tarea.ID,
		&tarea.Nombre,
		&tarea.Descripcion,
		&tarea.Comentario,
		&tarea.Estado,
		&tarea.Prioridad,
		&tarea.FechaTerminado,
		&tarea.Eliminado,
		&tarea.TareaPadreID,
	)

	if err != nil {
		log.Printf("[REPO:Tareas.Update] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}

	return &tarea, nil
}

// Delete realiza el borrado lógico de una tarea asegurando la pertenencia del usuario
func (r *TareasRepository) Delete(ctx context.Context, id int, userID int) error {
	query := `
		UPDATE tareas_proyectos
		SET eliminado = true
		WHERE id = $1 AND user_id = $2
	`

	res, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		log.Printf("[REPO:Tareas.Delete] Error en SQL UPDATE: %v | id=%d user_id=%d", err, id, userID)
		return err
	}

	if res.RowsAffected() == 0 {
		log.Printf("[REPO:Tareas.Delete] Registro no encontrado o sin permisos | id=%d user_id=%d", id, userID)
		return fmt.Errorf("no se encontró la tarea o no tienes permisos para eliminarla")
	}

	return nil
}