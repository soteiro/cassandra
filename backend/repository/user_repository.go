package repository

import (
	"cassandra/models"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository se encarga de hablar con la base de datos para la tabla 'users'
type UserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository es el constructor del repositorio
func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserta un nuevo usuario en la base de datos
func (r *UserRepository) Create(ctx context.Context, req *models.UserRequest) (*models.UserResponse, error) {
	var user models.UserResponse

	query := `
            INSERT INTO users (nombre, alias, email, password)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nombre, alias, email, fecha_creacion
        `

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Alias,
		req.Email,
		req.Password,
	).Scan(
		&user.ID,
		&user.Nombre,
		&user.Alias,
		&user.Email,
		&user.FechaCreacion,
	)

	if err != nil {
		log.Printf("[REPO:User.Create] Error en SQL INSERT: %v | email=%s", err, req.Email)
		return nil, err
	}

	return &user, nil
}

// GetAll obtiene todos los usuarios de la base de datos
func (r *UserRepository) GetAll(ctx context.Context) ([]models.UserResponse, error) {
	query := "SELECT id, nombre, alias, email, fecha_creacion FROM users WHERE eliminado = false"
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		log.Printf("[REPO:User.GetAll] Error en SQL SELECT: %v", err)
		return nil, err
	}
	defer rows.Close()

	var users []models.UserResponse

	for rows.Next() {
		var u models.UserResponse
		err := rows.Scan(&u.ID, &u.Nombre, &u.Alias, &u.Email, &u.FechaCreacion)
		if err != nil {
			log.Printf("[REPO:User.GetAll] Error al escanear fila: %v", err)
			return nil, err
		}
		users = append(users, u)
	}

	if err = rows.Err(); err != nil {
		log.Printf("[REPO:User.GetAll] Error al iterar filas: %v", err)
		return nil, err
	}

	return users, nil
}

// seleccionar usuario por id
func (r *UserRepository) GetById(ctx context.Context, id int) (*models.UserResponse, error) {
	var user models.UserResponse
	query := "SELECT id, nombre, alias, email, fecha_creacion FROM users WHERE id = $1 AND eliminado is false"
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Nombre,
		&user.Alias,
		&user.Email,
		&user.FechaCreacion,
	)
	if err != nil {
		log.Printf("[REPO:User.GetById] Error en SQL SELECT: %v | id=%d", err, id)
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User

	query := "SELECT id, nombre, alias, email, password,fecha_creacion FROM users WHERE email = $1 AND eliminado is false"

	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Nombre,
		&user.Alias,
		&user.Email,
		&user.Password,
		&user.FechaCreacion,
	)

	if err != nil {
		log.Printf("[REPO:User.GetByEmail] Error en SQL SELECT: %v | email=%s", err, email)
		return nil, err
	}

	return &user, nil
}

// eliminar user por id
func (r *UserRepository) Delete(ctx context.Context, id int) error {
	query := "UPDATE users SET eliminado = true WHERE id = $1"

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		log.Printf("[REPO:User.Delete] Error en SQL UPDATE: %v | id=%d", err, id)
		return err
	}

	if result.RowsAffected() == 0 {
		log.Printf("[REPO:User.Delete] Registro no encontrado o sin permisos | id=%d", id)
		return fmt.Errorf("no se encontro el usuario con el id %d", id)
	}

	return nil
}

// Update user
func (r *UserRepository) Update(ctx context.Context, id int, req *models.UserUpdateRequest) (*models.UserResponse, error) {
	var user models.UserResponse

	query := `
	UPDATE users
	SET nombre  = $1, alias = $2, email = $3
	WHERE id  = $4 AND eliminado = false
	RETURNING id, nombre, alias, email, fecha_creacion	
	`

	err := r.db.QueryRow(
		ctx,
		query,
		req.Nombre,
		req.Alias,
		req.Email,
		id,
	).Scan(
		&user.ID,
		&user.Nombre,
		&user.Alias,
		&user.Email,
		&user.FechaCreacion,
	)

	if err != nil {
		log.Printf("[REPO:User.Update] Error en SQL UPDATE: %v | id=%d", err, id)
		return nil, err
	}

	return &user, nil
}

