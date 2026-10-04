package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

// UserHandler maneja las peticiones HTTP relacionadas con usuarios
type UserHandler struct {
	repo *repository.UserRepository
}

// NewUserHandler constructor para inyectar el repositorio
func NewUserHandler(repo *repository.UserRepository) *UserHandler {
	return &UserHandler{repo: repo}
}

// GetUser obtiene la información del perfil del propio usuario
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:User.GetUser] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idSrt := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idSrt)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:User.GetUser] ID inválido: %s | user_id=%d", idSrt, userID)
		http.Error(w, "ID inválido, debe ser un número", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede solicitar su propia información
	if id != userID {
		log.Printf("[HANDLER:User.GetUser] Permiso denegado: usuario %d intentó acceder a usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	user, err := h.repo.GetById(r.Context(), id)
	if err != nil {
		log.Printf("[HANDLER:User.GetUser] Error o no encontrado: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Usuario no encontrado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:User.GetUser] Éxito: usuario obtenido | id=%d", user.ID)
	json.NewEncoder(w).Encode(user)
}

// DeleteUser realiza el borrado lógico del propio usuario
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:User.DeleteUser] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:User.DeleteUser] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede eliminarse a sí mismo
	if id != userID {
		log.Printf("[HANDLER:User.DeleteUser] Permiso denegado: usuario %d intentó eliminar a usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	err = h.repo.Delete(r.Context(), id)
	if err != nil {
		log.Printf("[HANDLER:User.DeleteUser] Error en repositorio: %v | id=%d", err, id)
		http.Error(w, "Error al eliminar usuario", http.StatusInternalServerError)
		return
	}

	log.Printf("[HANDLER:User.DeleteUser] Éxito: usuario eliminado | id=%d", id)
	w.WriteHeader(http.StatusNoContent)
}

// UpdateUser actualiza la información del propio usuario
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("[HANDLER:User.UpdateUser] Acceso no autorizado")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		log.Printf("[HANDLER:User.UpdateUser] ID inválido: %s | user_id=%d", idStr, userID)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede actualizar su propio perfil
	if id != userID {
		log.Printf("[HANDLER:User.UpdateUser] Permiso denegado: usuario %d intentó actualizar a usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	var req models.UserUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:User.UpdateUser] JSON inválido: %v | id=%d", err, id)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	// Aplicar TrimSpace a los campos de texto al actualizar
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Alias = strings.TrimSpace(req.Alias)
	req.Email = strings.TrimSpace(req.Email)

	// Validación básica
	if req.Nombre == "" || req.Email == "" {
		log.Printf("[HANDLER:User.UpdateUser] Validación fallida: nombre o email vacío | id=%d", id)
		http.Error(w, "El nombre y el email son obligatorios", http.StatusBadRequest)
		return
	}

	// Validación de formato de email usando net/mail
	_, err = mail.ParseAddress(req.Email)
	if err != nil {
		log.Printf("[HANDLER:User.UpdateUser] Validación fallida: formato de email inválido: %s | id=%d", req.Email, id)
		http.Error(w, "Formato de email inválido", http.StatusBadRequest)
		return
	}

	user, err := h.repo.Update(r.Context(), id, &req)
	if err != nil {
		log.Printf("[HANDLER:User.UpdateUser] Error en repositorio: %v | id=%d", err, id)
		http.Error(w, "Error al actualizar el usuario", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("[HANDLER:User.UpdateUser] Éxito: usuario actualizado | id=%d email=%s", user.ID, user.Email)
	json.NewEncoder(w).Encode(user)
}