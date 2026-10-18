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

type ProjectMemoryRepository struct{ db *pgxpool.Pool }

func NewProjectMemoryRepository(db *pgxpool.Pool) *ProjectMemoryRepository {
	return &ProjectMemoryRepository{db: db}
}

func (r *ProjectMemoryRepository) Context(ctx context.Context, userID, projectID int) (*models.MemoryContext, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	out := &models.MemoryContext{Fichas: []models.MemoryEntry{}}
	// Limitar también campos existentes, que originalmente no tenían límite de lectura.
	err = tx.QueryRow(ctx, `SELECT id,nombre,left(COALESCE(por_que,''),1200),left(COALESCE(para_que,''),1200),left(COALESCE(criterio_finalizacion,''),1200),
		(COALESCE(length(por_que),0)>1200 OR COALESCE(length(para_que),0)>1200 OR COALESCE(length(criterio_finalizacion),0)>1200)
		FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false`, projectID, userID).Scan(&out.Proyecto.ID, &out.Proyecto.Nombre, &out.Proyecto.PorQue, &out.Proyecto.ParaQue, &out.Proyecto.CriterioFinalizacion, &out.Proyecto.TextoTruncado)
	if err != nil {
		return nil, err
	}
	var content []byte
	err = tx.QueryRow(ctx, `SELECT revision,contenido,documento_id,fecha_actualizacion FROM memoria_proyectos WHERE proyecto_id=$1 AND user_id=$2`, projectID, userID).Scan(&out.Revision, &content, &out.DocumentoID, &out.FechaActualizacion)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if len(content) > 0 {
		if err := json.Unmarshal(content, &out.Memoria); err != nil {
			return nil, err
		}
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM memoria_fichas WHERE proyecto_id=$1 AND user_id=$2 AND estado NOT IN ('sustituida','descartada')`, projectID, userID).Scan(&out.FichasVigentesTotal); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, entryColumns+` WHERE proyecto_id=$1 AND user_id=$2 AND estado NOT IN ('sustituida','descartada') ORDER BY id DESC LIMIT 5`, projectID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out.Fichas, err = readMemoryEntries(rows)
	if err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}

const entryColumns = `SELECT id,titulo,contenido,tipo,estado,fuentes,sustituye_id,documento_id,fecha_creacion FROM memoria_fichas`

func readMemoryEntries(rows pgx.Rows) ([]models.MemoryEntry, error) {
	out := []models.MemoryEntry{}
	for rows.Next() {
		var e models.MemoryEntry
		var sources []byte
		if err := rows.Scan(&e.ID, &e.Titulo, &e.Contenido, &e.Tipo, &e.Estado, &sources, &e.SustituyeID, &e.DocumentoID, &e.FechaCreacion); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(sources, &e.Fuentes); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *ProjectMemoryRepository) Search(ctx context.Context, userID, projectID int, query string, history bool, limit, offset int) (*models.MemorySearchResult, error) {
	if len(query) > 300 || limit < 1 || limit > 20 || offset < 0 || offset > 10000 {
		return nil, models.ErrMemoryInvalid
	}
	var owned bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false)`, projectID, userID).Scan(&owned); err != nil {
		return nil, err
	}
	if !owned {
		return nil, ErrNoEncontrado
	}
	// El texto es literal: '%' y '_' no amplían accidentalmente la consulta.
	pattern := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(strings.TrimSpace(query)) + "%"
	rows, err := r.db.Query(ctx, entryColumns+` WHERE proyecto_id=$1 AND user_id=$2
		AND ($3 OR estado NOT IN ('sustituida','descartada'))
		AND (titulo ILIKE $4 OR contenido ILIKE $4) ORDER BY id DESC LIMIT $5 OFFSET $6`, projectID, userID, history, pattern, limit+1, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries, err := readMemoryEntries(rows)
	if err != nil {
		return nil, err
	}
	out := &models.MemorySearchResult{Fichas: entries, HayMas: len(entries) > limit}
	if out.HayMas {
		out.Fichas = out.Fichas[:limit]
	}
	return out, nil
}

// Write es la operación compartida para REST y MCP: bloqueo por proyecto,
// idempotencia, comparación de revisión y documentos en una sola transacción.
func (r *ProjectMemoryRepository) Write(ctx context.Context, userID, projectID int, keyID int64, req models.MemoryWriteRequest) (*models.MemoryWriteResult, error) {
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
	var ownedID int
	err = tx.QueryRow(ctx, `SELECT id FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false FOR UPDATE`, projectID, userID).Scan(&ownedID)
	if err != nil {
		return nil, err
	}
	var priorHash string
	var priorResult []byte
	err = tx.QueryRow(ctx, `SELECT request_hash,resultado FROM memoria_operaciones WHERE proyecto_id=$1 AND user_id=$2 AND operacion_id=$3`, projectID, userID, req.OperacionID).Scan(&priorHash, &priorResult)
	if err == nil {
		if priorHash != hash {
			return nil, models.ErrMemoryConflict
		}
		var result models.MemoryWriteResult
		if err := json.Unmarshal(priorResult, &result); err != nil {
			return nil, err
		}
		return &result, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO memoria_proyectos(proyecto_id,user_id) VALUES($1,$2) ON CONFLICT(proyecto_id) DO NOTHING`, projectID, userID); err != nil {
		return nil, err
	}
	result := &models.MemoryWriteResult{FichaIDs: []int64{}}
	if err := tx.QueryRow(ctx, `SELECT revision,documento_id FROM memoria_proyectos WHERE proyecto_id=$1 AND user_id=$2`, projectID, userID).Scan(&result.Revision, &result.DocumentoID); err != nil {
		return nil, err
	}
	if result.Revision != *req.RevisionEsperada {
		return nil, models.ErrMemoryConflict
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('cassandra.origen','memory',true)`); err != nil {
		return nil, err
	}
	var content any
	if req.Memoria != nil {
		data, err := json.Marshal(req.Memoria)
		if err != nil {
			return nil, err
		}
		content = data
		docID, err := writeMemoryDocument(ctx, tx, userID, projectID, result.DocumentoID, "Memoria actual", req.Memoria.Markdown(), "general")
		if err != nil {
			return nil, err
		}
		result.DocumentoID = &docID
	}
	for _, entry := range req.Fichas {
		if entry.SustituyeID != nil {
			var oldDocID *int
			err := tx.QueryRow(ctx, `UPDATE memoria_fichas SET estado='sustituida'
				WHERE id=$1 AND proyecto_id=$2 AND user_id=$3 AND estado<>'sustituida'
				RETURNING documento_id`, *entry.SustituyeID, projectID, userID).Scan(&oldDocID)
			if err != nil {
				return nil, err
			}
			if oldDocID != nil {
				// Preservar fuentes y contenido del documento anterior, solo indicar el estado.
				if _, err := tx.Exec(ctx, `UPDATE documentos_proyecto SET contenido=regexp_replace(contenido,'^Estado: \*\*[^\n]+','Estado: **sustituida**'),fecha_actualizacion=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 AND proyecto_id=$3`, *oldDocID, userID, projectID); err != nil {
					return nil, err
				}
			}
		}
		docType := "decision"
		if entry.Tipo == "exploracion" {
			docType = "investigacion"
		}
		docID, err := writeMemoryDocument(ctx, tx, userID, projectID, nil, entry.Titulo, entry.Markdown(), docType)
		if err != nil {
			return nil, err
		}
		sources, err := json.Marshal(entry.Fuentes)
		if err != nil {
			return nil, err
		}
		var entryID int64
		err = tx.QueryRow(ctx, `INSERT INTO memoria_fichas(proyecto_id,user_id,titulo,contenido,tipo,estado,fuentes,sustituye_id,documento_id)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, projectID, userID, entry.Titulo, entry.Contenido, entry.Tipo, entry.Estado, sources, entry.SustituyeID, docID).Scan(&entryID)
		if err != nil {
			return nil, err
		}
		result.FichaIDs = append(result.FichaIDs, entryID)
	}
	result.Revision++
	if _, err := tx.Exec(ctx, `UPDATE memoria_proyectos SET revision=$1,contenido=COALESCE($2::jsonb,contenido),documento_id=$3,fecha_actualizacion=CURRENT_TIMESTAMP WHERE proyecto_id=$4 AND user_id=$5`, result.Revision, content, result.DocumentoID, projectID, userID); err != nil {
		return nil, err
	}
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	var key any
	if keyID > 0 {
		key = keyID
	}
	if _, err := tx.Exec(ctx, `INSERT INTO memoria_operaciones(proyecto_id,user_id,operacion_id,request_hash,resultado,api_key_id) VALUES($1,$2,$3,$4,$5,$6)`, projectID, userID, req.OperacionID, hash, resultJSON, key); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func writeMemoryDocument(ctx context.Context, tx pgx.Tx, userID, projectID int, existing *int, title, content, kind string) (int, error) {
	var id int
	if existing != nil {
		err := tx.QueryRow(ctx, `UPDATE documentos_proyecto SET titulo=$1,contenido=$2,tipo=$3,tags='memoria,gestionado-por-agente',gestionado=true,eliminado=false,fecha_actualizacion=CURRENT_TIMESTAMP
			WHERE id=$4 AND user_id=$5 AND proyecto_id=$6 RETURNING id`, title, content, kind, *existing, userID, projectID).Scan(&id)
		if !errors.Is(err, pgx.ErrNoRows) {
			return id, err
		}
	}
	err := tx.QueryRow(ctx, `INSERT INTO documentos_proyecto(proyecto_id,user_id,titulo,contenido,tipo,tags,gestionado)
		VALUES($1,$2,$3,$4,$5,'memoria,gestionado-por-agente',true) RETURNING id`, projectID, userID, title, content, kind).Scan(&id)
	return id, err
}
