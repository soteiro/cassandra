package repository

import (
	"context"
	"strings"

	"cassandra/models"

	"github.com/jackc/pgx/v5"
)

// Lectura de notas de proyecto para integraciones (MCP). Las notas las escribe el usuario
// desde la aplicación; por aquí solo se buscan y se leen.

// TaskNotesLimit es cuántas notas recientes acompañan al detalle de una tarea.
const TaskNotesLimit = 5

const memoryNoteColumns = `SELECT n.id,n.proyecto_id,n.tarea_id,t.nombre,
	left(n.nota_proyecto,4000),length(n.nota_proyecto)>4000,COALESCE(n.fecha_creacion,'epoch'::timestamptz)
	FROM notas_proyecto n
	JOIN proyectos p ON p.id=n.proyecto_id AND p.user_id=n.user_id AND p.eliminado=false
	LEFT JOIN tareas_proyectos t ON t.id=n.tarea_id AND t.user_id=n.user_id
	WHERE n.user_id=$1 AND n.proyecto_id=$2 AND n.eliminado IS NOT TRUE`

type noteQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func listMemoryNotes(ctx context.Context, db noteQuerier, userID, projectID int, q models.MemoryNoteQuery) (*models.MemoryNoteList, error) {
	// El texto es literal: '%' y '_' no amplían la consulta.
	pattern := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(q.Consulta) + "%"
	rows, err := db.Query(ctx, memoryNoteColumns+`
		AND n.nota_proyecto ILIKE $3
		AND ($4::integer IS NULL OR ($4=0 AND n.tarea_id IS NULL) OR n.tarea_id=$4)
		ORDER BY n.fecha_creacion DESC NULLS LAST, n.id DESC LIMIT $5 OFFSET $6`,
		userID, projectID, pattern, q.TareaID, q.Limit+1, q.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := &models.MemoryNoteList{Notas: []models.MemoryNote{}}
	for rows.Next() {
		var n models.MemoryNote
		if err := rows.Scan(&n.ID, &n.ProyectoID, &n.TareaID, &n.TareaNombre, &n.Nota, &n.TextoTruncado, &n.FechaCreacion); err != nil {
			return nil, err
		}
		out.Notas = append(out.Notas, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out.HayMas = len(out.Notas) > q.Limit
	if out.HayMas {
		out.Notas = out.Notas[:q.Limit]
	}
	return out, nil
}

// SearchNotes busca notas del usuario en un proyecto propio.
func (r *ProjectMemoryRepository) SearchNotes(ctx context.Context, userID, projectID int, q models.MemoryNoteQuery) (*models.MemoryNoteList, error) {
	if err := q.Validate(); err != nil {
		return nil, err
	}
	var owned bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false)`, projectID, userID).Scan(&owned); err != nil {
		return nil, err
	}
	if !owned {
		return nil, ErrNoEncontrado
	}
	return listMemoryNotes(ctx, r.db, userID, projectID, q)
}

// TaskNotes devuelve las notas más recientes de una tarea ya autorizada y cuántas tiene en total.
func (r *IntegrationTasksRepository) TaskNotes(ctx context.Context, userID, projectID, taskID int) ([]models.MemoryNote, int, error) {
	list, err := listMemoryNotes(ctx, r.db, userID, projectID, models.MemoryNoteQuery{TareaID: &taskID, Limit: TaskNotesLimit})
	if err != nil {
		return nil, 0, err
	}
	total := len(list.Notas)
	if list.HayMas {
		if err := r.db.QueryRow(ctx, `SELECT count(*) FROM notas_proyecto
			WHERE user_id=$1 AND proyecto_id=$2 AND tarea_id=$3 AND eliminado IS NOT TRUE`, userID, projectID, taskID).Scan(&total); err != nil {
			return nil, 0, err
		}
	}
	return list.Notas, total, nil
}
