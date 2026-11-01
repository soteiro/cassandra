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
	repo  *repository.LogsRepository
	owner *repository.Ownership
}

func NewLogsHandler(repo *repository.LogsRepository, owner *repository.Ownership) *LogsHandler {
	return &LogsHandler{repo: repo, owner: owner}
}

// Crear un log para un proyecto POST /api/proyects/{proyect_id}/logs o POST /api/logs
func (h *LogsHandler) CreateLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Logs.CreateLog] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.CreateProjectLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Logs.CreateLog] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// Si proyect_id viene en la URL, sobrescribir o asignar
	projectIDStr := chi.URLParam(r, "proyect_id")
	if projectIDStr != "" {
		pID, err := atoi32(projectIDStr)
		if err == nil && pID > 0 {
			req.ProyectoID = pID
		}
	}

	req.Titulo = strings.TrimSpace(req.Titulo)

	if req.ProyectoID <= 0 {
		log.Printf("[HANDLER:Logs.CreateLog] Validación fallida: proyecto_id es obligatorio | user_id=%d", userID)
		http.Error(w, "proyecto_id es obligatorio", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.ContenidoRaw) == "" {
		log.Printf("[HANDLER:Logs.CreateLog] Validación fallida: contenido_raw vacío | user_id=%d proyecto_id=%d", userID, req.ProyectoID)
		http.Error(w, "el contenido en crudo (contenido_raw) no puede estar vacío", http.StatusBadRequest)
		return
	}

	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.Proyecto, ID: req.ProyectoID}) {
		return
	}

	createdLog, err := h.repo.Create(r.Context(), userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Logs.CreateLog] Error en repositorio: %v | user_id=%d proyecto_id=%d", err, userID, req.ProyectoID)
		dbError(w, "error al crear el log", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Logs.CreateLog] Éxito: log creado | id=%d proyecto_id=%d user_id=%d", createdLog.ID, createdLog.ProyectoID, userID)
	json.NewEncoder(w).Encode(createdLog)
}

// Listar todos los logs de un proyecto GET /api/proyects/{proyect_id}/logs
func (h *LogsHandler) GetLogsByProyecto(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Logs.GetLogsByProyecto] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	projectIDStr := chi.URLParam(r, "proyect_id")
	projectID, err := atoi32(projectIDStr)
	if err != nil || projectID <= 0 {
		log.Printf("[HANDLER:Logs.GetLogsByProyecto] ID de proyecto inválido: %s", projectIDStr)
		http.Error(w, "proyect_id invalido", http.StatusBadRequest)
		return
	}

	limit, offset := 0, 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			http.Error(w, "limit debe estar entre 1 y 100", http.StatusBadRequest)
			return
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.Atoi(raw)
		if err != nil || offset < 0 || offset > 10000 {
			http.Error(w, "offset inválido", http.StatusBadRequest)
			return
		}
	}
	search := r.URL.Query().Get("q")
	if len(search) > 300 {
		http.Error(w, "Búsqueda demasiado larga", http.StatusBadRequest)
		return
	}
	logsList, err := h.repo.SearchByProyectoID(r.Context(), userID, projectID, search, limit, offset)
	if err != nil {
		log.Printf("[HANDLER:Logs.GetLogsByProyecto] Error en repositorio: %v | proyecto_id=%d user_id=%d", err, projectID, userID)
		dbError(w, "error al obtener logs", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Logs.GetLogsByProyecto] Éxito: %d logs obtenidos | proyecto_id=%d user_id=%d", len(logsList), projectID, userID)
	json.NewEncoder(w).Encode(logsList)
}

// Obtener un log por ID GET /api/logs/{id}
func (h *LogsHandler) GetLogByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Logs.GetLogByID] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := atoi32(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Logs.GetLogByID] ID inválido: %s", idStr)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	logEntry, err := h.repo.GetByID(r.Context(), userID, id)
	if err != nil {
		log.Printf("[HANDLER:Logs.GetLogByID] Error o no encontrado: %v | id=%d user_id=%d", err, id, userID)
		dbError(w, "log no encontrado", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Logs.GetLogByID] Éxito: log obtenido | id=%d user_id=%d", logEntry.ID, userID)
	json.NewEncoder(w).Encode(logEntry)
}

// Actualizar un log PUT /api/logs/{id}
func (h *LogsHandler) UpdateLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Logs.UpdateLog] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := atoi32(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Logs.UpdateLog] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	var req models.UpdateProjectLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Logs.UpdateLog] JSON inválido: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	if req.Titulo != nil {
		trimmed := strings.TrimSpace(*req.Titulo)
		req.Titulo = &trimmed
	}
	// Igual que al crear: si se envía contenido, no puede quedar vacío.
	if req.ContenidoRaw != nil && strings.TrimSpace(*req.ContenidoRaw) == "" {
		http.Error(w, "El contenido del log no puede estar vacío", http.StatusBadRequest)
		return
	}

	updatedLog, err := h.repo.Update(r.Context(), userID, id, &req)
	if err != nil {
		log.Printf("[HANDLER:Logs.UpdateLog] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		dbError(w, "error al actualizar el log", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Logs.UpdateLog] Éxito: log actualizado | id=%d user_id=%d", updatedLog.ID, userID)
	json.NewEncoder(w).Encode(updatedLog)
}

// Eliminar un log (soft delete) DELETE /api/logs/{id}
func (h *LogsHandler) DeleteLog(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Logs.DeleteLog] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := atoi32(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Logs.DeleteLog] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), userID, id); err != nil {
		log.Printf("[HANDLER:Logs.DeleteLog] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		dbError(w, "error al eliminar el log", err)
		return
	}

	log.Printf("[HANDLER:Logs.DeleteLog] Éxito: log eliminado | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}
