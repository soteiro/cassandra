package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"cassandra/internal/admin"
	"cassandra/repository"

	"golang.org/x/term"
)

const cliUsage = `Uso:
  cassandra-app                                   inicia el servidor
  cassandra-app create-user --email E --nombre N [--alias A]
  cassandra-app reset-password --email E
  cassandra-app version

La contraseña se pide por la terminal (sin mostrarla). En scripts puede
entregarse por stdin: echo "$PASS" | cassandra-app create-user ...
`

// passwordPrompt pide una contraseña; confirm indica si se pide dos veces.
type passwordPrompt func(confirm bool) (string, error)

// runCommand ejecuta un subcomando de administración.
func runCommand(ctx context.Context, args []string, users *repository.UserRepository, readPassword passwordPrompt, out io.Writer) error {
	switch args[0] {
	case "create-user":
		fs := flag.NewFlagSet("create-user", flag.ContinueOnError)
		fs.SetOutput(out)
		email := fs.String("email", "", "email con el que iniciará sesión")
		nombre := fs.String("nombre", "", "nombre visible")
		alias := fs.String("alias", "", "alias (opcional)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		password, err := readPassword(true)
		if err != nil {
			return err
		}
		user, err := admin.CreateUser(ctx, users, admin.NewUser{Nombre: *nombre, Alias: *alias, Email: *email, Password: password})
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "Usuario creado: %s (id %d)\n", user.Email, user.ID)
		return nil

	case "reset-password":
		fs := flag.NewFlagSet("reset-password", flag.ContinueOnError)
		fs.SetOutput(out)
		email := fs.String("email", "", "email del usuario")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		password, err := readPassword(true)
		if err != nil {
			return err
		}
		if err := admin.ResetPassword(ctx, users, *email, password); err != nil {
			return err
		}
		fmt.Fprintf(out, "Contraseña actualizada para %s\n", strings.ToLower(strings.TrimSpace(*email)))
		return nil

	default:
		fmt.Fprint(out, cliUsage)
		return fmt.Errorf("subcomando desconocido: %q", args[0])
	}
}

// terminalPassword lee la contraseña sin eco si stdin es una terminal, o una línea de stdin si no.
func terminalPassword(confirm bool) (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return "", err
		}
		return strings.TrimRight(line, "\r\n"), nil
	}

	read := func(prompt string) (string, error) {
		fmt.Fprint(os.Stderr, prompt)
		b, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		return string(b), err
	}
	password, err := read("Contraseña: ")
	if err != nil || !confirm {
		return password, err
	}
	again, err := read("Repite la contraseña: ")
	if err != nil {
		return "", err
	}
	if password != again {
		return "", errors.New("las contraseñas no coinciden")
	}
	return password, nil
}
