package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type LogsHandler struct {
	repo *repository.LogsRepository
}

func NewLogsHandler(repo *repository.LogsRepository) *LogsHandler {
	return &LogsHandler{repo: repo}
}

// Crear un log para un proyecto POST /api/proyects/{proyect_id}/logs o POST /api/logs
func (h *LogsHandler) CreateLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("intento de crear log sin auth")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.CreateProjectLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("json de log invalido: %v", err)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// Si proyect_id viene en la URL, sobrescribir o asignar
	proyectIDStr := chi.URLParam(r, "proyect_id")
	if proyectIDStr != "" {
		pID, err := strconv.Atoi(proyectIDStr)
		if err == nil && pID > 0 {
			req.ProyectoID = pID
		}
	}

	req.Titulo = strings.TrimSpace(req.Titulo)

	if req.ProyectoID <= 0 {
		http.Error(w, "proyecto_id es obligatorio", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.ContenidoRaw) == "" {
		http.Error(w, "el contenido en crudo (contenido_raw) no puede estar vacío", http.StatusBadRequest)
		return
	}

	createdLog, err := h.repo.Create(r.Context(), userID, &req)
	if err != nil {
		log.Printf("error al guardar log: %v", err)
		http.Error(w, "error al crear el log", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdLog)
}

// Listar todos los logs de un proyecto GET /api/proyects/{proyect_id}/logs
func (h *LogsHandler) GetLogsByProyecto(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	proyectIDStr := chi.URLParam(r, "proyect_id")
	proyectID, err := strconv.Atoi(proyectIDStr)
	if err != nil || proyectID <= 0 {
		http.Error(w, "proyect_id invalido", http.StatusBadRequest)
		return
	}

	logsList, err := h.repo.GetByProyectoID(r.Context(), userID, proyectID)
	if err != nil {
		log.Printf("error al listar logs: %v", err)
		http.Error(w, "error al obtener logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logsList)
}

// Obtener un log por ID GET /api/logs/{id}
func (h *LogsHandler) GetLogByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	logEntry, err := h.repo.GetByID(r.Context(), userID, id)
	if err != nil {
		log.Printf("error al obtener log por id %d: %v", id, err)
		http.Error(w, "log no encontrado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logEntry)
}

// Actualizar un log PUT /api/logs/{id}
func (h *LogsHandler) UpdateLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	var req models.UpdateProjectLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	if req.Titulo != nil {
		trimmed := strings.TrimSpace(*req.Titulo)
		req.Titulo = &trimmed
	}

	updatedLog, err := h.repo.Update(r.Context(), userID, id, &req)
	if err != nil {
		log.Printf("error al actualizar log: %v", err)
		http.Error(w, "error al actualizar el log", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedLog)
}

// Eliminar un log (soft delete) DELETE /api/logs/{id}
func (h *LogsHandler) DeleteLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), userID, id); err != nil {
		log.Printf("error al borrar log: %v", err)
		http.Error(w, "error al eliminar el log", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
