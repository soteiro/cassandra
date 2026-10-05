package admin

import (
	"context"
	"errors"
	"testing"

	"cassandra/internal/testdb"
	"cassandra/repository"

	"golang.org/x/crypto/bcrypt"
)

func setup(t *testing.T) *repository.UserRepository {
	t.Helper()
	return repository.NewUserRepository(testdb.New(t, "admin"))
}

func storedHash(t *testing.T, repo *repository.UserRepository, email string) string {
	t.Helper()
	user, err := repo.GetByEmail(context.Background(), email)
	if err != nil {
		t.Fatal(err)
	}
	return user.Password
}

func TestCreateUser(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	user, err := CreateUser(ctx, repo, NewUser{Nombre: " Ada ", Email: " Ada@Cassandra.Test ", Password: "clave-segura"})
	if err != nil {
		t.Fatal(err)
	}
	if user.Email != "ada@cassandra.test" || user.Nombre != "Ada" {
		t.Errorf("usuario = %+v, se esperaba email y nombre normalizados", user)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash(t, repo, user.Email)), []byte("clave-segura")); err != nil {
		t.Error("la contraseña debe guardarse hasheada con bcrypt")
	}

	t.Run("email duplicado", func(t *testing.T) {
		_, err := CreateUser(ctx, repo, NewUser{Nombre: "Otra", Email: "ada@cassandra.test", Password: "clave-segura"})
		if !errors.Is(err, ErrEmailTaken) {
			t.Errorf("error = %v, se esperaba ErrEmailTaken", err)
		}
	})
}

func TestCreateUserValidation(t *testing.T) {
	repo := setup(t)
	cases := map[string]NewUser{
		"sin nombre":       {Email: "a@b.cl", Password: "clave-segura"},
		"sin email":        {Nombre: "A", Password: "clave-segura"},
		"email inválido":   {Nombre: "A", Email: "no-es-email", Password: "clave-segura"},
		"email con nombre": {Nombre: "A", Email: "Ada <a@b.cl>", Password: "clave-segura"},
		"contraseña corta": {Nombre: "A", Email: "a@b.cl", Password: "1234567"},
		"contraseña vacía": {Nombre: "A", Email: "a@b.cl"},
	}
	for name, u := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := CreateUser(context.Background(), repo, u); err == nil {
				t.Error("se esperaba un error de validación")
			}
		})
	}
}

func TestResetPassword(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()
	if _, err := CreateUser(ctx, repo, NewUser{Nombre: "Ada", Email: "ada@cassandra.test", Password: "clave-vieja"}); err != nil {
		t.Fatal(err)
	}

	if err := ResetPassword(ctx, repo, "ADA@cassandra.test", "clave-nueva"); err != nil {
		t.Fatal(err)
	}
	hash := storedHash(t, repo, "ada@cassandra.test")
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte("clave-nueva")) != nil {
		t.Error("la contraseña nueva no quedó guardada")
	}

	if err := ResetPassword(ctx, repo, "nadie@cassandra.test", "clave-nueva"); !errors.Is(err, ErrUserNotFound) {
		t.Errorf("error = %v, se esperaba ErrUserNotFound", err)
	}
	if err := ResetPassword(ctx, repo, "ada@cassandra.test", "corta"); err == nil {
		t.Error("se esperaba error por contraseña corta")
	}
}

func TestCreateUserAlias(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	// Sin alias se guarda NULL: varios usuarios pueden no tener alias.
	for _, email := range []string{"uno@cassandra.test", "dos@cassandra.test"} {
		if _, err := CreateUser(ctx, repo, NewUser{Nombre: "X", Email: email, Password: "clave-segura"}); err != nil {
			t.Fatalf("usuario sin alias %s: %v", email, err)
		}
	}

	if _, err := CreateUser(ctx, repo, NewUser{Nombre: "A", Alias: "ada", Email: "a@cassandra.test", Password: "clave-segura"}); err != nil {
		t.Fatal(err)
	}
	_, err := CreateUser(ctx, repo, NewUser{Nombre: "B", Alias: "ada", Email: "b@cassandra.test", Password: "clave-segura"})
	if !errors.Is(err, ErrAliasTaken) {
		t.Errorf("alias repetido: error = %v, se esperaba ErrAliasTaken", err)
	}
}
