package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"cassandra/internal/calendario"
	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

const (
	maxNombreCalendario = 80
	maxTituloActividad  = 200
	// Lo más largo que pide la vista de 3 meses, con las semanas de borde.
	maxDiasRango = 200
)

var colorHex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// CalendarioHandler atiende el calendario: el rango a dibujar y los calendarios propios
// (turnos con ciclo y excepciones, actividades con horario).
type CalendarioHandler struct {
	repo  *repository.CalendarioRepository
	owner *repository.Ownership
}

func NewCalendarioHandler(repo *repository.CalendarioRepository, owner *repository.Ownership) *CalendarioHandler {
	return &CalendarioHandler{repo: repo, owner: owner}
}

func usuario(w http.ResponseWriter, r *http.Request) (int, bool) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
	}
	return userID, ok
}

func idParam(w http.ResponseWriter, r *http.Request, name string) (int, bool) {
	id, err := atoi32(chi.URLParam(r, name))
	if err != nil || id <= 0 {
		http.Error(w, "ID inválido, debe ser un número entero", http.StatusBadRequest)
		return 0, false
	}
	return id, true
}

func fechaParam(w http.ResponseWriter, s, campo string) (time.Time, bool) {
	d, err := calendario.ParseDia(s)
	if err != nil {
		http.Error(w, campo+" inválida: usa el formato AAAA-MM-DD", http.StatusBadRequest)
		return time.Time{}, false
	}
	return d, true
}

