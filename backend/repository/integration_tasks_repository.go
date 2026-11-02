package repository

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"cassandra/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IntegrationTasksRepository struct{ db *pgxpool.Pool }

func NewIntegrationTasksRepository(db *pgxpool.Pool) *IntegrationTasksRepository {
	return &IntegrationTasksRepository{db: db}
}

// Create serializa creaciones por proyecto y confirma tarea, evento y operación
// juntos. La respuesta de un reintento es la instantánea original, incluso si la
// tarea se editó o eliminó después: nunca se vuelve a crear.
func (r *IntegrationTasksRepository) Create(ctx context.Context, userID, projectID int, keyID int64, req models.CreateIntegrationTaskRequest) (*models.IntegrationTask, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	hash := fmt.Sprintf("%x", sha256.Sum256(payload))
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var id int
	if err := tx.QueryRow(ctx, `SELECT id FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false FOR UPDATE`, projectID, userID).Scan(&id); err != nil {
		return nil, err
	}
	var previousHash string
	var previousResult []byte
	err = tx.QueryRow(ctx, `SELECT request_hash,resultado FROM tareas_operaciones
		WHERE proyecto_id=$1 AND user_id=$2 AND operacion_id=$3`, projectID, userID, req.OperacionID).Scan(&previousHash, &previousResult)
	if err == nil {
		if previousHash != hash {
			return nil, models.ErrTaskOperationConflict
		}
		var out models.IntegrationTask
		if err := json.Unmarshal(previousResult, &out); err != nil {
			return nil, err
		}
		return &out, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if req.TareaPadreID != nil {
		// El bloqueo impide que otro cliente elimine o cambie el padre durante el alta.
		if err := tx.QueryRow(ctx, `SELECT id FROM tareas_proyectos
			WHERE id=$1 AND proyecto_id=$2 AND user_id=$3 AND eliminado=false FOR SHARE`, *req.TareaPadreID, projectID, userID).Scan(&id); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('cassandra.origen','mcp',true)`); err != nil {
		return nil, err
	}
	task, err := insertTarea(ctx, tx, &models.TareaRequest{
		Nombre: req.Nombre, Descripcion: req.Descripcion, Comentario: req.Comentario,
		Prioridad: &req.Prioridad, ProjectID: projectID, UserID: userID, TareaPadreID: req.TareaPadreID,
	})
	if err != nil {
		return nil, err
	}
	out := &models.IntegrationTask{
		ID: task.ID, ProyectoID: task.ProjectID, Nombre: task.Nombre, Descripcion: task.Descripcion,
		Comentario: task.Comentario, Estado: *task.Estado, Prioridad: task.Prioridad, TareaPadreID: task.TareaPadreID,
		FechaCreacion: task.FechaCreacion, FechaActualizacion: task.FechaActualizacion, FechaTerminado: task.FechaTerminado,
	}
	result, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	var key any
	if keyID != 0 {
		key = keyID
	}
	if _, err := tx.Exec(ctx, `INSERT INTO tareas_operaciones(proyecto_id,user_id,operacion_id,request_hash,resultado,api_key_id)
		VALUES($1,$2,$3,$4,$5,$6)`, projectID, userID, req.OperacionID, hash, result, key); err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}

// No se cargan subtareas implícitas: cada fila pertenece al proyecto solicitado.
// Los textos heredados se acotan en SQL, antes de enviarlos al conector.
const integrationTaskColumns = `SELECT t.id,t.proyecto_id,t.nombre,
	left(COALESCE(t.descripcion,''),4000),left(COALESCE(t.comentario,''),4000),
	COALESCE(t.estado,'Abierto'),t.prioridad,t.tarea_padre_id,t.fecha_creacion,t.fecha_actualizacion,t.fecha_terminado,
	(COALESCE(length(t.descripcion),0)>4000 OR COALESCE(length(t.comentario),0)>4000)
	FROM tareas_proyectos t JOIN proyectos p ON p.id=t.proyecto_id AND p.user_id=t.user_id
	WHERE t.user_id=$1 AND t.proyecto_id=$2 AND t.eliminado=false AND p.eliminado=false`

func scanIntegrationTask(row interface{ Scan(...any) error }) (models.IntegrationTask, error) {
	var t models.IntegrationTask
	err := row.Scan(&t.ID, &t.ProyectoID, &t.Nombre, &t.Descripcion, &t.Comentario, &t.Estado, &t.Prioridad,
		&t.TareaPadreID, &t.FechaCreacion, &t.FechaActualizacion, &t.FechaTerminado, &t.TextoTruncado)
	return t, err
}

func (r *IntegrationTasksRepository) Get(ctx context.Context, userID, projectID, taskID int) (*models.IntegrationTask, error) {
	task, err := scanIntegrationTask(r.db.QueryRow(ctx, integrationTaskColumns+` AND t.id=$3`, userID, projectID, taskID))
	return &task, err
}

func (r *IntegrationTasksRepository) List(ctx context.Context, userID, projectID int, query models.IntegrationTaskQuery) (*models.IntegrationTaskList, error) {
	if err := query.Validate(); err != nil {
		return nil, err
	}
	var owned bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false)`, projectID, userID).Scan(&owned); err != nil {
		return nil, err
	}
	if !owned {
		return nil, ErrNoEncontrado
	}
	pattern := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query.Consulta) + "%"
	rows, err := r.db.Query(ctx, integrationTaskColumns+`
		AND ($3='' OR COALESCE(t.estado,'Abierto')=$3) AND ($4='' OR t.prioridad=$4)
		AND (t.nombre ILIKE $5 OR t.descripcion ILIKE $5 OR t.comentario ILIKE $5)
		AND ($6::integer IS NULL OR ($6=0 AND t.tarea_padre_id IS NULL) OR t.tarea_padre_id=$6)
		ORDER BY t.id DESC LIMIT $7 OFFSET $8`, userID, projectID, query.Estado, query.Prioridad, pattern, query.TareaPadreID, query.Limit+1, query.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := &models.IntegrationTaskList{Tareas: []models.IntegrationTask{}}
	for rows.Next() {
		task, err := scanIntegrationTask(rows)
		if err != nil {
			return nil, err
		}
		out.Tareas = append(out.Tareas, task)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out.HayMas = len(out.Tareas) > query.Limit
	if out.HayMas {
		out.Tareas = out.Tareas[:query.Limit]
	}
	return out, nil
}
