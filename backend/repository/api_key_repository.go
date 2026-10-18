package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"cassandra/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const MemoryKeyPrefix = "cass_mem_"

type APIKeyRepository struct{ db *pgxpool.Pool }

func NewAPIKeyRepository(db *pgxpool.Pool) *APIKeyRepository { return &APIKeyRepository{db: db} }

func keyHash(token string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(token))) }

func (r *APIKeyRepository) Create(ctx context.Context, userID int, req models.CreateAPIKeyRequest) (*models.IssuedAPIKey, error) {
	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" || strings.ContainsRune(req.Nombre, '\x00') || utf8.RuneCountInString(req.Nombre) > 100 || len(req.Scopes) == 0 || len(req.Scopes) > 2 || len(req.ProyectoIDs) == 0 || len(req.ProyectoIDs) > 50 {
		return nil, fmt.Errorf("%w: nombre, permisos y entre uno y cincuenta proyectos son obligatorios", models.ErrMemoryInvalid)
	}
	for _, scope := range req.Scopes {
		if scope != models.MemoryRead && scope != models.MemoryWrite {
			return nil, fmt.Errorf("%w: permiso desconocido", models.ErrMemoryInvalid)
		}
	}
	if req.ExpiraEn != nil && !req.ExpiraEn.After(time.Now()) {
		return nil, fmt.Errorf("%w: el vencimiento debe estar en el futuro", models.ErrMemoryInvalid)
	}
	slices.Sort(req.Scopes)
	req.Scopes = slices.Compact(req.Scopes)
	slices.Sort(req.ProyectoIDs)
	req.ProyectoIDs = slices.Compact(req.ProyectoIDs)
	for _, id := range req.ProyectoIDs {
		if id <= 0 || id > math.MaxInt32 {
			return nil, fmt.Errorf("%w: ID de proyecto inválido", models.ErrMemoryInvalid)
		}
	}
	var secret [32]byte
	if _, err := rand.Read(secret[:]); err != nil {
		return nil, err
	}
	token := MemoryKeyPrefix + base64.RawURLEncoding.EncodeToString(secret[:])
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, id := range req.ProyectoIDs {
		var owned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM proyectos WHERE id=$1 AND user_id=$2 AND eliminado=false)`, id, userID).Scan(&owned); err != nil {
			return nil, err
		}
		if !owned {
			return nil, ErrNoEncontrado
		}
	}
	issued := &models.IssuedAPIKey{APIKey: models.APIKey{Nombre: req.Nombre, Prefijo: token[:20], Scopes: req.Scopes, ProyectoIDs: req.ProyectoIDs, ExpiraEn: req.ExpiraEn}, Token: token}
	err = tx.QueryRow(ctx, `INSERT INTO api_keys(user_id,nombre,prefijo,token_hash,scopes,expira_en)
		VALUES($1,$2,$3,$4,$5,$6) RETURNING id,fecha_creacion`, userID, req.Nombre, issued.Prefijo, keyHash(token), req.Scopes, req.ExpiraEn).Scan(&issued.ID, &issued.FechaCreacion)
	if err != nil {
		return nil, err
	}
	for _, id := range req.ProyectoIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO api_key_proyectos(api_key_id,proyecto_id) VALUES($1,$2)`, issued.ID, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return issued, nil
}

func (r *APIKeyRepository) List(ctx context.Context, userID int) ([]models.APIKey, error) {
	rows, err := r.db.Query(ctx, `SELECT k.id,k.nombre,k.prefijo,k.scopes,
		ARRAY(SELECT proyecto_id FROM api_key_proyectos WHERE api_key_id=k.id ORDER BY proyecto_id),
		k.fecha_creacion,k.expira_en,k.revocada_en,k.ultimo_uso FROM api_keys k WHERE k.user_id=$1 ORDER BY k.id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := []models.APIKey{}
	for rows.Next() {
		var k models.APIKey
		if err := rows.Scan(&k.ID, &k.Nombre, &k.Prefijo, &k.Scopes, &k.ProyectoIDs, &k.FechaCreacion, &k.ExpiraEn, &k.RevocadaEn, &k.UltimoUso); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *APIKeyRepository) Revoke(ctx context.Context, userID int, id int64) error {
	cmd, err := r.db.Exec(ctx, `UPDATE api_keys SET revocada_en=COALESCE(revocada_en,CURRENT_TIMESTAMP) WHERE id=$1 AND user_id=$2`, id, userID)
	if err == nil && cmd.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return err
}

// Las keys de memoria se autentican solo en el router de memoria. No son JWTs.
func (r *APIKeyRepository) Authenticate(ctx context.Context, token string) (*models.MemoryAccess, error) {
	if !strings.HasPrefix(token, MemoryKeyPrefix) || len(token) != len(MemoryKeyPrefix)+43 {
		return nil, pgx.ErrNoRows
	}
	a := &models.MemoryAccess{}
	err := r.db.QueryRow(ctx, `UPDATE api_keys k SET ultimo_uso=CURRENT_TIMESTAMP FROM users u
		WHERE k.token_hash=$1 AND k.user_id=u.id AND u.eliminado=false AND k.revocada_en IS NULL
		AND (k.expira_en IS NULL OR k.expira_en>CURRENT_TIMESTAMP)
		RETURNING k.id,k.user_id,k.scopes,ARRAY(SELECT proyecto_id FROM api_key_proyectos WHERE api_key_id=k.id ORDER BY proyecto_id)`, keyHash(token)).Scan(&a.APIKeyID, &a.UserID, &a.Scopes, &a.ProyectoIDs)
	return a, err
}
