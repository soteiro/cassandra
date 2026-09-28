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

type DocumentosProyectoHandler struct {
	Repo *repository.DocumentosProyectoRepository
}

func NewDocumentosProyectoHandler(repo *repository.DocumentosProyectoRepository) *DocumentosProyectoHandler {
	return &DocumentosProyectoHandler{Repo: repo}
}

func (h *DocumentosProyectoHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var req models.CreateDocumentoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	proyectIDStr := chi.URLParam(r, "proyect_id")
	if proyectIDStr == "" {
		proyectIDStr = chi.URLParam(r, "proyecto_id")
	}
	if proyectIDStr != "" {
		if pID, err := strconv.Atoi(proyectIDStr); err == nil && pID > 0 {
			req.ProyectoID = pID
		}
	}

	if req.ProyectoID <= 0 {
		http.Error(w, "El ID del proyecto es obligatorio", http.StatusBadRequest)
		return
	}

	req.Titulo = strings.TrimSpace(req.Titulo)
	if req.Titulo == "" {
		http.Error(w, "El título del documento es obligatorio", http.StatusBadRequest)
		return
	}

	req.Contenido = strings.TrimSpace(req.Contenido)
	req.UserID = userID

	doc, err := h.Repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Documentos.Create] Error: %v", err)
		http.Error(w, "Error al crear documento", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentosProyectoHandler) GetByProyectoID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	proyectIDStr := chi.URLParam(r, "proyect_id")
	if proyectIDStr == "" {
		proyectIDStr = chi.URLParam(r, "proyecto_id")
	}
	proyectID, err := strconv.Atoi(proyectIDStr)
	if err != nil || proyectID <= 0 {
		http.Error(w, "ID de proyecto inválido", http.StatusBadRequest)
		return
	}

	tipoFilter := r.URL.Query().Get("tipo")

	docs, err := h.Repo.GetByProyectoID(r.Context(), proyectID, userID, tipoFilter)
	if err != nil {
		log.Printf("[HANDLER:Documentos.GetByProyectoID] Error: %v", err)
		http.Error(w, "Error al obtener documentos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(docs)
}

func (h *DocumentosProyectoHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de documento inválido", http.StatusBadRequest)
		return
	}

	doc, err := h.Repo.GetByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "Documento no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Documentos.GetByID] Error: %v", err)
		http.Error(w, "Error al obtener documento", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentosProyectoHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de documento inválido", http.StatusBadRequest)
		return
	}

	var req models.UpdateDocumentoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if req.Titulo != nil {
		trimmed := strings.TrimSpace(*req.Titulo)
		if trimmed == "" {
			http.Error(w, "El título no puede quedar vacío", http.StatusBadRequest)
			return
		}
		req.Titulo = &trimmed
	}

	doc, err := h.Repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "Documento no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:Documentos.Update] Error: %v", err)
		http.Error(w, "Error al actualizar documento", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentosProyectoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de documento inválido", http.StatusBadRequest)
		return
	}

	if err := h.Repo.Delete(r.Context(), id, userID); err != nil {
		log.Printf("[HANDLER:Documentos.Delete] Error: %v", err)
		http.Error(w, "Error al eliminar documento", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
