package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

const (
	maxNotaRevision    = 10000 // caracteres
	maxResumenRevision = 4096  // bytes de JSON
)

// RevisionHandler atiende la revisión semanal y las preferencias del usuario.
type RevisionHandler struct {
	repo *repository.RevisionRepository
}

func NewRevisionHandler(repo *repository.RevisionRepository) *RevisionHandler {
	return &RevisionHandler{repo: repo}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Estancadas atiende GET /api/revision/estancadas?dias=14.
func (h *RevisionHandler) Estancadas(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	dias := 14
	if d := r.URL.Query().Get("dias"); d != "" {
		n, err := atoi32(d)
		if err != nil || n < 1 || n > 365 {
			http.Error(w, "dias inválido (1-365)", http.StatusBadRequest)
			return
		}
		dias = n
	}
	tareas, err := h.repo.Estancadas(r.Context(), userID, dias)
	if err != nil {
		dbError(w, "Error al obtener las tareas estancadas", err)
		return
	}
	writeJSON(w, http.StatusOK, tareas)
}

// List atiende GET /api/revisiones?limit=10.
func (h *RevisionHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		n, err := atoi32(l)
		if err != nil || n < 1 || n > 100 {
			http.Error(w, "limit inválido (1-100)", http.StatusBadRequest)
			return
		}
		limit = n
	}
	revs, err := h.repo.List(r.Context(), userID, limit)
	if err != nil {
		dbError(w, "Error al obtener las revisiones", err)
		return
	}
	writeJSON(w, http.StatusOK, revs)
}

// Create atiende POST /api/revisiones.
func (h *RevisionHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	var req models.RevisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	req.Nota = strings.TrimSpace(req.Nota)
	if utf8.RuneCountInString(req.Nota) > maxNotaRevision {
		http.Error(w, "La nota es demasiado larga", http.StatusBadRequest)
		return
	}
	if len(req.Resumen) == 0 || bytes.Equal(bytes.TrimSpace(req.Resumen), []byte("null")) {
		req.Resumen = json.RawMessage("{}")
	}
	var obj map[string]any
	if len(req.Resumen) > maxResumenRevision || json.Unmarshal(req.Resumen, &obj) != nil {
		http.Error(w, "resumen debe ser un objeto JSON de hasta 4 KB", http.StatusBadRequest)
		return
	}
	rev, err := h.repo.Create(r.Context(), userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Revision.Create] Error en repositorio: %v | user_id=%d", err, userID)
		dbError(w, "Error al guardar la revisión", err)
		return
	}
	writeJSON(w, http.StatusCreated, rev)
}

// Preferencias atiende GET /api/preferencias.
func (h *RevisionHandler) Preferencias(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	p, err := h.repo.Preferencias(r.Context(), userID)
	if err != nil {
		dbError(w, "Error al obtener las preferencias", err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// UpdatePreferencias atiende PUT /api/preferencias.
func (h *RevisionHandler) UpdatePreferencias(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}
	var req models.PreferenciasUpdate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if req.DiaRevision != nil && (*req.DiaRevision < 0 || *req.DiaRevision > 6) {
		http.Error(w, "dia_revision inválido (0 = domingo … 6 = sábado)", http.StatusBadRequest)
		return
	}
	if req.LimiteEnCurso != nil && (*req.LimiteEnCurso < 1 || *req.LimiteEnCurso > 50) {
		http.Error(w, "limite_en_curso inválido (1-50)", http.StatusBadRequest)
		return
	}
	p, err := h.repo.UpdatePreferencias(r.Context(), userID, &req)
	if err != nil {
		dbError(w, "Error al guardar las preferencias", err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}
