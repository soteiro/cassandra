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

type InteraccionesHandler struct {
	repo *repository.InteraccionesRepository
}

func NewInteraccionesHandler(repo *repository.InteraccionesRepository) *InteraccionesHandler {
	return &InteraccionesHandler{
		repo: repo,
	}
}

// Create atiende POST /api/personas/{persona_id}/interacciones o POST /api/interacciones
func (h *InteraccionesHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.Create] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	var req models.InteraccionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Interacciones.Create] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Extraer persona_id de URL si está presente
	personaIDStr := chi.URLParam(r, "persona_id")
	if personaIDStr != "" {
		if pID, err := strconv.Atoi(personaIDStr); err == nil && pID > 0 {
			req.PersonaID = pID
		}
	}

	if req.PersonaID <= 0 {
		log.Printf("[HANDLER:Interacciones.Create] Validación fallida: persona_id es obligatorio | user_id=%d", userID)
		http.Error(w, "El ID de la persona (persona_id) es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	req.Interaccion = strings.TrimSpace(req.Interaccion)

	if req.Interaccion == "" {
		log.Printf("[HANDLER:Interacciones.Create] Validación fallida: interacción vacía | user_id=%d", userID)
		http.Error(w, "El texto de la interacción no puede estar vacío", http.StatusBadRequest)
		return
	}

	interaccion, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Interacciones.Create] Error en repositorio: %v | user_id=%d persona_id=%d", err, userID, req.PersonaID)
		http.Error(w, "Error al crear la interacción", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Interacciones.Create] Éxito: interacción creada | id=%d user_id=%d persona_id=%d", interaccion.ID, userID, req.PersonaID)
	json.NewEncoder(w).Encode(interaccion)
}

// GetAll atiende GET /api/interacciones
func (h *InteraccionesHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.GetAll] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	interacciones, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Interacciones.GetAll] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener las interacciones", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Interacciones.GetAll] Éxito: %d interacciones obtenidas | user_id=%d", len(interacciones), userID)
	json.NewEncoder(w).Encode(interacciones)
}

// GetByPersonaID atiende GET /api/personas/{persona_id}/interacciones
func (h *InteraccionesHandler) GetByPersonaID(w http.ResponseWriter, r *http.Request) {
	personaIDStr := chi.URLParam(r, "persona_id")
	personaID, err := strconv.Atoi(personaIDStr)
	if err != nil || personaID <= 0 {
		log.Printf("[HANDLER:Interacciones.GetByPersonaID] ID de persona inválido: %s", personaIDStr)
		http.Error(w, "ID de persona inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.GetByPersonaID] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	interacciones, err := h.repo.GetByPersonaID(r.Context(), personaID, userID)
	if err != nil {
		log.Printf("[HANDLER:Interacciones.GetByPersonaID] Error en repositorio: %v | persona_id=%d user_id=%d", err, personaID, userID)
		http.Error(w, "Error al obtener las interacciones de la persona", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Interacciones.GetByPersonaID] Éxito: %d interacciones obtenidas | persona_id=%d user_id=%d", len(interacciones), personaID, userID)
	json.NewEncoder(w).Encode(interacciones)
}

// GetByID atiende GET /api/interacciones/{id}
func (h *InteraccionesHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Interacciones.GetByID] ID inválido: %s", idStr)
		http.Error(w, "ID de interacción inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.GetByID] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	interaccion, err := h.repo.GetByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Interacciones.GetByID] No encontrada | id=%d user_id=%d", id, userID)
			http.Error(w, "Interacción no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Interacciones.GetByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al obtener la interacción", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Interacciones.GetByID] Éxito: interacción obtenida | id=%d user_id=%d", interaccion.ID, userID)
	json.NewEncoder(w).Encode(interaccion)
}

// Update atiende PUT /api/interacciones/{id}
func (h *InteraccionesHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.Update] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Interacciones.Update] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID de interacción inválido", http.StatusBadRequest)
		return
	}

	var req models.InteraccionUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Interacciones.Update] JSON inválido: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if req.Interaccion != nil {
		trimmed := strings.TrimSpace(*req.Interaccion)
		if trimmed == "" {
			log.Printf("[HANDLER:Interacciones.Update] Validación fallida: interacción vacía tras trim | id=%d user_id=%d", id, userID)
			http.Error(w, "El texto de la interacción no puede quedar vacío", http.StatusBadRequest)
			return
		}
		req.Interaccion = &trimmed
	}

	interaccion, err := h.repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Interacciones.Update] No encontrada para actualizar | id=%d user_id=%d", id, userID)
			http.Error(w, "Interacción no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Interacciones.Update] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar la interacción", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Interacciones.Update] Éxito: interacción actualizada | id=%d user_id=%d", interaccion.ID, userID)
	json.NewEncoder(w).Encode(interaccion)
}

// Delete atiende DELETE /api/interacciones/{id}
func (h *InteraccionesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Interacciones.Delete] ID inválido: %s", idStr)
		http.Error(w, "ID de interacción inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Interacciones.Delete] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	if err := h.repo.Delete(r.Context(), id, userID); err != nil {
		log.Printf("[HANDLER:Interacciones.Delete] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al eliminar la interacción", http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:Interacciones.Delete] Éxito: interacción eliminada | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}
