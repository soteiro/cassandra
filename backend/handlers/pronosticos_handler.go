package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"cassandra/middleware"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

// PronosticosHandler atiende los pronósticos de planificación y de proyectos.
type PronosticosHandler struct {
	repo  *repository.PronosticosRepository
	owner *repository.Ownership
}

func NewPronosticosHandler(repo *repository.PronosticosRepository, owner *repository.Ownership) *PronosticosHandler {
	return &PronosticosHandler{repo: repo, owner: owner}
}

// Planificacion atiende GET /api/pronosticos/planificacion.
func (h *PronosticosHandler) Planificacion(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	res, err := h.repo.Planificacion(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Pronosticos.Planificacion] Error en repositorio: %v | user_id=%d", err, userID)
		dbError(w, "Error al calcular la planificación", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// Proyecto atiende GET /api/proyects/{proyect_id}/pronostico.
func (h *PronosticosHandler) Proyecto(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	proyectoID, err := atoi32(chi.URLParam(r, "proyect_id"))
	if err != nil || proyectoID <= 0 {
		http.Error(w, "ID de proyecto inválido", http.StatusBadRequest)
		return
	}
	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.Proyecto, ID: proyectoID}) {
		return
	}
	res, err := h.repo.Proyecto(r.Context(), userID, proyectoID)
	if err != nil {
		log.Printf("[HANDLER:Pronosticos.Proyecto] Error en repositorio: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		dbError(w, "Error al calcular el pronóstico del proyecto", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
