package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"time"

	"cassandra/internal/calendario"
	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

// PlanificacionHandler: horario base y bloques de trabajo (sesión), y la disponibilidad y
// planificación para integraciones (sesión o key).
type PlanificacionHandler struct {
	repo *repository.CalendarioRepository
}

func NewPlanificacionHandler(repo *repository.CalendarioRepository) *PlanificacionHandler {
	return &PlanificacionHandler{repo: repo}
}

// MaxDiasDisponibilidad: rango máximo que se puede pedir de una vez.
const MaxDiasDisponibilidad = 31

func (h *PlanificacionHandler) HorarioBase(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	franjas, err := h.repo.HorarioBase(r.Context(), userID)
	if err != nil {
		dbError(w, "Error al leer el horario base", err)
		return
	}
	writeJSON(w, http.StatusOK, franjas)
}

// validarFranjas: días 0–6, horas HH:MM (fin hasta 24:00) y sin solapes en un mismo día.
func validarFranjas(franjas []models.FranjaHorario) string {
	if len(franjas) > 42 {
		return "Se admiten hasta 42 franjas"
	}
	for i, f := range franjas {
		ini, err1 := calendario.HoraMin(f.HoraInicio)
		fin, err2 := calendario.HoraMin(f.HoraFin)
		if f.DiaSemana < 0 || f.DiaSemana > 6 || err1 != nil || err2 != nil || f.HoraInicio == "24:00" {
			return "Cada franja necesita dia_semana de 0 a 6 y horas HH:MM"
		}
		if fin <= ini {
			return "La hora de fin debe ser posterior a la de inicio"
		}
		for _, g := range franjas[:i] {
			gi, _ := calendario.HoraMin(g.HoraInicio)
			gf, _ := calendario.HoraMin(g.HoraFin)
			if g.DiaSemana == f.DiaSemana && ini < gf && gi < fin {
				return "Las franjas de un mismo día no pueden solaparse"
			}
		}
	}
	return ""
}

func (h *PlanificacionHandler) SetHorarioBase(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	var req models.HorarioBaseRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if msg := validarFranjas(req.Franjas); msg != "" {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	franjas, err := h.repo.SetHorarioBase(r.Context(), userID, req.Franjas)
	if err != nil {
		dbError(w, "Error al guardar el horario base", err)
		return
	}
	writeJSON(w, http.StatusOK, franjas)
}

// DeleteBloque (sesión) quita un bloque de trabajo propio.
func (h *PlanificacionHandler) DeleteBloque(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	if err := h.repo.DeleteBloque(r.Context(), userID, id, nil); err != nil {
		dbError(w, "Error al quitar el bloque", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// integrationUser autoriza una operación de integración que no es de un proyecto.
func integrationUser(w http.ResponseWriter, r *http.Request, scope string) (int, *models.APIKeyAccess, bool) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return 0, nil, false
	}
	a := middleware.GetAPIKeyAccess(r.Context())
	if a != nil && !slices.Contains(a.Scopes, scope) {
		http.Error(w, "La key no tiene permiso para esta operación", http.StatusForbidden)
		return 0, nil, false
	}
	return userID, a, true
}

// Disponibilidad atiende GET /api/integrations/calendar?desde&hasta&ahora.
// ahora (AAAA-MM-DDTHH:MM) es la hora local del cliente: los huecos empiezan ahí. Sin
// ahora se usa la hora del servidor. Por defecto el rango va de hoy a 13 días después.
func (h *PlanificacionHandler) Disponibilidad(w http.ResponseWriter, r *http.Request) {
	userID, access, ok := integrationUser(w, r, models.CalendarRead)
	if !ok {
		return
	}
	q := r.URL.Query()
	now := time.Now()
	ahora := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), 0, 0, time.UTC)
	if s := q.Get("ahora"); s != "" {
		t, err := time.Parse("2006-01-02T15:04", s)
		if err != nil {
			http.Error(w, "ahora inválida: usa el formato AAAA-MM-DDTHH:MM", http.StatusBadRequest)
			return
		}
		ahora = t
	}
	desde := calendario.Dia(ahora)
	if s := q.Get("desde"); s != "" {
		if desde, ok = fechaParam(w, s, "desde"); !ok {
			return
		}
	}
	hasta := desde.AddDate(0, 0, 13)
	if s := q.Get("hasta"); s != "" {
		if hasta, ok = fechaParam(w, s, "hasta"); !ok {
			return
		}
	}
	if hasta.Before(desde) || hasta.Sub(desde).Hours()/24 >= MaxDiasDisponibilidad {
		http.Error(w, "El rango debe tener entre 1 y 31 días", http.StatusBadRequest)
		return
	}
	var calendarios, proyectos []int
	if access != nil {
		calendarios, proyectos = access.FiltroCalendarios(), access.FiltroProyectos()
	}
	res, err := h.repo.Disponibilidad(r.Context(), userID, desde, hasta, ahora, calendarios, proyectos)
	if err != nil {
		dbError(w, "Error al calcular la disponibilidad", err)
		return
	}
	integrationJSON(w, http.StatusOK, res)
}

func planificacionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrBloqueSolapado):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		integrationTaskError(w, err)
	}
}

// Planificar atiende POST /api/integrations/projects/{project_id}/tasks/{task_id}/bloques.
func (h *PlanificacionHandler) Planificar(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.TasksManage)
	if !ok {
		return
	}
	taskID, ok := idParam(w, r, "task_id")
	if !ok {
		return
	}
	var req models.PlanificarRequest
	if !integrationBody(w, r, &req) {
		return
	}
	var keyID int64
	if a := middleware.GetAPIKeyAccess(r.Context()); a != nil {
		keyID = a.APIKeyID
	}
	res, err := h.repo.Planificar(r.Context(), userID, projectID, taskID, keyID, req)
	if err != nil {
		planificacionError(w, err)
		return
	}
	integrationJSON(w, http.StatusCreated, res)
}

// QuitarBloque atiende DELETE /api/integrations/projects/{project_id}/bloques/{bloque_id}.
func (h *PlanificacionHandler) QuitarBloque(w http.ResponseWriter, r *http.Request) {
	userID, projectID, ok := integrationProject(w, r, models.TasksManage)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "bloque_id")
	if !ok {
		return
	}
	if err := h.repo.DeleteBloque(r.Context(), userID, id, []int{projectID}); err != nil {
		integrationTaskError(w, err)
		return
	}
	integrationJSON(w, http.StatusOK, map[string]any{"eliminado": true, "bloque_id": id})
}
