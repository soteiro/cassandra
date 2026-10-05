package handlers

import (
	"errors"
	"log"
	"net/http"

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
