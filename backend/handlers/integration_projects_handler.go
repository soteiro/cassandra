package handlers

import (
	"net/http"
	"slices"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

// IntegrationProjectsHandler expone a las integraciones los proyectos que alcanzan.
type IntegrationProjectsHandler struct {
	repo *repository.ProjectRepository
}

func NewIntegrationProjectsHandler(repo *repository.ProjectRepository) *IntegrationProjectsHandler {
	return &IntegrationProjectsHandler{repo: repo}
}

// List atiende GET /api/integrations/projects. Una key ve solo sus proyectos y necesita
// algún permiso de lectura; una sesión ve todos.
func (h *IntegrationProjectsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	var ids []int
	todos := true
	if a := middleware.GetAPIKeyAccess(r.Context()); a != nil {
		if !slices.ContainsFunc(a.Scopes, func(s string) bool {
			return s == models.MemoryRead || s == models.TasksRead || s == models.CalendarRead
		}) {
			http.Error(w, "La key no tiene permiso para esta operación", http.StatusForbidden)
			return
		}
		ids, todos = a.FiltroProyectos(), a.TodosProyectos
	}
	proyectos, err := h.repo.ListIntegracion(r.Context(), userID, ids)
	if err != nil {
		dbError(w, "No se pudieron listar los proyectos", err)
		return
	}
	integrationJSON(w, http.StatusOK, models.IntegrationProjectList{Proyectos: proyectos, TodosProyectos: todos})
}
