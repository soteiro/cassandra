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
	"github.com/jackc/pgx/v5/pgconn"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type ListaDeseosHandler struct {
	repo *repository.ListaDeseosRepository
}

func NewListaDeseosHandler(repo *repository.ListaDeseosRepository) *ListaDeseosHandler {
	return &ListaDeseosHandler{repo: repo}
}

// Create atiende POST /api/lista-deseos
func (h *ListaDeseosHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:ListaDeseos.Create] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.CreateListaDeseosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:ListaDeseos.Create] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		log.Printf("[HANDLER:ListaDeseos.Create] Validación fallida: nombre vacío | user_id=%d", userID)
		http.Error(w, "El nombre del ítem es obligatorio", http.StatusBadRequest)
		return
	}

	if req.GrupoItemFinanzasID != nil && *req.GrupoItemFinanzasID <= 0 {
		req.GrupoItemFinanzasID = nil
	}

	req.UserID = userID

	item, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			log.Printf("[HANDLER:ListaDeseos.Create] FK inexistente: %v | user_id=%d", err, userID)
			http.Error(w, "El grupo de finanzas especificado (grupo_item_finanzas_id) no existe", http.StatusBadRequest)
			return
		}
		log.Printf("[HANDLER:ListaDeseos.Create] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al guardar el ítem de lista de deseos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:ListaDeseos.Create] Éxito: ítem creado | id=%d user_id=%d", item.ID, userID)
	json.NewEncoder(w).Encode(item)
}

// GetAll atiende GET /api/lista-deseos (con soporte para ?comprado=true/false y ?grupo_id=...)
func (h *ListaDeseosHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:ListaDeseos.GetAll] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var compradoFilter *bool
	if compradoStr := strings.TrimSpace(r.URL.Query().Get("comprado")); compradoStr != "" {
		if val, err := strconv.ParseBool(compradoStr); err == nil {
			compradoFilter = &val
		}
	}

	var grupoIDFilter *int
	if grupoStr := strings.TrimSpace(r.URL.Query().Get("grupo_id")); grupoStr != "" {
		if val, err := strconv.Atoi(grupoStr); err == nil && val > 0 {
			grupoIDFilter = &val
		}
	}

	items, err := h.repo.GetAll(r.Context(), userID, compradoFilter, grupoIDFilter)
	if err != nil {
		log.Printf("[HANDLER:ListaDeseos.GetAll] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener la lista de deseos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:ListaDeseos.GetAll] Éxito: %d ítems obtenidos | user_id=%d", len(items), userID)
	json.NewEncoder(w).Encode(items)
}

// GetByID atiende GET /api/lista-deseos/{id}
func (h *ListaDeseosHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:ListaDeseos.GetByID] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:ListaDeseos.GetByID] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	item, err := h.repo.GetByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:ListaDeseos.GetByID] No encontrado | id=%d user_id=%d", id, userID)
			http.Error(w, "Ítem no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:ListaDeseos.GetByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al obtener el ítem", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:ListaDeseos.GetByID] Éxito: ítem obtenido | id=%d user_id=%d", item.ID, userID)
	json.NewEncoder(w).Encode(item)
}

// Update atiende PUT /api/lista-deseos/{id}
func (h *ListaDeseosHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:ListaDeseos.Update] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:ListaDeseos.Update] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	var req models.UpdateListaDeseosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:ListaDeseos.Update] JSON inválido: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			log.Printf("[HANDLER:ListaDeseos.Update] Validación fallida: nombre vacío | id=%d user_id=%d", id, userID)
			http.Error(w, "El nombre del ítem no puede quedar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}

	if req.GrupoItemFinanzasID != nil && *req.GrupoItemFinanzasID <= 0 {
		req.GrupoItemFinanzasID = nil
	}

	item, err := h.repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:ListaDeseos.Update] No encontrado para actualizar | id=%d user_id=%d", id, userID)
			http.Error(w, "Ítem no encontrado", http.StatusNotFound)
			return
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			log.Printf("[HANDLER:ListaDeseos.Update] FK inexistente: %v | id=%d user_id=%d", err, id, userID)
			http.Error(w, "El grupo de finanzas especificado (grupo_item_finanzas_id) no existe", http.StatusBadRequest)
			return
		}
		log.Printf("[HANDLER:ListaDeseos.Update] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar el ítem", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:ListaDeseos.Update] Éxito: ítem actualizado | id=%d user_id=%d", item.ID, userID)
	json.NewEncoder(w).Encode(item)
}

// Delete atiende DELETE /api/lista-deseos/{id}
func (h *ListaDeseosHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:ListaDeseos.Delete] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:ListaDeseos.Delete] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), id, userID); err != nil {
		log.Printf("[HANDLER:ListaDeseos.Delete] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al eliminar el ítem", http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:ListaDeseos.Delete] Éxito: ítem eliminado | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}
