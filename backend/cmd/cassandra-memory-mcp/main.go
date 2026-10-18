package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"cassandra/memorymcp"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	client, err := memorymcp.NewClient(os.Getenv("CASSANDRA_URL"), os.Getenv("CASSANDRA_API_KEY"))
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
