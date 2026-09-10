package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

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
		log.Printf("[HANDLER:Tareas.CreateTarea] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Tareas.CreateTarea] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Limpiar espacios con TrimSpace
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Descripcion = strings.TrimSpace(req.Descripcion)
	req.Comentario = strings.TrimSpace(req.Comentario)

	// Validación básica
	if req.Nombre == "" {
		log.Printf("[HANDLER:Tareas.CreateTarea] Validación fallida: nombre de tarea vacío | user_id=%d", userID)
		http.Error(w, "El nombre de la tarea no puede estar vacío", http.StatusBadRequest)
		return
	}
	if req.ProyectID == 0 {
		log.Printf("[HANDLER:Tareas.CreateTarea] Validación fallida: proyect_id es obligatorio | user_id=%d", userID)
		http.Error(w, "El ID del proyecto (proyect_id) es obligatorio", http.StatusBadRequest)
		return
	}

	// Validación de prioridad (baja, normal, alta, urgente)
	if req.Prioridad != nil {
		p := strings.ToLower(strings.TrimSpace(*req.Prioridad))
		if p != "" {
			switch p {
			case "baja", "normal", "alta", "urgente":
				req.Prioridad = &p
			default:
				log.Printf("[HANDLER:Tareas.CreateTarea] Prioridad inválida: %q | user_id=%d", *req.Prioridad, userID)
				http.Error(w, "Prioridad inválida. Debe ser: baja, normal, alta o urgente", http.StatusBadRequest)
				return
			}
		} else {
			defaultPrioridad := "normal"
			req.Prioridad = &defaultPrioridad
		}
	} else {
		defaultPrioridad := "normal"
		req.Prioridad = &defaultPrioridad
	}

	req.UserID = userID
	tarea, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Tareas.CreateTarea] Error en repositorio: %v | user_id=%d proyect_id=%d", err, userID, req.ProyectID)
		http.Error(w, "error al crear la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Tareas.CreateTarea] Éxito: tarea creada | id=%d user_id=%d proyect_id=%d", tarea.ID, userID, req.ProyectID)
	json.NewEncoder(w).Encode(tarea)
}

