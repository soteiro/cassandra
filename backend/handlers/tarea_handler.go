package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

// TareasHandler maneja las solicitudes HTTP para las tareas
type TareasHandler struct {
	repo *repository.TareasRepository
}

// NewTareasHandler crea un nuevo TareasHandler
func NewTareasHandler(repo *repository.TareasRepository) *TareasHandler {
	return &TareasHandler{repo: repo}
}

// CreateTarea atiende la ruta POST /api/tareas
func (h *TareasHandler) CreateTarea(w http.ResponseWriter, r *http.Request) {
	var req models.TareaRequest
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front inválido: %v", err)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validación básica
	if req.Nombre == "" {
		http.Error(w, "El nombre de la tarea no puede estar vacío", http.StatusBadRequest)
		return
	}
	if req.ProyectID == 0 {
		http.Error(w, "El ID del proyecto (proyect_id) es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	tarea, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("error al guardar la tarea: %v", err)
		http.Error(w, "error al crear la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tarea)
}

// GetAllTareas maneja la ruta GET /api/tareas (lista todas las tareas del usuario)
func (h *TareasHandler) GetAllTareas(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareas, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("error al obtener las tareas: %v", err)
		http.Error(w, "error al obtener las tareas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if tareas == nil {
		tareas = []models.TareaResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tareas)
}

// GetTareaByID obtiene una única tarea por su ID si le pertenece al usuario
func (h *TareasHandler) GetTareaByID(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil {
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	tarea, err := h.repo.GetByID(r.Context(), tareaID, userID)
	if err != nil {
		http.Error(w, "Tarea no encontrada o acceso denegado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tarea)
}

// UpdateTarea maneja la ruta PUT /api/tareas/{id}
func (h *TareasHandler) UpdateTarea(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil {
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	var req models.TareaUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front inválido: %v", err)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	tarea, err := h.repo.Update(r.Context(), tareaID, userID, &req)
	if err != nil {
		log.Printf("error al actualizar la tarea: %v", err)
		http.Error(w, "error al actualizar la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tarea)
}

// DeleteTarea realiza el borrado lógico de una tarea
func (h *TareasHandler) DeleteTarea(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil {
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	err = h.repo.Delete(r.Context(), tareaID, userID)
	if err != nil {
		log.Printf("error al eliminar la tarea: %v", err)
		http.Error(w, "Error al eliminar la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
