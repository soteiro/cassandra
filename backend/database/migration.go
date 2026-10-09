package database

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib"
)

//directiva //go:embed, le dice a go que compile los archivos sql dentro del ejecutable
//go:embed migrations/*.sql
var migrationFS embed.FS

// MigrationFS expone las migraciones embebidas (para los tests).
func MigrationFS() fs.FS { return migrationFS }

// RunMigrations aplica las migraciones embebidas en el binario.
func RunMigrations(databaseURL string) error {
	return RunMigrationsFrom(databaseURL, migrationFS, "migrations")
}

// RunMigrationsFrom aplica las migraciones de dir dentro de fsys. Está separada de
// RunMigrations para poder probarla con migraciones de test.
//
// Dos casos no detienen el rollback de un deploy:
//   - La base está en una versión más nueva que la que conoce este binario (se volvió a
//     la versión anterior tras un deploy fallido): se arranca igual, con un aviso. Por eso
//     las migraciones deben ser aditivas: no borrar ni renombrar lo que usa la versión
//     anterior.
//   - Una migración falla: cada archivo se ejecuta en un único Exec, que PostgreSQL
//     trata como una transacción implícita, así que el SQL ya se deshizo y solo queda
//     la marca "dirty" de golang-migrate. Se devuelve la marca a la versión previa para
//     que el binario anterior pueda arrancar.
func RunMigrationsFrom(databaseURL string, fsys fs.FS, dir string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("no se pudo conectar para aplicar las migraciones: %w", err)
	}
	defer db.Close()

	// iniciar el cargador de archivos
	sourceDriver, err := iofs.New(fsys, dir)
	if err != nil {
		return fmt.Errorf("no se pudo iniciar el cargador de archivos: %w", err)
	}

	// cargar el driver de migraciones
	dbDriver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("no se pudo crear el driver de base de datos para migraciones: %w", err)
	}

	// instanciar golang-migrate
	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return fmt.Errorf("no se pudo instanciar golang-migrate: %w", err)
	}

	upErr := m.Up()
	switch {
	case upErr == nil:
		log.Println("Migraciones aplicadas con exito")
		return nil
	case errors.Is(upErr, migrate.ErrNoChange):
		log.Println("base de datos al Dia, no se aplicaron cambios")
		return nil
	}

	// Una base que ya estaba dirty al arrancar no la dejó este proceso: no se sabe qué
	// pasó, así que se deja para revisión manual.
	var alreadyDirty migrate.ErrDirty
	if errors.As(upErr, &alreadyDirty) {
		return fmt.Errorf("la base quedó marcada como dirty en la versión %d por una ejecución anterior; revísala a mano: %w", alreadyDirty.Version, upErr)
	}

	version, dirty, verErr := m.Version()
	if verErr != nil {
		return fmt.Errorf("error al ejecutar migraciones: %w", upErr)
	}

	if !dirty && errors.Is(upErr, os.ErrNotExist) {
		latest, err := latestVersion(sourceDriver)
		if err == nil && version > latest {
			log.Printf("AVISO: la base está en la versión %d y este binario solo conoce hasta la %d; se arranca igual (¿rollback de un deploy?)", version, latest)
			return nil
		}
	}

	if dirty {
		prev := previousVersion(sourceDriver, version)
		if err := m.Force(prev); err != nil {
			return fmt.Errorf("la migración %d falló (%v) y no se pudo devolver la marca a la versión %d: %w", version, upErr, prev, err)
		}
		return fmt.Errorf("la migración %d falló y se deshizo; la base sigue en la versión %d: %w", version, prev, upErr)
	}

	return fmt.Errorf("error al ejecutar migraciones: %w", upErr)
}

// latestVersion devuelve la versión más alta disponible en el origen.
func latestVersion(src source.Driver) (uint, error) {
	v, err := src.First()
	if err != nil {
		return 0, err
	}
	for {
		next, err := src.Next(v)
		if errors.Is(err, os.ErrNotExist) {
			return v, nil
		}
		if err != nil {
			return 0, err
		}
		v = next
	}
}

// previousVersion devuelve la versión anterior a v en el origen, o -1 (NilVersion) si v
// es la primera: la base queda como si nunca se hubiera migrado.
func previousVersion(src source.Driver, v uint) int {
	prev, err := src.Prev(v)
	if err != nil {
		return -1 // NilVersion de golang-migrate
	}
	return int(prev)
}
