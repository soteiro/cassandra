package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// maneja la tabla refresh token
type AuthRepository struct {
	db *pgxpool.Pool
}

// constructor
func NewAuthRepository(db *pgxpool.Pool) *AuthRepository{
	return &AuthRepository{db:db}
}

// inserta un nuevo refreash token en db
func (r *AuthRepository) SaveRefreshToken(ctx context.Context, UserID int, token string, expiredAT time.Time) error {
	

	query := `
		INSERT INTO refresh_tokens (user_id, token, expira_en)
		VALUES ($1, $2, $3)
	`

	_, err := r.db.Exec(ctx, query, UserID, token, expiredAT)
	return err

}

func (r *AuthRepository) DeleteRefreshToken(ctx context.Context, token string) error {
	query := `
		DELETE FROM refresh_tokens WHERE token = $1
	`
	_, err := r.db.Exec(ctx, query, token)
	return err
}

// verifica si un refresh token existe y no ha expirado, devuelve id del user
func (r *AuthRepository) GetUserIDByRefreshToken(ctx context.Context, token string) (int, error){
	var UserID int
	var ExpiraEn time.Time
	
	query := `
		SELECT user_id, expira_en
		FROM refresh_tokens
		WHERE token = $1
	`

	err := r.db.QueryRow(ctx, query, token).Scan(&UserID, &ExpiraEn)
	if err != nil {
		return 0, err
	}

	// si ya paso la fecha de expiracion y borramos el token
	if time.Now().After(ExpiraEn){
		_= r.DeleteRefreshToken(ctx, token) //borrado automatico
		return 0, fmt.Errorf("el refresh token ha expirado")
	}

	return UserID, nil

}
