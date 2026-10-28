package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strconv"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

type APIKeysHandler struct{ repo *repository.APIKeyRepository }

func NewAPIKeysHandler(repo *repository.APIKeyRepository) *APIKeysHandler {
	return &APIKeysHandler{repo: repo}
}

func integrationJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}

func integrationBody(w http.ResponseWriter, r *http.Request, dest any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			http.Error(w, "Cuerpo demasiado grande", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "JSON inválido o campos desconocidos", http.StatusBadRequest)
		}
		return false
	}
	if err := dec.Decode(new(any)); !errors.Is(err, io.EOF) {
		http.Error(w, "Se requiere un único objeto JSON", http.StatusBadRequest)
		return false
	}
	return true
}

func integrationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, models.ErrMemoryInvalid):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, models.ErrMemoryConflict):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		dbError(w, "No se pudo completar la operación de memoria", err)
	}
}

func (h *APIKeysHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	var req models.CreateAPIKeyRequest
	if !integrationBody(w, r, &req) {
		return
	}
	key, err := h.repo.Create(r.Context(), userID, req)
	if err != nil {
		integrationError(w, err)
		return
	}
	integrationJSON(w, http.StatusCreated, key)
}

func (h *APIKeysHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	keys, err := h.repo.List(r.Context(), userID)
	if err != nil {
		integrationError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, keys)
}

func (h *APIKeysHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "key_id"), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "ID de key inválido", http.StatusBadRequest)
		return
	}
	if err := h.repo.Revoke(r.Context(), userID, id); err != nil {
		integrationError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type ProjectMemoryHandler struct {
	repo *repository.ProjectMemoryRepository
}

func NewProjectMemoryHandler(repo *repository.ProjectMemoryRepository) *ProjectMemoryHandler {
	return &ProjectMemoryHandler{repo: repo}
}

func integrationProject(w http.ResponseWriter, r *http.Request, scope string) (int, int, bool) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return 0, 0, false
	}
	projectID, err := atoi32(chi.URLParam(r, "project_id"))
	if err != nil || projectID <= 0 {
		http.Error(w, "ID de proyecto inválido", http.StatusBadRequest)
		return 0, 0, false
	}
	if a := middleware.GetAPIKeyAccess(r.Context()); a != nil {
		if !slices.Contains(a.ProyectoIDs, projectID) {
			http.Error(w, "Recurso no encontrado", http.StatusNotFound)
			return 0, 0, false
		}
		if !slices.Contains(a.Scopes, scope) {
			http.Error(w, "La key no tiene permiso para esta operación", http.StatusForbidden)
			return 0, 0, false
		}
	}
	return userID, projectID, true
}

func (h *ProjectMemoryHandler) Context(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.MemoryRead)
	if !ok {
		return
	}
	value, err := h.repo.Context(r.Context(), userID, projectID)
	if err != nil {
		integrationError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, value)
}

func (h *ProjectMemoryHandler) Search(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.MemoryRead)
	if !ok {
		return
	}
	limit, offset := 10, 0
	var err error
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil {
			http.Error(w, "Límite inválido", http.StatusBadRequest)
			return
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.Atoi(raw)
		if err != nil {
			http.Error(w, "Desplazamiento inválido", http.StatusBadRequest)
			return
		}
	}
	history := false
	if raw := r.URL.Query().Get("historico"); raw != "" {
		history, err = strconv.ParseBool(raw)
		if err != nil {
			http.Error(w, "Filtro inválido", http.StatusBadRequest)
			return
		}
	}
	value, err := h.repo.Search(r.Context(), userID, projectID, r.URL.Query().Get("q"), history, limit, offset)
	if err != nil {
		integrationError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, value)
}

func (h *ProjectMemoryHandler) Write(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.MemoryWrite)
	if !ok {
		return
	}
	var req models.MemoryWriteRequest
	if !integrationBody(w, r, &req) {
		return
	}
	var keyID int64
	if a := middleware.GetAPIKeyAccess(r.Context()); a != nil {
		keyID = a.APIKeyID
	}
	value, err := h.repo.Write(r.Context(), userID, projectID, keyID, req)
	if err != nil {
		integrationError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, value)
}
