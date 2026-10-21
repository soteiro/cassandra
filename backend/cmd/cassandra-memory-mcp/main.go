package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"cassandra/memorymcp"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	client, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := memorymcp.NewServer(client).Run(ctx, &mcp.StdioTransport{}); err != nil && ctx.Err() == nil {
		fmt.Fprintln(os.Stderr, "El conector de memoria terminó con un error de transporte")
		os.Exit(1)
	}
}

// newClient usa CASSANDRA_API_KEY si existe; si no, la key guardada para el proyecto
// vinculado al directorio de trabajo, de modo que un MCP global sirva a muchos proyectos.
func newClient() (*memorymcp.Client, error) {
	baseURL := os.Getenv("CASSANDRA_URL")
	if key := os.Getenv("CASSANDRA_API_KEY"); key != "" {
		return memorymcp.NewClient(baseURL, key)
	}
	cwd, err := os.Getwd()
	if err != nil {
		return memorymcp.NewUnavailableClient(baseURL, errors.New("no se pudo determinar el directorio de trabajo"))
	}
	keysDir, err := memorymcp.DefaultKeysDir(os.Getenv("CASSANDRA_KEYS_DIR"))
	if err != nil {
		return memorymcp.NewUnavailableClient(baseURL, err)
	}
	key, err := memorymcp.ResolveAPIKey("", baseURL, cwd, keysDir)
	if err != nil {
		return memorymcp.NewUnavailableClient(baseURL, err)
	}
	// Una key guardada con formato inválido es un error de configuración visible en las herramientas.
	client, err := memorymcp.NewClient(baseURL, key)
	if err != nil {
		return memorymcp.NewUnavailableClient(baseURL, errors.New("la key guardada del proyecto no tiene el formato de una key de memoria"))
	}
	return client, nil
}
