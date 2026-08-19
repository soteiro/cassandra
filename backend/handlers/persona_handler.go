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

type PersonaHandler struct {
	repo *repository.PersonaRepository
}

func NewPersonaHandler(repo *repository.PersonaRepository) *PersonaHandler {
	return &PersonaHandler{repo: repo}
}

// Create atiende POST /api/personas
func (h *PersonaHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Persona.Create] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.PersonaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Persona.Create] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Alias = strings.TrimSpace(req.Alias)
	req.Entorno = strings.TrimSpace(req.Entorno)
	req.Informacion = strings.TrimSpace(req.Informacion)

	if req.Nombre == "" {
		log.Printf("[HANDLER:Persona.Create] Validación fallida: nombre es obligatorio | user_id=%d", userID)
		http.Error(w, "El nombre de la persona es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID

	persona, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Persona.Create] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al crear la persona", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Persona.Create] Éxito: persona creada | id=%d user_id=%d nombre=%q", persona.ID, userID, persona.Nombre)
	json.NewEncoder(w).Encode(persona)
}

// GetAll atiende GET /api/personas
func (h *PersonaHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Persona.GetAll] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	personas, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Persona.GetAll] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener personas", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Persona.GetAll] Éxito: %d personas obtenidas | user_id=%d", len(personas), userID)
	json.NewEncoder(w).Encode(personas)
}

// GetByID atiende GET /api/personas/{id}
func (h *PersonaHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Persona.GetByID] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Persona.GetByID] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	persona, err := h.repo.GetById(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Persona.GetByID] No encontrada | id=%d user_id=%d", id, userID)
			http.Error(w, "Persona no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Persona.GetByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al obtener la persona", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Persona.GetByID] Éxito: persona obtenida | id=%d user_id=%d", persona.ID, userID)
	json.NewEncoder(w).Encode(persona)
}

// Update atiende PUT /api/personas/{id}
func (h *PersonaHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Persona.Update] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Persona.Update] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	var req models.PersonaUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Persona.Update] JSON inválido: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			log.Printf("[HANDLER:Persona.Update] Validación fallida: nombre vacío tras trim | id=%d user_id=%d", id, userID)
			http.Error(w, "El nombre no puede quedar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}
	if req.Alias != nil {
		trimmed := strings.TrimSpace(*req.Alias)
		req.Alias = &trimmed
	}
	if req.Entorno != nil {
		trimmed := strings.TrimSpace(*req.Entorno)
		req.Entorno = &trimmed
	}
	if req.Informacion != nil {
		trimmed := strings.TrimSpace(*req.Informacion)
		req.Informacion = &trimmed
	}

	persona, err := h.repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:Persona.Update] No encontrada para actualizar | id=%d user_id=%d", id, userID)
			http.Error(w, "Persona no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Persona.Update] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar la persona", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Persona.Update] Éxito: persona actualizada | id=%d user_id=%d", persona.ID, userID)
	json.NewEncoder(w).Encode(persona)
}

// Delete atiende DELETE /api/personas/{id}
func (h *PersonaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Persona.Delete] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Persona.Delete] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), id, userID); err != nil {
		log.Printf("[HANDLER:Persona.Delete] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al eliminar la persona", http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:Persona.Delete] Éxito: persona eliminada | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}
