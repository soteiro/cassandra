package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"cassandra/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// internalError registra el error real y responde un mensaje genérico: los detalles
// (SQL, nombres de restricciones, rutas) quedan en el log y no llegan al cliente.
func internalError(w http.ResponseWriter, msg string, err error) {
	log.Printf("[ERROR] %s: %v", msg, err)
	http.Error(w, msg, http.StatusInternalServerError)
}

// notFound responde 404 con un mensaje genérico y registra el detalle.
func notFound(w http.ResponseWriter, msg string, err error) {
	log.Printf("[NOT FOUND] %s: %v", msg, err)
	http.Error(w, msg, http.StatusNotFound)
}

// isUniqueViolation indica si err es una violación de UNIQUE de PostgreSQL.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// dbError traduce un error del repositorio al código HTTP que corresponde y responde
// sin detalles internos (el detalle queda en el log):
//
//	no encontrado (0 filas, sin permisos)            → 404
//	valor fuera de un CHECK, texto o número fuera de rango, referencia inexistente → 400
//	duplicado (UNIQUE)                                → 409
//	cualquier otro                                    → 500
func dbError(w http.ResponseWriter, msg string, err error) {
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, repository.ErrNoEncontrado) {
		notFound(w, "Recurso no encontrado", err)
		return
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			log.Printf("[CONFLICT] %s: %v", msg, err)
			http.Error(w, "Ya existe un registro con esos datos", http.StatusConflict)
			return
		case "23514", "23502": // check_violation, not_null_violation
			log.Printf("[BAD REQUEST] %s: %v", msg, err)
			http.Error(w, "Algún valor no es válido", http.StatusBadRequest)
			return
		case "22001": // string_data_right_truncation
			log.Printf("[BAD REQUEST] %s: %v", msg, err)
			http.Error(w, "Algún texto supera el largo permitido", http.StatusBadRequest)
			return
		case "22003", "22P02", "22007", "22008": // fuera de rango, sintaxis, fecha inválida
			log.Printf("[BAD REQUEST] %s: %v", msg, err)
			http.Error(w, "Algún valor no es válido", http.StatusBadRequest)
			return
		case "23503": // foreign_key_violation
			log.Printf("[BAD REQUEST] %s: %v", msg, err)
			http.Error(w, "Hace referencia a un recurso que no existe", http.StatusBadRequest)
			return
		}
	}
	internalError(w, msg, err)
}

// atoi32 es strconv.Atoi limitado a 32 bits: los ids son INTEGER en PostgreSQL, y un
// valor mayor (p. ej. 99999999999) no puede existir; se trata como id inválido (400)
// en lugar de llegar al driver y terminar en un 500.
func atoi32(s string) (int, error) {
	n, err := strconv.ParseInt(s, 10, 32)
	return int(n), err
}
