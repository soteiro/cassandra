package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type NotasProyectoHandler struct {
	NotasRepo *repository.NotasProyectoRepository
}

// constructor
func NewNotasProyectoHandler(notasRepo *repository.NotasProyectoRepository) *NotasProyectoHandler {
	return &NotasProyectoHandler{
		NotasRepo: notasRepo,
	}
}

// NewProyectoNotasHandler alias por retrocompatibilidad
func NewProyectoNotasHandler(notasRepo *repository.NotasProyectoRepository) *NotasProyectoHandler {
	return NewNotasProyectoHandler(notasRepo)
}

// crear nota
func (h *NotasProyectoHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.NotasProyectoRequest

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.Create] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.Create] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Si proyect_id viene en los parámetros de la URL
	proyectIDStr := chi.URLParam(r, "proyect_id")
	if proyectIDStr == "" {
		proyectIDStr = chi.URLParam(r, "proyecto_id")
	}
	if proyectIDStr != "" {
		if pID, err := strconv.Atoi(proyectIDStr); err == nil && pID > 0 {
			req.ProyectoID = pID
		}
	}

	if req.ProyectoID <= 0 {
		log.Printf("[HANDLER:NotasProyecto.Create] Validación fallida: proyecto_id es obligatorio | user_id=%d", userID)
		http.Error(w, "El ID del proyecto (proyecto_id) es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID

	// trim
	req.Nota = strings.TrimSpace(req.Nota)

	if req.Nota == "" {
		log.Printf("[HANDLER:NotasProyecto.Create] Validación fallida: nota vacía | user_id=%d", userID)
		http.Error(w, "La nota no puede estar vacía", http.StatusBadRequest)
		return
	}

	// guardar en la base de datos
	notaProyecto, err := h.NotasRepo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.Create] Error en repositorio: %v | user_id=%d proyecto_id=%d", err, userID, req.ProyectoID)
		http.Error(w, "Error al crear la nota de proyecto", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Printf("[HANDLER:NotasProyecto.Create] Éxito: nota de proyecto creada | id=%d user_id=%d proyecto_id=%d", notaProyecto.ID, userID, req.ProyectoID)
	json.NewEncoder(w).Encode(notaProyecto)
}

func (h *NotasProyectoHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.GetAll] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	notasProyecto, err := h.NotasRepo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.GetAll] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener las notas de proyecto", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:NotasProyecto.GetAll] Éxito: %d notas obtenidas | user_id=%d", len(notasProyecto), userID)
	json.NewEncoder(w).Encode(notasProyecto)
}

// eliminar nota de proyecto
func (h *NotasProyectoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:NotasProyecto.Delete] ID inválido: %s", idStr)
		http.Error(w, "ID de nota de proyecto inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.Delete] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	err = h.NotasRepo.Delete(r.Context(), id, userID)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.Delete] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al eliminar la nota de proyecto", http.StatusInternalServerError)
		return 
	}

	log.Printf("[HANDLER:NotasProyecto.Delete] Éxito: nota eliminada | id=%d user_id=%d", id, userID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *NotasProyectoHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	nota := chi.URLParam(r, "id")
	id, err := strconv.Atoi(nota)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:NotasProyecto.GetByID] ID inválido: %s", nota)
		http.Error(w, "ID de nota de proyecto inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.GetByID] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	res, err := h.NotasRepo.GetById(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:NotasProyecto.GetByID] No encontrada | id=%d user_id=%d", id, userID)
			http.Error(w, "Nota de proyecto no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:NotasProyecto.GetByID] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al obtener la nota de proyecto", http.StatusInternalServerError)
		return 
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:NotasProyecto.GetByID] Éxito: nota obtenida | id=%d user_id=%d", res.ID, userID)
	json.NewEncoder(w).Encode(res)
}

// update 
func (h *NotasProyectoHandler) Update(w http.ResponseWriter, r *http.Request) {
	userId, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.Update] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:NotasProyecto.Update] ID inválido: %s | user_id=%d", idStr, userId)
		http.Error(w, "ID de nota de proyecto inválido", http.StatusBadRequest)
		return
	}

	var req models.NotasProyectoUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.Update] JSON inválido: %v | id=%d user_id=%d", err, id, userId)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	// trim y validación si se envía nota
	if req.Nota != nil {
		trimmedNota := strings.TrimSpace(*req.Nota)
		if trimmedNota == "" {
			log.Printf("[HANDLER:NotasProyecto.Update] Validación fallida: nota vacía tras trim | id=%d user_id=%d", id, userId)
			http.Error(w, "La nota no puede quedar vacía", http.StatusBadRequest)
			return
		}
		req.Nota = &trimmedNota
	}

	res, err := h.NotasRepo.Update(r.Context(), id, userId, &req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[HANDLER:NotasProyecto.Update] No encontrada para actualizar | id=%d user_id=%d", id, userId)
			http.Error(w, "Nota de proyecto no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("[HANDLER:NotasProyecto.Update] Error en repositorio: %v | id=%d user_id=%d", err, id, userId)
		http.Error(w, "Error al actualizar la nota de proyecto", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:NotasProyecto.Update] Éxito: nota actualizada | id=%d user_id=%d", res.ID, userId)
	json.NewEncoder(w).Encode(res)
}

// llamar por proyecto id
func (h *NotasProyectoHandler) GetByProyectoID(w http.ResponseWriter, r *http.Request) {
	proyectoIDStr := chi.URLParam(r, "proyect_id")
	if proyectoIDStr == "" {
		proyectoIDStr = chi.URLParam(r, "proyecto_id")
	}
	proyectoID, err := strconv.Atoi(proyectoIDStr)
	if err != nil || proyectoID <= 0 {
		log.Printf("[HANDLER:NotasProyecto.GetByProyectoID] ID de proyecto inválido: %s", proyectoIDStr)
		http.Error(w, "ID de proyecto inválido", http.StatusBadRequest)
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:NotasProyecto.GetByProyectoID] Acceso no autorizado")
		http.Error(w, "Error al obtener el ID del usuario", http.StatusUnauthorized)
		return
	}

	notasProyecto, err := h.NotasRepo.GetByProyectoID(r.Context(), proyectoID, userID)
	if err != nil {
		log.Printf("[HANDLER:NotasProyecto.GetByProyectoID] Error en repositorio: %v | proyecto_id=%d user_id=%d", err, proyectoID, userID)
		http.Error(w, "Error al obtener las notas de proyecto por proyecto_id", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:NotasProyecto.GetByProyectoID] Éxito: %d notas obtenidas | proyecto_id=%d user_id=%d", len(notasProyecto), proyectoID, userID)
	json.NewEncoder(w).Encode(notasProyecto)
}