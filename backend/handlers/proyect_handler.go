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

type ProyectHandler struct {
	repo *repository.ProyectRepository
}

// constructor para inyectar el repo
func NewProyectHandler(repo *repository.ProyectRepository) *ProyectHandler {
	return &ProyectHandler{repo: repo}
}

// crear proyecto
func (h *ProyectHandler) CreateProyect(w http.ResponseWriter, r *http.Request) {
	var req models.ProyectRequest

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.CreateProyect] Acceso no autorizado")
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Proyect.CreateProyect] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "Json invalido: ", http.StatusBadRequest)
		return
	}

	// Limpiar espacios con TrimSpace
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Descripcion = strings.TrimSpace(req.Descripcion)
	req.Comentario = strings.TrimSpace(req.Comentario)
	req.PorQue = strings.TrimSpace(req.PorQue)
	req.ParaQue = strings.TrimSpace(req.ParaQue)
	req.CriterioFinalizacion = strings.TrimSpace(req.CriterioFinalizacion)
	req.Prioridad = strings.TrimSpace(req.Prioridad)

	// validacion basica
	if req.Nombre == "" {
		log.Printf("[HANDLER:Proyect.CreateProyect] Validación fallida: nombre vacío | user_id=%d", userID)
		http.Error(w, "El nombre del proyecto no puede estar vacio", http.StatusBadRequest)
		return
	}
	if req.PorQue == "" {
		log.Printf("[HANDLER:Proyect.CreateProyect] Validación fallida: por_que vacío | user_id=%d", userID)
		http.Error(w, "El campo 'por_que' (justificación) es obligatorio para crear un proyecto", http.StatusBadRequest)
		return
	}
	if req.ParaQue == "" {
		log.Printf("[HANDLER:Proyect.CreateProyect] Validación fallida: para_que vacío | user_id=%d", userID)
		http.Error(w, "El campo 'para_que' (objetivo) es obligatorio para crear un proyecto", http.StatusBadRequest)
		return
	}
	if req.CriterioFinalizacion == "" {
		log.Printf("[HANDLER:Proyect.CreateProyect] Validación fallida: criterio_finalizacion vacío | user_id=%d", userID)
		http.Error(w, "El campo 'criterio_finalizacion' es obligatorio para crear un proyecto", http.StatusBadRequest)
		return
	}

	// inyectar el user_id desde el contexto
	req.UserID = userID

	// guardar datos 
	proyect, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Proyect.CreateProyect] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "error al crear el proyecto: ", http.StatusInternalServerError)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Proyect.CreateProyect] Éxito: proyecto creado | id=%d user_id=%d nombre=%q", proyect.ID, userID, proyect.Nombre)
	json.NewEncoder(w).Encode(&proyect)
}

// listat con getall
func (h *ProyectHandler) ListProyect(w http.ResponseWriter, r *http.Request) {
	// verificar que el usuario sea dueño de sus datos
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.ListProyect] Acceso no autorizado")
		http.Error(w, "acceso denegado", http.StatusUnauthorized)
		return
	}

	proyect, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.ListProyect] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "error al listar usuario", http.StatusInternalServerError)
		return
	}
	if proyect == nil {
		proyect = []models.ProyectResponse{}
	}
	w.Header().Set("Content-type", "application/json")
	log.Printf("[HANDLER:Proyect.ListProyect] Éxito: %d proyectos obtenidos | user_id=%d", len(proyect), userID)
	json.NewEncoder(w).Encode(&proyect)
}

// eliminar proyecto por id, soft
func (h *ProyectHandler) DeleteByID(w http.ResponseWriter, r *http.Request) {
	idstr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.DeleteByID] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(idstr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Proyect.DeleteByID] ID inválido: %s | user_id=%d", idstr, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	res, err := h.repo.Delete(r.Context(), id, userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.DeleteByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "error al borrar el proyecto", http.StatusInternalServerError)
		return
	}
	if res == nil {
		log.Printf("[HANDLER:Proyect.DeleteByID] Éxito: proyecto eliminado | id=%d user_id=%d", id, userID)
		w.WriteHeader(http.StatusNoContent)
		return
	}
}

func (h *ProyectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	proyectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.GetByID] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	strProyectID, err := strconv.Atoi(proyectID)
	if err != nil || strProyectID <= 0 {
		log.Printf("[HANDLER:Proyect.GetByID] ID inválido: %s | user_id=%d", proyectID, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	res, err := h.repo.GetById(r.Context(), strProyectID, userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.GetByID] Error o no encontrado: %v | id=%d user_id=%d", err, strProyectID, userID)
		http.Error(w, "error en la peticion", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-type", "application/json")
	log.Printf("[HANDLER:Proyect.GetByID] Éxito: proyecto obtenido | id=%d user_id=%d", res.ID, userID)
	json.NewEncoder(w).Encode(res)
}

// update
func (h *ProyectHandler) Update(w http.ResponseWriter, r *http.Request) {
	proyectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.Update] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	strProyectId, err := strconv.Atoi(proyectID)
	if err != nil || strProyectId <= 0 {
		log.Printf("[HANDLER:Proyect.Update] ID inválido: %s | user_id=%d", proyectID, userID)
		http.Error(w, "ID de proyecto invalido", http.StatusBadRequest)
		return
	}

	// decodificar el json
	var req models.ProyectUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Proyect.Update] JSON inválido: %v | id=%d user_id=%d", err, strProyectId, userID)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// Limpiar espacios en campos de actualización opcionales (punteros)
	if req.Nombre != nil {
		*req.Nombre = strings.TrimSpace(*req.Nombre)
		if *req.Nombre == "" {
			log.Printf("[HANDLER:Proyect.Update] Validación fallida: nombre vacío tras trim | id=%d user_id=%d", strProyectId, userID)
			http.Error(w, "El nombre no puede quedar vacío tras eliminar espacios", http.StatusBadRequest)
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
	if req.PorQue != nil {
		*req.PorQue = strings.TrimSpace(*req.PorQue)
	}
	if req.ParaQue != nil {
		*req.ParaQue = strings.TrimSpace(*req.ParaQue)
	}
	if req.CriterioFinalizacion != nil {
		*req.CriterioFinalizacion = strings.TrimSpace(*req.CriterioFinalizacion)
	}
	if req.Prioridad != nil {
		*req.Prioridad = strings.TrimSpace(*req.Prioridad)
	}

	proyect, err := h.repo.Update(r.Context(), strProyectId, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Proyect.Update] Error en repositorio: %v | id=%d user_id=%d", err, strProyectId, userID)
		http.Error(w, "error al modificar el proyecto", http.StatusInternalServerError)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Proyect.Update] Éxito: proyecto actualizado | id=%d user_id=%d", proyect.ID, userID)
	json.NewEncoder(w).Encode(proyect)
}