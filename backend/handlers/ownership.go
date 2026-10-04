package handlers

import (
	"errors"
	"log"
	"net/http"

	"cassandra/repository"
)

// requireOwned verifica que los recursos referenciados por la petición (proyecto padre,
// persona, banco...) sean del usuario. Si no lo son responde 404 —sin revelar si el
// recurso existe para otra persona— y devuelve false.
func requireOwned(w http.ResponseWriter, r *http.Request, owner *repository.Ownership, userID int, refs ...repository.Ref) bool {
	err := owner.Check(r.Context(), userID, refs...)
	if err == nil {
		return true
	}
	if errors.Is(err, repository.ErrNoEncontrado) {
		log.Printf("[OWNERSHIP] referencia rechazada: %v | user_id=%d", err, userID)
		http.Error(w, "Recurso referenciado no encontrado", http.StatusNotFound)
		return false
	}
	log.Printf("[OWNERSHIP] error verificando referencias: %v | user_id=%d", err, userID)
	http.Error(w, "Error al verificar los recursos referenciados", http.StatusInternalServerError)
	return false
}

// idOf convierte una referencia opcional en un id (0 = sin referencia).
func idOf(id *int) int {
	if id == nil {
		return 0
	}
	return *id
}
