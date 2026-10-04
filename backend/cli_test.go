package main

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"cassandra/internal/testdb"
	"cassandra/repository"

	"golang.org/x/crypto/bcrypt"
)

func fixedPassword(p string) passwordPrompt {
	return func(bool) (string, error) { return p, nil }
}

func TestRunCommandCreateAndResetUser(t *testing.T) {
	db := testdb.New(t, "main")
	repo := repository.NewUserRepository(db)
	ctx := context.Background()
	var out bytes.Buffer

	err := runCommand(ctx, []string{"create-user", "--email", "ada@cassandra.test", "--nombre", "Ada"}, db, fixedPassword("clave-segura"), &out)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "Usuario creado: ada@cassandra.test") {
		t.Errorf("salida = %q", out.String())
	}

	out.Reset()
	err = runCommand(ctx, []string{"reset-password", "--email", "ada@cassandra.test"}, db, fixedPassword("clave-nueva-1"), &out)
	if err != nil {
		t.Fatal(err)
	}
	user, _ := repo.GetByEmail(ctx, "ada@cassandra.test")
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("clave-nueva-1")) != nil {
		t.Error("reset-password no cambió la contraseña")
	}
}

func TestRunCommandErrors(t *testing.T) {
	db := testdb.New(t, "main")
	ctx := context.Background()
	var out bytes.Buffer

	if err := runCommand(ctx, []string{"borrar-todo"}, db, fixedPassword("x"), &out); err == nil {
		t.Error("un subcomando desconocido debería fallar")
	}
	if !strings.Contains(out.String(), "Uso:") {
		t.Error("debería mostrar la ayuda")
	}
	if err := runCommand(ctx, []string{"create-user", "--nombre", "Sin email"}, db, fixedPassword("clave-segura"), &out); err == nil {
		t.Error("create-user sin email debería fallar")
	}
	if err := runCommand(ctx, []string{"create-user", "--flag-que-no-existe"}, db, fixedPassword("x"), &out); err == nil {
		t.Error("un flag desconocido debería fallar")
	}
}

func TestRunCommandSeedDemo(t *testing.T) {
	db := testdb.New(t, "main")
	var out bytes.Buffer

	err := runCommand(context.Background(), []string{"seed-demo", "--email", "qa@cassandra.local"}, db, fixedPassword("demo-segura-123"), &out)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "Datos demo creados para qa@cassandra.local") {
		t.Errorf("salida = %q", out.String())
	}
}
