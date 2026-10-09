package repository

import (
	"context"
	"log"

	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RevisionRepository guarda las revisiones semanales y lo que necesitan: las tareas
// estancadas y las preferencias del usuario.
type RevisionRepository struct {
	db *pgxpool.Pool
}

func NewRevisionRepository(db *pgxpool.Pool) *RevisionRepository {
	return &RevisionRepository{db: db}
}

// Estancadas devuelve las tareas abiertas que no cambian hace al menos `dias` días, de
// proyectos activos (no Idea, Pausado, Completado ni Cancelado: esos están quietos a
// propósito). Las más antiguas primero.
func (r *RevisionRepository) Estancadas(ctx context.Context, userID, dias int) ([]models.TareaEstancada, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.nombre, COALESCE(t.estado, ''), t.prioridad, t.proyecto_id, p.nombre, t.tarea_padre_id,
		       t.fecha_actualizacion, floor(extract(epoch FROM now() - t.fecha_actualizacion) / 86400)::int
		FROM tareas_proyectos t
		JOIN proyectos p ON p.id = t.proyecto_id AND p.user_id = t.user_id
		WHERE t.user_id = $1 AND t.eliminado = false AND p.eliminado = false
		  AND t.estado NOT IN ('Terminado', 'Completado')
		  AND p.estado NOT IN ('Idea', 'Pausado', 'Completado', 'Cancelado')
		  AND t.fecha_actualizacion < now() - make_interval(days => $2)
		ORDER BY t.fecha_actualizacion ASC, t.id ASC`, userID, dias)
	if err != nil {
		log.Printf("[REPO:Revision.Estancadas] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	defer rows.Close()
	tareas := []models.TareaEstancada{}
	for rows.Next() {
		var t models.TareaEstancada
		if err := rows.Scan(&t.ID, &t.Nombre, &t.Estado, &t.Prioridad, &t.ProyectoID, &t.ProyectoNombre,
			&t.TareaPadreID, &t.FechaActualizacion, &t.DiasSinCambios); err != nil {
			return nil, err
		}
		tareas = append(tareas, t)
	}
	return tareas, rows.Err()
}

func (r *RevisionRepository) Create(ctx context.Context, userID int, req *models.RevisionRequest) (*models.Revision, error) {
	var rev models.Revision
	err := r.db.QueryRow(ctx, `
		INSERT INTO revisiones (user_id, nota, resumen) VALUES ($1, $2, $3)
		RETURNING id, nota, resumen, fecha_creacion`, userID, req.Nota, req.Resumen).
		Scan(&rev.ID, &rev.Nota, &rev.Resumen, &rev.FechaCreacion)
	if err != nil {
		log.Printf("[REPO:Revision.Create] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	return &rev, nil
}

// List devuelve las últimas revisiones, la más reciente primero.
func (r *RevisionRepository) List(ctx context.Context, userID, limit int) ([]models.Revision, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, nota, resumen, fecha_creacion FROM revisiones
		WHERE user_id = $1 AND eliminado = false
		ORDER BY fecha_creacion DESC, id DESC LIMIT $2`, userID, limit)
	if err != nil {
		log.Printf("[REPO:Revision.List] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	defer rows.Close()
	revs := []models.Revision{}
	for rows.Next() {
		var rev models.Revision
		if err := rows.Scan(&rev.ID, &rev.Nota, &rev.Resumen, &rev.FechaCreacion); err != nil {
			return nil, err
		}
		revs = append(revs, rev)
	}
	return revs, rows.Err()
}

func (r *RevisionRepository) Preferencias(ctx context.Context, userID int) (*models.Preferencias, error) {
	var p models.Preferencias
	err := r.db.QueryRow(ctx, `SELECT dia_revision, limite_en_curso FROM users WHERE id = $1 AND eliminado = false`, userID).
		Scan(&p.DiaRevision, &p.LimiteEnCurso)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *RevisionRepository) UpdatePreferencias(ctx context.Context, userID int, req *models.PreferenciasUpdate) (*models.Preferencias, error) {
	var p models.Preferencias
	err := r.db.QueryRow(ctx, `
		UPDATE users SET dia_revision = COALESCE($1, dia_revision), limite_en_curso = COALESCE($2, limite_en_curso)
		WHERE id = $3 AND eliminado = false
		RETURNING dia_revision, limite_en_curso`, req.DiaRevision, req.LimiteEnCurso, userID).
		Scan(&p.DiaRevision, &p.LimiteEnCurso)
	if err != nil {
		log.Printf("[REPO:Revision.UpdatePreferencias] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	return &p, nil
}
