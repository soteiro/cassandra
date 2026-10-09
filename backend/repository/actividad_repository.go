package repository

import (
	"context"
	"log"
	"time"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ActividadRepository lee lo que hizo el usuario: resúmenes por periodo y el registro
// de eventos de cada proyecto.
type ActividadRepository struct {
	db *pgxpool.Pool
}

func NewActividadRepository(db *pgxpool.Pool) *ActividadRepository {
	return &ActividadRepository{db: db}
}

// Resumen arma "Lo que hiciste" en [desde, hasta). Usa fecha_terminado y
// fecha_creacion, así que cubre también la historia anterior al registro de eventos.
func (r *ActividadRepository) Resumen(ctx context.Context, userID int, desde, hasta time.Time) (*models.ResumenActividad, error) {
	res := &models.ResumenActividad{
		Desde:                desde,
		Hasta:                hasta,
		TareasTerminadas:     []models.TareaTerminada{},
		ProyectosCompletados: []models.ProyectoCompleto{},
	}

	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.nombre, t.prioridad, t.proyecto_id, COALESCE(p.nombre, ''), t.tarea_padre_id, t.fecha_terminado
		FROM tareas_proyectos t
		LEFT JOIN proyectos p ON p.id = t.proyecto_id AND p.user_id = t.user_id
		WHERE t.user_id = $1 AND t.eliminado = false
		  AND t.fecha_terminado >= $2 AND t.fecha_terminado < $3
		ORDER BY t.fecha_terminado DESC, t.id DESC`, userID, desde, hasta)
	if err != nil {
		log.Printf("[REPO:Actividad.Resumen] Error en SQL de tareas: %v | user_id=%d", err, userID)
		return nil, err
	}
	for rows.Next() {
		var t models.TareaTerminada
		if err := rows.Scan(&t.ID, &t.Nombre, &t.Prioridad, &t.ProyectoID, &t.ProyectoNombre, &t.TareaPadreID, &t.FechaTerminado); err != nil {
			rows.Close()
			return nil, err
		}
		res.TareasTerminadas = append(res.TareasTerminadas, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	res.Flujo.Terminadas = len(res.TareasTerminadas)

	rows, err = r.db.Query(ctx, `
		SELECT id, nombre, fecha_terminado
		FROM proyectos
		WHERE user_id = $1 AND eliminado = false
		  AND fecha_terminado >= $2 AND fecha_terminado < $3
		ORDER BY fecha_terminado DESC, id DESC`, userID, desde, hasta)
	if err != nil {
		log.Printf("[REPO:Actividad.Resumen] Error en SQL de proyectos: %v | user_id=%d", err, userID)
		return nil, err
	}
	for rows.Next() {
		var p models.ProyectoCompleto
		if err := rows.Scan(&p.ID, &p.Nombre, &p.FechaTerminado); err != nil {
			rows.Close()
			return nil, err
		}
		res.ProyectosCompletados = append(res.ProyectosCompletados, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	err = r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM tareas_proyectos
			 WHERE user_id = $1 AND eliminado = false AND fecha_creacion >= $2 AND fecha_creacion < $3),
			(SELECT count(*) FROM interacciones
			 WHERE user_id = $1 AND eliminado = false AND fecha_creacion >= $2 AND fecha_creacion < $3),
			(SELECT count(DISTINCT persona_id) FROM interacciones
			 WHERE user_id = $1 AND eliminado = false AND fecha_creacion >= $2 AND fecha_creacion < $3),
			(SELECT count(*) FROM reflexiones
			 WHERE user_id = $1 AND eliminado = false AND fecha_creacion >= $2 AND fecha_creacion < $3),
			(SELECT count(*) FROM notas_proyecto
			 WHERE user_id = $1 AND eliminado = false AND fecha_creacion >= $2 AND fecha_creacion < $3)`,
		userID, desde, hasta).Scan(
		&res.Flujo.Creadas,
		&res.Otros.Interacciones,
		&res.Otros.PersonasContactadas,
		&res.Otros.Reflexiones,
		&res.Otros.Notas,
	)
	if err != nil {
		log.Printf("[REPO:Actividad.Resumen] Error en SQL de conteos: %v | user_id=%d", err, userID)
		return nil, err
	}
	return res, nil
}

// PorProyecto devuelve los últimos eventos de un proyecto (el proyecto y lo que cuelga
// de él), con el nombre actual de cada registro. La pertenencia del proyecto se
// verifica en el handler; aquí además se filtra por usuario.
func (r *ActividadRepository) PorProyecto(ctx context.Context, userID, proyectoID, limit int) ([]models.EventoActividad, error) {
	rows, err := r.db.Query(ctx, `
		SELECT e.id, e.entidad, e.entidad_id, e.accion, e.cambios, e.origen, e.ocurrido_en,
		       CASE e.entidad
		           WHEN 'proyecto'  THEN p.nombre
		           WHEN 'tarea'     THEN t.nombre
		           WHEN 'documento' THEN d.titulo
		           WHEN 'log'       THEN l.titulo
		           WHEN 'nota'      THEN left(n.nota_proyecto, 140)
		       END,
		       COALESCE(CASE e.entidad
		           WHEN 'proyecto'  THEN p.eliminado
		           WHEN 'tarea'     THEN t.eliminado
		           WHEN 'documento' THEN d.eliminado
		           WHEN 'log'       THEN l.eliminado
		           WHEN 'nota'      THEN n.eliminado
		       END, true)
		FROM eventos e
		LEFT JOIN proyectos p           ON e.entidad = 'proyecto'  AND p.id = e.entidad_id AND p.user_id = e.user_id
		LEFT JOIN tareas_proyectos t    ON e.entidad = 'tarea'     AND t.id = e.entidad_id AND t.user_id = e.user_id
		LEFT JOIN documentos_proyecto d ON e.entidad = 'documento' AND d.id = e.entidad_id AND d.user_id = e.user_id
		LEFT JOIN project_logs l        ON e.entidad = 'log'       AND l.id = e.entidad_id AND l.user_id = e.user_id
		LEFT JOIN notas_proyecto n      ON e.entidad = 'nota'      AND n.id = e.entidad_id AND n.user_id = e.user_id
		WHERE e.user_id = $1 AND e.proyecto_id = $2
		ORDER BY e.ocurrido_en DESC, e.id DESC
		LIMIT $3`, userID, proyectoID, limit)
	if err != nil {
		log.Printf("[REPO:Actividad.PorProyecto] Error en SQL: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		return nil, err
	}
	defer rows.Close()

	eventos := []models.EventoActividad{}
	for rows.Next() {
		var e models.EventoActividad
		if err := rows.Scan(&e.ID, &e.Entidad, &e.EntidadID, &e.Accion, &e.Cambios, &e.Origen, &e.OcurridoEn, &e.Nombre, &e.Eliminado); err != nil {
			return nil, err
		}
		eventos = append(eventos, e)
	}
	return eventos, rows.Err()
}