// GetAllTareas maneja la ruta GET /api/tareas (lista tareas con filtro opcional por ?estado=...)
func (h *TareasHandler) GetAllTareas(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Tareas.GetAllTareas] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	estadoFilter := strings.TrimSpace(r.URL.Query().Get("estado"))

	tareas, err := h.repo.GetAll(r.Context(), userID, estadoFilter)
	if err != nil {
		log.Printf("[HANDLER:Tareas.GetAllTareas] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "error al obtener las tareas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if tareas == nil {
		tareas = []models.TareaResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Tareas.GetAllTareas] Éxito: %d tareas obtenidas | user_id=%d estado=%q", len(tareas), userID, estadoFilter)
	json.NewEncoder(w).Encode(tareas)
}

// GetTareaByID obtiene una única tarea por su ID si le pertenece al usuario
func (h *TareasHandler) GetTareaByID(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Tareas.GetTareaByID] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil || tareaID <= 0 {
		log.Printf("[HANDLER:Tareas.GetTareaByID] ID inválido: %s", tareaIDStr)
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	tarea, err := h.repo.GetByID(r.Context(), tareaID, userID)
	if err != nil {
		log.Printf("[HANDLER:Tareas.GetTareaByID] Error o no encontrada: %v | id=%d user_id=%d", err, tareaID, userID)
		http.Error(w, "Tarea no encontrada o acceso denegado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Tareas.GetTareaByID] Éxito: tarea obtenida | id=%d user_id=%d", tarea.ID, userID)
	json.NewEncoder(w).Encode(tarea)
}

// UpdateTarea maneja la ruta PUT /api/tareas/{id}
func (h *TareasHandler) UpdateTarea(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Tareas.UpdateTarea] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil || tareaID <= 0 {
		log.Printf("[HANDLER:Tareas.UpdateTarea] ID inválido: %s", tareaIDStr)
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	var req models.TareaUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Tareas.UpdateTarea] JSON inválido: %v | id=%d user_id=%d", err, tareaID, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Limpiar espacios en campos de actualización opcionales (punteros)
	if req.Nombre != nil {
		*req.Nombre = strings.TrimSpace(*req.Nombre)
		if *req.Nombre == "" {
			log.Printf("[HANDLER:Tareas.UpdateTarea] Validación fallida: nombre vacío tras trim | id=%d user_id=%d", tareaID, userID)
			http.Error(w, "El nombre de la tarea no puede quedar vacío tras eliminar espacios", http.StatusBadRequest)
			return
		}
	}
	if req.Descripcion != nil {
		*req.Descripcion = strings.TrimSpace(*req.Descripcion)
	}
	if req.Comentario != nil {
		*req.Comentario = strings.TrimSpace(*req.Comentario)
	}
	if req.Estado != nil {
		*req.Estado = strings.TrimSpace(*req.Estado)
	}
	if req.Prioridad != nil {
		p := strings.ToLower(strings.TrimSpace(*req.Prioridad))
		switch p {
		case "baja", "normal", "alta", "urgente":
			req.Prioridad = &p
		default:
			log.Printf("[HANDLER:Tareas.UpdateTarea] Prioridad inválida: %q | id=%d user_id=%d", *req.Prioridad, tareaID, userID)
			http.Error(w, "Prioridad inválida. Debe ser: baja, normal, alta o urgente", http.StatusBadRequest)
			return
		}
	}

	tarea, err := h.repo.Update(r.Context(), tareaID, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Tareas.UpdateTarea] Error en repositorio: %v | id=%d user_id=%d", err, tareaID, userID)
		http.Error(w, "error al actualizar la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Tareas.UpdateTarea] Éxito: tarea actualizada | id=%d user_id=%d", tarea.ID, userID)
	json.NewEncoder(w).Encode(tarea)
}

// DeleteTarea realiza el borrado lógico de una tarea
func (h *TareasHandler) DeleteTarea(w http.ResponseWriter, r *http.Request) {
	tareaIDStr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Tareas.DeleteTarea] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	tareaID, err := strconv.Atoi(tareaIDStr)
	if err != nil || tareaID <= 0 {
		log.Printf("[HANDLER:Tareas.DeleteTarea] ID inválido: %s", tareaIDStr)
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return
	}

	err = h.repo.Delete(r.Context(), tareaID, userID)
	if err != nil {
		log.Printf("[HANDLER:Tareas.DeleteTarea] Error en repositorio: %v | id=%d user_id=%d", err, tareaID, userID)
		http.Error(w, "Error al eliminar la tarea: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:Tareas.DeleteTarea] Éxito: tarea eliminada | id=%d user_id=%d", tareaID, userID)
	w.WriteHeader(http.StatusNoContent)
}

// GetTareasByProyecto obtiene todas las tareas pertenecientes a un proyecto específico del usuario
func (h *TareasHandler) GetTareasByProyecto(w http.ResponseWriter, r *http.Request) {
	proyectIDStr := chi.URLParam(r, "proyect_id")
	if proyectIDStr == "" {
		proyectIDStr = chi.URLParam(r, "proyecto_id")
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Tareas.GetTareasByProyecto] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	proyectID, err := strconv.Atoi(proyectIDStr)
	if err != nil || proyectID <= 0 {
		log.Printf("[HANDLER:Tareas.GetTareasByProyecto] ID de proyecto inválido: %s", proyectIDStr)
		http.Error(w, "ID de proyecto inválido", http.StatusBadRequest)
		return
	}

	tareas, err := h.repo.GetByProyectoID(r.Context(), proyectID, userID)
	if err != nil {
		log.Printf("[HANDLER:Tareas.GetTareasByProyecto] Error en repositorio: %v | proyecto_id=%d user_id=%d", err, proyectID, userID)
		http.Error(w, "Error al obtener tareas del proyecto: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if tareas == nil {
		tareas = []models.TareaResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Tareas.GetTareasByProyecto] Éxito: %d tareas obtenidas | proyecto_id=%d user_id=%d", len(tareas), proyectID, userID)
	json.NewEncoder(w).Encode(tareas)
}


