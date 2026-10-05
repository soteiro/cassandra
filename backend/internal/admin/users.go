// Package admin contiene las operaciones de administración que se ejecutan desde la
// terminal del servidor (./cassandra-app create-user, reset-password). La API HTTP no
// permite crear cuentas: quien administra el servidor decide quién tiene acceso.
package admin

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"cassandra/models"
	"cassandra/repository"

	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

const MinPasswordLength = 8

var (
	ErrUserNotFound = errors.New("no existe un usuario activo con ese email")
	ErrEmailTaken   = errors.New("ya existe un usuario con ese email")
	ErrAliasTaken   = errors.New("ya existe un usuario con ese alias")
)

type NewUser struct {
	Nombre   string
	Alias    string
	Email    string
	Password string
}

// CreateUser valida los datos, hashea la contraseña y crea el usuario (con su persona "yo").
func CreateUser(ctx context.Context, repo *repository.UserRepository, u NewUser) (*models.UserResponse, error) {
	nombre := strings.TrimSpace(u.Nombre)
	if nombre == "" {
		return nil, errors.New("el nombre es obligatorio")
	}
	email, err := normalizeEmail(u.Email)
	if err != nil {
		return nil, err
	}
	hash, err := hashPassword(u.Password)
	if err != nil {
		return nil, err
	}

	user, err := repo.Create(ctx, &models.UserRequest{
		Nombre:   nombre,
		Alias:    strings.TrimSpace(u.Alias),
		Email:    email,
		Password: hash,
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		if pgErr.ConstraintName == "users_alias_key" {
			return nil, ErrAliasTaken
		}
		return nil, ErrEmailTaken
	}
	return user, err
}

// ResetPassword reemplaza la contraseña del usuario con ese email.
func ResetPassword(ctx context.Context, repo *repository.UserRepository, email, password string) error {
	email, err := normalizeEmail(email)
	if err != nil {
		return err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	n, err := repo.UpdatePasswordByEmail(ctx, email, hash)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", errors.New("el email es obligatorio")
	}
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email {
		return "", fmt.Errorf("email inválido: %q", email)
	}
	return email, nil
}

func hashPassword(password string) (string, error) {
	if len([]rune(password)) < MinPasswordLength {
		return "", fmt.Errorf("la contraseña debe tener al menos %d caracteres", MinPasswordLength)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}
