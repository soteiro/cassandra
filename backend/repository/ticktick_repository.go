package repository

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TickTickStoredConnection struct {
	Token            []byte
	Version          int64
	ConnectedAt      *time.Time
	ExpiresAt        *time.Time
	NeedsReauthorize bool
}

type TickTickRepository struct{ db *pgxpool.Pool }

func NewTickTickRepository(db *pgxpool.Pool) *TickTickRepository { return &TickTickRepository{db} }

func (r *TickTickRepository) Get(ctx context.Context, userID int) (TickTickStoredConnection, error) {
	var c TickTickStoredConnection
	err := r.db.QueryRow(ctx, `SELECT access_token,version,connected_at,expires_at,needs_reauthorize FROM ticktick_connections WHERE user_id=$1`, userID).
		Scan(&c.Token, &c.Version, &c.ConnectedAt, &c.ExpiresAt, &c.NeedsReauthorize)
	if err == pgx.ErrNoRows {
		return c, nil
	}
	return c, err
}

func stateHash(state string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(state))) }

// Iniciar otra autorización invalida las anteriores, sin quitar la conexión actual.
func (r *TickTickRepository) Start(ctx context.Context, userID int, state string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var version int64
	err = tx.QueryRow(ctx, `INSERT INTO ticktick_connections(user_id,version) VALUES($1,1)
		ON CONFLICT(user_id) DO UPDATE SET version=ticktick_connections.version+1 RETURNING version`, userID).Scan(&version)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM ticktick_oauth_states WHERE user_id=$1 OR expires_at<CURRENT_TIMESTAMP`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO ticktick_oauth_states(state_hash,user_id,connection_version,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+INTERVAL '10 minutes')`, stateHash(state), userID, version); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TickTickRepository) Consume(ctx context.Context, state string) (userID int, version int64, err error) {
	err = r.db.QueryRow(ctx, `DELETE FROM ticktick_oauth_states s USING users u
		WHERE s.state_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP AND s.user_id=u.id AND u.eliminado=false
		RETURNING s.user_id,s.connection_version`, stateHash(state)).Scan(&userID, &version)
	return
}

func (r *TickTickRepository) Save(ctx context.Context, userID int, version int64, token []byte, expires *time.Time) error {
	tag, err := r.db.Exec(ctx, `UPDATE ticktick_connections SET access_token=$3,version=version+1,connected_at=CURRENT_TIMESTAMP,expires_at=$4,needs_reauthorize=false
		WHERE user_id=$1 AND version=$2 AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND eliminado=false)`, userID, version, token, expires)
	if err == nil && tag.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return err
}

func (r *TickTickRepository) MarkUnauthorized(ctx context.Context, userID int, version int64) error {
	_, err := r.db.Exec(ctx, `UPDATE ticktick_connections SET needs_reauthorize=true WHERE user_id=$1 AND version=$2`, userID, version)
	return err
}

func (r *TickTickRepository) Disconnect(ctx context.Context, userID int) ([]byte, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `INSERT INTO ticktick_connections(user_id) VALUES($1) ON CONFLICT DO NOTHING`, userID); err != nil {
		return nil, err
	}
	var token []byte
	if err := tx.QueryRow(ctx, `SELECT access_token FROM ticktick_connections WHERE user_id=$1 FOR UPDATE`, userID).Scan(&token); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE ticktick_connections SET access_token=NULL,version=version+1,connected_at=NULL,expires_at=NULL,needs_reauthorize=false WHERE user_id=$1`, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM ticktick_oauth_states WHERE user_id=$1`, userID); err != nil {
		return nil, err
	}
	return token, tx.Commit(ctx)
}
