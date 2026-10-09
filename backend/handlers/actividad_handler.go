package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"cassandra/middleware"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

// maxPeriodoResumen limita el periodo de un resumen (un año y algo).
const maxPeriodoResumen = 400 * 24 * time.Hour

// ActividadHandler atiende "Lo que hiciste" y "En qué quedaste".
type ActividadHandler struct {
	repo  *repository.ActividadRepository
	owner *repository.Ownership
}

func NewActividadHandler(repo *repository.ActividadRepository, owner *repository.Ownership) *ActividadHandler {
	return &ActividadHandler{repo: repo, owner: owner}
}

// Resumen atiende GET /api/actividad/resumen?desde=&hasta= (instantes RFC 3339; el
// cliente calcula los límites en su zona horaria). El periodo es [desde, hasta).
func (h *ActividadHandler) Resumen(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	desde, err := time.Parse(time.RFC3339, r.URL.Query().Get("desde"))
	if err != nil {
		http.Error(w, "desde inválido: se espera una fecha RFC 3339 (p. ej. 2026-10-05T03:00:00Z)", http.StatusBadRequest)
		return
	}
	hasta, err := time.Parse(time.RFC3339, r.URL.Query().Get("hasta"))
	if err != nil {
		http.Error(w, "hasta inválido: se espera una fecha RFC 3339 (p. ej. 2026-10-12T03:00:00Z)", http.StatusBadRequest)
		return
	}
	if !hasta.After(desde) || hasta.Sub(desde) > maxPeriodoResumen {
		http.Error(w, "periodo inválido: hasta debe ser posterior a desde y el periodo no puede superar 400 días", http.StatusBadRequest)
		return
	}

	resumen, err := h.repo.Resumen(r.Context(), userID, desde, hasta)
	if err != nil {
		log.Printf("[HANDLER:Actividad.Resumen] Error en repositorio: %v | user_id=%d", err, userID)
		dbError(w, "Error al obtener el resumen de actividad", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resumen)
}

// PorProyecto atiende GET /api/proyects/{proyect_id}/actividad?limit=20.
func (h *ActividadHandler) PorProyecto(w http.ResponseWriter, r *http.Request) {
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
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, err = atoi32(l)
		if err != nil || limit < 1 || limit > 100 {
			http.Error(w, "limit inválido (1-100)", http.StatusBadRequest)
			return
		}
	}
	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.Proyecto, ID: proyectoID}) {
		return
	}

	eventos, err := h.repo.PorProyecto(r.Context(), userID, proyectoID, limit)
	if err != nil {
		log.Printf("[HANDLER:Actividad.PorProyecto] Error en repositorio: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		dbError(w, "Error al obtener la actividad del proyecto", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(eventos)
}
