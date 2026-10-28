package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

type IntegrationTasksHandler struct {
	repo *repository.IntegrationTasksRepository
}

func NewIntegrationTasksHandler(repo *repository.IntegrationTasksRepository) *IntegrationTasksHandler {
	return &IntegrationTasksHandler{repo: repo}
}

func integrationTaskError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, models.ErrTaskInvalid):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, models.ErrTaskOperationConflict):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		dbError(w, "No se pudo completar la operación de tareas", err)
	}
}

func (h *IntegrationTasksHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.TasksCreate)
	if !ok {
		return
	}
	var req models.CreateIntegrationTaskRequest
	if !integrationBody(w, r, &req) {
		return
	}
	var keyID int64
	if access := middleware.GetAPIKeyAccess(r.Context()); access != nil {
		keyID = access.APIKeyID
	}
	task, err := h.repo.Create(r.Context(), userID, projectID, keyID, req)
	if err != nil {
		integrationTaskError(w, err)
		return
	}
	integrationJSON(w, http.StatusCreated, task)
}

func (h *IntegrationTasksHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.TasksRead)
	if !ok {
		return
	}
	taskID, err := atoi32(chi.URLParam(r, "task_id"))
	if err != nil || taskID <= 0 {
		http.Error(w, "ID de tarea inválido", http.StatusBadRequest)
		return
	}
	task, err := h.repo.Get(r.Context(), userID, projectID, taskID)
	if err != nil {
		integrationTaskError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, task)
}

func (h *IntegrationTasksHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.TasksRead)
	if !ok {
		return
	}
	params := r.URL.Query()
	query := models.IntegrationTaskQuery{Consulta: params.Get("q"), Estado: params.Get("estado"), Prioridad: params.Get("prioridad"), Limit: 10}
	for _, param := range []struct {
		name string
		dest *int
	}{{"limit", &query.Limit}, {"offset", &query.Offset}} {
		if params.Has(param.name) {
			value, err := strconv.Atoi(params.Get(param.name))
			if err != nil || (param.name == "limit" && value == 0) {
				http.Error(w, "Paginación inválida", http.StatusBadRequest)
				return
			}
			*param.dest = value
		}
	}
	if params.Has("tarea_padre_id") {
		parentID, err := atoi32(params.Get("tarea_padre_id"))
		if err != nil {
			http.Error(w, "ID de tarea padre inválido", http.StatusBadRequest)
			return
		}
		query.TareaPadreID = &parentID
	}
	list, err := h.repo.List(r.Context(), userID, projectID, query)
	if err != nil {
		integrationTaskError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, list)
}
