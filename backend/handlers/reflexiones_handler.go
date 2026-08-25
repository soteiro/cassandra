package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type ReflexionesHandler struct {
	repo *repository.ReflexionesRepository
}

func NewReflexionesHandler(repo *repository.ReflexionesRepository) *ReflexionesHandler {
	return &ReflexionesHandler{repo: repo}
}

// esTipoValido comprueba si el tipo está dentro de los permitidos por el check de DB
func esTipoValido(tipo string) bool {
	switch tipo {
	case "reflexion", "evento", "memoria":
		return true
	default:
		return false
	}
}

// Create atiende POST /api/reflexiones
func (h *ReflexionesHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Reflexiones.Create] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.CreateReflexionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Reflexiones.Create] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Reflexion = strings.TrimSpace(req.Reflexion)
	req.Tipo = strings.ToLower(strings.TrimSpace(req.Tipo))

	if req.Reflexion == "" {
		log.Printf("[HANDLER:Reflexiones.Create] Validación fallida: texto de reflexión vacío | user_id=%d", userID)
		http.Error(w, "El texto de la reflexión es obligatorio", http.StatusBadRequest)
		return
	}

	if req.Tipo == "" {
		req.Tipo = "reflexion"
	} else if !esTipoValido(req.Tipo) {
		log.Printf("[HANDLER:Reflexiones.Create] Validación fallida: tipo inválido %q | user_id=%d", req.Tipo, userID)
		http.Error(w, "Tipo inválido. Debe ser 'reflexion', 'evento' o 'memoria'", http.StatusBadRequest)
		return
	}

	req.UserID = userID

	reflexion, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Reflexiones.Create] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al guardar la reflexión", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Reflexiones.Create] Éxito: reflexión creada | id=%d user_id=%d tipo=%s", reflexion.ID, userID, reflexion.Tipo)
	json.NewEncoder(w).Encode(reflexion)
}

// GetAll atiende GET /api/reflexiones (con soporte para ?tipo=...)
func (h *ReflexionesHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Reflexiones.GetAll] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tipoFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tipo")))

	reflexiones, err := h.repo.GetAll(r.Context(), userID, tipoFilter)
	if err != nil {
		log.Printf("[HANDLER:Reflexiones.GetAll] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener las reflexiones", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Reflexiones.GetAll] Éxito: %d reflexiones obtenidas | user_id=%d tipo_filter=%q", len(reflexiones), userID, tipoFilter)
	json.NewEncoder(w).Encode(reflexiones)
}

// GetByID atiende GET /api/reflexiones/{id}
func (h *ReflexionesHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Reflexiones.GetByID] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Reflexiones.GetByID] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID de reflexión inválido", http.StatusBadRequest)
		return
	}

	reflexion, err := h.repo.GetByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Reflexiones.GetByID] No encontrada | id=%d user_id=%d", id, userID)
			http.Error(w, "Reflexión no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Reflexiones.GetByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al obtener la reflexión", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Reflexiones.GetByID] Éxito: reflexión obtenida | id=%d user_id=%d", reflexion.ID, userID)
	json.NewEncoder(w).Encode(reflexion)
}

// Update atiende PUT /api/reflexiones/{id}
func (h *ReflexionesHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Reflexiones.Update] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Reflexiones.Update] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID de reflexión inválido", http.StatusBadRequest)
		return
	}

	var req models.UpdateReflexionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Reflexiones.Update] JSON inválido: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if req.Reflexion != nil {
		trimmed := strings.TrimSpace(*req.Reflexion)
		if trimmed == "" {
			log.Printf("[HANDLER:Reflexiones.Update] Validación fallida: texto vacío | id=%d user_id=%d", id, userID)
			http.Error(w, "El texto de la reflexión no puede quedar vacío", http.StatusBadRequest)
			return
		}
		req.Reflexion = &trimmed
	}

	if req.Tipo != nil {
		tipoNorm := strings.ToLower(strings.TrimSpace(*req.Tipo))
		if !esTipoValido(tipoNorm) {
			log.Printf("[HANDLER:Reflexiones.Update] Validación fallida: tipo inválido %q | id=%d user_id=%d", tipoNorm, id, userID)
			http.Error(w, "Tipo inválido. Debe ser 'reflexion', 'evento' o 'memoria'", http.StatusBadRequest)
			return
		}
		req.Tipo = &tipoNorm
	}

	reflexion, err := h.repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Reflexiones.Update] No encontrada para actualizar | id=%d user_id=%d", id, userID)
			http.Error(w, "Reflexión no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Reflexiones.Update] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar la reflexión", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Reflexiones.Update] Éxito: reflexión actualizada | id=%d user_id=%d", reflexion.ID, userID)
	json.NewEncoder(w).Encode(reflexion)
}

// Delete atiende DELETE /api/reflexiones/{id}
func (h *ReflexionesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Reflexiones.Delete] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Reflexiones.Delete] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID de reflexión inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), id, userID); err != nil {
		log.Printf("[HANDLER:Reflexiones.Delete] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al eliminar la reflexión", http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:Reflexiones.Delete] Éxito: reflexión eliminada | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}
