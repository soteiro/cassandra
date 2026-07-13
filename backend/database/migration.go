package database

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_"github.com/jackc/pgx/v5/stdlib"

)

//directiva //go:embed, le dice a go que compile los archivos sql dentro del ejecutable
//go:embed migrations/*.sql
var migrationFS embed.FS

func RunMigrations(databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("no se pudo conectar para aplicar las migraciones: %w", err)
	}
	defer db.Close()

	// iniciar el cargador de archivos
	sourceDriver, err := iofs.New(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("no se pudo iniciar el cargador de archivos: %w", err)
	}

	// cargar el driver de migraciones 
	dbDriver , err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("no se pudo crear el driver de base de datos para migraciones: %w", err)
	}

	// instanciar golang-migrate
	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return fmt.Errorf("no se pudo instanciar golang-migrate: %w", err)
	}

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			log.Println("base de datos al Dia, no se aplicaron cambios")
			return nil
		}

		return fmt.Errorf("error al ejecutar migraciones: %w", err)
	}

	log.Println("Migraciones aplicadas con exito")
	return nil
}