// Rango atiende GET /api/calendario?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&hoy=AAAA-MM-DD].
// hoy es la fecha local del cliente: decide qué deadlines están atrasados.
func (h *CalendarioHandler) Rango(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	desde, ok := fechaParam(w, q.Get("desde"), "desde")
	if !ok {
		return
	}
	hasta, ok := fechaParam(w, q.Get("hasta"), "hasta")
	if !ok {
		return
	}
	if hasta.Before(desde) || hasta.Sub(desde).Hours()/24 > maxDiasRango {
		http.Error(w, "Rango inválido: hasta debe ser posterior a desde y abarcar como máximo 200 días", http.StatusBadRequest)
		return
	}
	hoy := calendario.Dia(time.Now().UTC())
	if s := q.Get("hoy"); s != "" {
		if hoy, ok = fechaParam(w, s, "hoy"); !ok {
			return
		}
	}
	res, err := h.repo.Rango(r.Context(), userID, desde, hasta, hoy)
	if err != nil {
		dbError(w, "Error al obtener el calendario", err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// List atiende GET /api/calendarios.
func (h *CalendarioHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	cals, err := h.repo.List(r.Context(), userID)
	if err != nil {
		dbError(w, "Error al obtener los calendarios", err)
		return
	}
	writeJSON(w, http.StatusOK, cals)
}

func validarNombre(w http.ResponseWriter, nombre string) (string, bool) {
	nombre = strings.TrimSpace(nombre)
	if nombre == "" || utf8.RuneCountInString(nombre) > maxNombreCalendario {
		http.Error(w, "El nombre es obligatorio y tiene como máximo 80 caracteres", http.StatusBadRequest)
		return "", false
	}
	return nombre, true
}

func validarColor(w http.ResponseWriter, color string) bool {
	if !colorHex.MatchString(color) {
		http.Error(w, "Color inválido: usa el formato #RRGGBB", http.StatusBadRequest)
		return false
	}
	return true
}

// Create atiende POST /api/calendarios.
func (h *CalendarioHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	var req models.CalendarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if req.Nombre, ok = validarNombre(w, req.Nombre); !ok {
		return
	}
	if req.Color == "" {
		req.Color = "#58a6ff"
	}
	if !validarColor(w, req.Color) {
		return
	}
	if req.Tipo != "turnos" && req.Tipo != "actividades" {
		http.Error(w, "Tipo inválido: debe ser turnos o actividades", http.StatusBadRequest)
		return
	}
	cal, err := h.repo.Create(r.Context(), userID, &req)
	if err != nil {
		dbError(w, "Error al crear el calendario", err)
		return
	}
	writeJSON(w, http.StatusCreated, cal)
}

// Update atiende PUT /api/calendarios/{id}.
func (h *CalendarioHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var req models.CalendarioUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if req.Nombre != nil {
		nombre, ok := validarNombre(w, *req.Nombre)
		if !ok {
			return
		}
		req.Nombre = &nombre
	}
	if req.Color != nil && !validarColor(w, *req.Color) {
		return
	}
	cal, err := h.repo.Update(r.Context(), id, userID, &req)
	if err != nil {
		dbError(w, "Error al actualizar el calendario", err)
		return
	}
	writeJSON(w, http.StatusOK, cal)
}

// Delete atiende DELETE /api/calendarios/{id}.
func (h *CalendarioHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	if err := h.repo.Delete(r.Context(), id, userID); err != nil {
		dbError(w, "Error al eliminar el calendario", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// calendarioDeTipo carga el calendario del usuario y exige su tipo.
func (h *CalendarioHandler) calendarioDeTipo(w http.ResponseWriter, r *http.Request, userID int, tipo string) (*models.Calendario, bool) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return nil, false
	}
	cal, err := h.repo.Get(r.Context(), id, userID)
	if err != nil {
		dbError(w, "Calendario no encontrado", err)
		return nil, false
	}
	if cal.Tipo != tipo {
		http.Error(w, "Esta operación es para calendarios de "+tipo, http.StatusBadRequest)
		return nil, false
	}
	return cal, true
}

// SetCiclo atiende PUT /api/calendarios/{id}/ciclo: el primer Largo desde el que se
// recalcula el ciclo.
func (h *CalendarioHandler) SetCiclo(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	cal, ok := h.calendarioDeTipo(w, r, userID, "turnos")
	if !ok {
		return
	}
	var req models.CicloRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	primer, ok := fechaParam(w, req.PrimerLargo, "primer_largo")
	if !ok {
		return
	}
	if err := h.repo.SetCiclo(r.Context(), cal.ID, primer); err != nil {
		dbError(w, "Error al guardar el ciclo", err)
		return
	}
	cal, err := h.repo.Get(r.Context(), cal.ID, userID)
	if err != nil {
		dbError(w, "Error al leer el calendario", err)
		return
	}
	writeJSON(w, http.StatusOK, cal)
}

// SetExcepcion atiende PUT /api/calendarios/{id}/excepciones/{fecha}.
func (h *CalendarioHandler) SetExcepcion(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	cal, ok := h.calendarioDeTipo(w, r, userID, "turnos")
	if !ok {
		return
	}
	fecha, ok := fechaParam(w, chi.URLParam(r, "fecha"), "fecha")
	if !ok {
		return
	}
	var req models.ExcepcionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if !calendario.CodigosTurno[req.Codigo] {
		http.Error(w, "Código inválido: debe ser L, N, S, F, V o M", http.StatusBadRequest)
		return
	}
	if err := h.repo.SetExcepcion(r.Context(), cal.ID, fecha, req.Codigo); err != nil {
		dbError(w, "Error al guardar la excepción", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteExcepcion atiende DELETE /api/calendarios/{id}/excepciones/{fecha}: el día
// vuelve a lo que dice el ciclo.
func (h *CalendarioHandler) DeleteExcepcion(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	cal, ok := h.calendarioDeTipo(w, r, userID, "turnos")
	if !ok {
		return
	}
	fecha, ok := fechaParam(w, chi.URLParam(r, "fecha"), "fecha")
	if !ok {
		return
	}
	if err := h.repo.DeleteExcepcion(r.Context(), cal.ID, fecha); err != nil {
		dbError(w, "Error al quitar la excepción", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func horaValida(s string) bool {
	_, err := time.Parse("15:04", s)
	return err == nil && len(s) == 5
}

// actividadInput valida el cuerpo de una actividad.
func actividadInput(w http.ResponseWriter, r *http.Request) (*repository.ActividadInput, bool) {
	var req models.ActividadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return nil, false
	}
	titulo := strings.TrimSpace(req.Titulo)
	if titulo == "" || utf8.RuneCountInString(titulo) > maxTituloActividad {
		http.Error(w, "El título es obligatorio y tiene como máximo 200 caracteres", http.StatusBadRequest)
		return nil, false
	}
	fecha, ok := fechaParam(w, req.Fecha, "fecha")
	if !ok {
		return nil, false
	}
	if !horaValida(req.HoraInicio) || !horaValida(req.HoraFin) || req.HoraFin <= req.HoraInicio {
		http.Error(w, "Horas inválidas: usa HH:MM y una hora de término posterior a la de inicio", http.StatusBadRequest)
		return nil, false
	}
	vistos := map[int]bool{}
	dias := []int16{}
	for _, d := range req.DiasSemana {
		if d < 0 || d > 6 {
			http.Error(w, "dias_semana inválido: 0 = lunes … 6 = domingo", http.StatusBadRequest)
			return nil, false
		}
		if !vistos[d] {
			vistos[d] = true
			dias = append(dias, int16(d))
		}
	}
	sort.Slice(dias, func(i, j int) bool { return dias[i] < dias[j] })
	in := &repository.ActividadInput{Titulo: titulo, Fecha: fecha, HoraInicio: req.HoraInicio, HoraFin: req.HoraFin, DiasSemana: dias}
	if req.Hasta != nil && *req.Hasta != "" {
		hasta, ok := fechaParam(w, *req.Hasta, "hasta")
		if !ok {
			return nil, false
		}
		if hasta.Before(fecha) {
			http.Error(w, "hasta no puede ser anterior a la fecha", http.StatusBadRequest)
			return nil, false
		}
		in.Hasta = &hasta
	}
	return in, true
}

// CreateActividad atiende POST /api/calendarios/{id}/actividades.
func (h *CalendarioHandler) CreateActividad(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	cal, ok := h.calendarioDeTipo(w, r, userID, "actividades")
	if !ok {
		return
	}
	in, ok := actividadInput(w, r)
	if !ok {
		return
	}
	act, err := h.repo.CreateActividad(r.Context(), cal.ID, userID, in)
	if err != nil {
		dbError(w, "Error al crear la actividad", err)
		return
	}
	writeJSON(w, http.StatusCreated, act)
}

// GetActividad atiende GET /api/calendario/actividades/{id}.
func (h *CalendarioHandler) GetActividad(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	act, err := h.repo.GetActividad(r.Context(), id, userID)
	if err != nil {
		dbError(w, "Actividad no encontrada", err)
		return
	}
	writeJSON(w, http.StatusOK, act)
}

// UpdateActividad atiende PUT /api/calendario/actividades/{id} (reemplaza la actividad).
func (h *CalendarioHandler) UpdateActividad(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	in, ok := actividadInput(w, r)
	if !ok {
		return
	}
	act, err := h.repo.UpdateActividad(r.Context(), id, userID, in)
	if err != nil {
		dbError(w, "Error al actualizar la actividad", err)
		return
	}
	writeJSON(w, http.StatusOK, act)
}

// DeleteActividad atiende DELETE /api/calendario/actividades/{id}.
func (h *CalendarioHandler) DeleteActividad(w http.ResponseWriter, r *http.Request) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	if err := h.repo.DeleteActividad(r.Context(), id, userID); err != nil {
		dbError(w, "Error al eliminar la actividad", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CalendarioHandler) setCancelada(w http.ResponseWriter, r *http.Request, cancelada bool) {
	userID, ok := usuario(w, r)
	if !ok {
		return
	}
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	fecha, ok := fechaParam(w, chi.URLParam(r, "fecha"), "fecha")
	if !ok {
		return
	}
	if !requireOwned(w, r, h.owner, userID, repository.Ref{Recurso: repository.ActividadCal, ID: id}) {
		return
	}
	if err := h.repo.SetCancelada(r.Context(), id, fecha, cancelada); err != nil {
		dbError(w, "Error al guardar la cancelación", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Cancelar atiende PUT /api/calendario/actividades/{id}/cancelaciones/{fecha}: la
// actividad no ocurre ese día.
func (h *CalendarioHandler) Cancelar(w http.ResponseWriter, r *http.Request) {
	h.setCancelada(w, r, true)
}

// Restaurar atiende DELETE /api/calendario/actividades/{id}/cancelaciones/{fecha}.
func (h *CalendarioHandler) Restaurar(w http.ResponseWriter, r *http.Request) {
	h.setCancelada(w, r, false)
}
