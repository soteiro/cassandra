package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

// connect inicializa el pool de conexiones 
func Connect(databaseURL string)  (*pgxpool.Pool, error) {

	ctx ,cancel := context.WithTimeout(context.Background(), 5*time.Second)

	// esto se agrego en la version 1.21 de go, libera los recursos si la operacion lenta termian antes que expire el tiempo de espera  
	defer cancel();
	// configurar el pool con la url de la database
	config, err  := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		// aqui se pasa %v y no %w ya que el linter se queja de que se cancelara la operacion si llega en un formato incorrecto
		return nil, fmt.Errorf("no se pudo parsear la url: %v", cancel)
	}
	// crear el pool de conexiones
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("no se pudo crear el pool: %w", err)
	}

	//verificar el pool de conexiones con ping
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("fallo el ping a la db: %w", err)
	}

	// retonar exito de conexion
	log.Println("base de datos conectada")
	DB = pool
	return pool , nil
}
