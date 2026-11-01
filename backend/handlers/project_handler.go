package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type ProjectHandler struct {
	repo *repository.ProjectRepository
	owner *repository.Ownership
}

// constructor para inyectar el repo
func NewProjectHandler(repo *repository.ProjectRepository, owner *repository.Ownership) *ProjectHandler {
	return &ProjectHandler{repo: repo, owner: owner}
}

// crear proyecto
func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req models.ProjectRequest

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
	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.Proyecto, ID: idOf(req.ProyectoPadreID)}) {
		return
	}

	project, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		if isUniqueViolation(err) {
			http.Error(w, "Ya tienes un proyecto con ese nombre", http.StatusConflict)
			return
		}
		log.Printf("[HANDLER:Proyect.CreateProyect] Error en repositorio: %v | user_id=%d", err, userID)
		dbError(w, "error al crear el proyecto", err)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:Proyect.CreateProyect] Éxito: proyecto creado | id=%d user_id=%d nombre=%q", project.ID, userID, project.Nombre)
	json.NewEncoder(w).Encode(&project)
}

// listat con getall
func (h *ProjectHandler) ListProject(w http.ResponseWriter, r *http.Request) {
	// verificar que el usuario sea dueño de sus datos
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.ListProyect] Acceso no autorizado")
		http.Error(w, "acceso denegado", http.StatusUnauthorized)
		return
	}

	project, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.ListProyect] Error en repositorio: %v | user_id=%d", err, userID)
		dbError(w, "error al listar usuario", err)
		return
	}
	if project == nil {
		project = []models.ProjectResponse{}
	}
	w.Header().Set("Content-type", "application/json")
	log.Printf("[HANDLER:Proyect.ListProyect] Éxito: %d proyectos obtenidos | user_id=%d", len(project), userID)
	json.NewEncoder(w).Encode(&project)
}

// eliminar proyecto por id, soft
func (h *ProjectHandler) DeleteByID(w http.ResponseWriter, r *http.Request) {
	idstr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.DeleteByID] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := atoi32(idstr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:Proyect.DeleteByID] ID inválido: %s | user_id=%d", idstr, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	res, err := h.repo.Delete(r.Context(), id, userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.DeleteByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		dbError(w, "error al borrar el proyecto", err)
		return
	}
	if res == nil {
		log.Printf("[HANDLER:Proyect.DeleteByID] Éxito: proyecto eliminado | id=%d user_id=%d", id, userID)
		w.WriteHeader(http.StatusNoContent)
		return
	}
}

func (h *ProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.GetByID] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	strProjectID, err := atoi32(projectID)
	if err != nil || strProjectID <= 0 {
		log.Printf("[HANDLER:Proyect.GetByID] ID inválido: %s | user_id=%d", projectID, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	res, err := h.repo.GetById(r.Context(), strProjectID, userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.GetByID] Error o no encontrado: %v | id=%d user_id=%d", err, strProjectID, userID)
		dbError(w, "Error al obtener el proyecto", err)
		return
	}

	w.Header().Set("Content-type", "application/json")
	log.Printf("[HANDLER:Proyect.GetByID] Éxito: proyecto obtenido | id=%d user_id=%d", res.ID, userID)
	json.NewEncoder(w).Encode(res)
}

// listar subproyectos de un proyecto padre
func (h *ProjectHandler) GetSubproyectos(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.GetSubproyectos] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	strProjectID, err := atoi32(projectID)
	if err != nil || strProjectID <= 0 {
		log.Printf("[HANDLER:Proyect.GetSubproyectos] ID inválido: %s | user_id=%d", projectID, userID)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	subproyectos, err := h.repo.GetSubproyectos(r.Context(), strProjectID, userID)
	if err != nil {
		log.Printf("[HANDLER:Proyect.GetSubproyectos] Error en repositorio: %v | parent_id=%d user_id=%d", err, strProjectID, userID)
		dbError(w, "error al obtener subproyectos", err)
		return
	}
	if subproyectos == nil {
		subproyectos = []models.ProjectResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Proyect.GetSubproyectos] Éxito: %d subproyectos obtenidos | parent_id=%d user_id=%d", len(subproyectos), strProjectID, userID)
	json.NewEncoder(w).Encode(subproyectos)
}

// update
func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:Proyect.Update] Acceso no autorizado")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	strProjectId, err := atoi32(projectID)
	if err != nil || strProjectId <= 0 {
		log.Printf("[HANDLER:Proyect.Update] ID inválido: %s | user_id=%d", projectID, userID)
		http.Error(w, "ID de proyecto invalido", http.StatusBadRequest)
		return
	}

	// decodificar el json
	var req models.ProjectUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Proyect.Update] JSON inválido: %v | id=%d user_id=%d", err, strProjectId, userID)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// Limpiar espacios en campos de actualización opcionales (punteros)
	if req.Nombre != nil {
		*req.Nombre = strings.TrimSpace(*req.Nombre)
		if *req.Nombre == "" {
			log.Printf("[HANDLER:Proyect.Update] Validación fallida: nombre vacío tras trim | id=%d user_id=%d", strProjectId, userID)
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

	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.Proyecto, ID: idOf(req.ProyectoPadreID)}) {
		return
	}

	project, err := h.repo.Update(r.Context(), strProjectId, userID, &req)
	if err != nil {
		if isUniqueViolation(err) {
			http.Error(w, "Ya tienes un proyecto con ese nombre", http.StatusConflict)
			return
		}
		log.Printf("[HANDLER:Proyect.Update] Error en repositorio: %v | id=%d user_id=%d", err, strProjectId, userID)
		dbError(w, "error al modificar el proyecto", err)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:Proyect.Update] Éxito: proyecto actualizado | id=%d user_id=%d", project.ID, userID)
	json.NewEncoder(w).Encode(project)
}