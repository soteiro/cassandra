package repository

import (
	"cassandra/models"
	"context"
	"fmt"

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

	// Ejecutamos la consulta usando la conexión guardada en el struct (r.db)
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
		return nil, err
	}

	return &user, nil
}

// GetAll obtiene todos los usuarios de la base de datos
func (r *UserRepository) GetAll(ctx context.Context) ([]models.UserResponse, error) {
	// 1. Usamos Query (en lugar de QueryRow) porque esperamos más de una fila de resultados
	query := "SELECT id, nombre, alias, email, fecha_creacion FROM users WHERE eliminado = false"
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	// 2. Muy importante: nos aseguramos de cerrar las filas al terminar para devolver la conexión al pool
	defer rows.Close()

	var users []models.UserResponse

	// 3. Iteramos por cada una de las filas que nos devolvió PostgreSQL
	for rows.Next() {
		var u models.UserResponse
		err := rows.Scan(&u.ID, &u.Nombre, &u.Alias, &u.Email, &u.FechaCreacion)
		if err != nil {
			return nil, err
		}
		// Agregamos el usuario al slice (lista)
		users = append(users, u)
	}

	// 4. Verificamos si hubo algún error durante la iteración
	if err = rows.Err(); err != nil {
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
		return nil, err
	}

	return &user, nil
}

// eliminar user por id
func (r *UserRepository) Delete(ctx context.Context, id int) (error){
	query := "UPDATE users SET eliminado = true WHERE id = $1"

	result, err := r.db.Exec(ctx, query, id)
	if err != nil{
		return err
	}

	if result.RowsAffected() == 0 {
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
		req.Email,id,
	).Scan(
		&user.ID,
		&user.Nombre,
		&user.Alias,
		&user.Email,
		&user.FechaCreacion,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}
