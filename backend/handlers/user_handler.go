package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

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

// CreateUser atiende la ruta POST /api/users
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.UserRequest

	// 1. Decodificar el cuerpo JSON de la petición
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front invalido: %v", err)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	// Aplicar TrimSpace a los campos de texto
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Alias = strings.TrimSpace(req.Alias)
	req.Email = strings.TrimSpace(req.Email)

	// 2. Validación básica
	if req.Nombre == "" || req.Email == "" {
		http.Error(w, "El nombre y el email son obligatorios", http.StatusBadRequest)
		return
	}

	// Validación de formato de email usando net/mail
	_, err = mail.ParseAddress(req.Email)
	if err != nil {
		log.Printf("Formato de email inválido: %s", req.Email)
		http.Error(w, "Formato de email inválido", http.StatusBadRequest)
		return
	}

	// Hashear password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error interno al procesar la contraseña", http.StatusInternalServerError)
		return
	}

	// Reemplazar la pass en texto plano por el hash
	req.Password = string(hashedPassword)
	
	// 3. Llamar al repositorio para guardar el usuario
	user, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("Error al crear el usuario: %v", err)
		http.Error(w, "Error al crear el usuario", http.StatusInternalServerError)
		return
	}

	// 4. Escribir la respuesta JSON de éxito (201 Created)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// ListUsers maneja la ruta GET /api/users (solo para fines administrativos/desarrollo)
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	log.Printf("Usuario autenticado con ID: %d", userID)
	
	// 1. Llamar al repositorio
	users, err := h.repo.GetAll(r.Context())
	if err != nil {
		log.Printf("Error al obtener usuarios: %v", err)
		http.Error(w, "Error al obtener usuarios", http.StatusInternalServerError)
		return
	}

	// 2. Si la base de datos está vacía, evitamos devolver 'null'.
	if users == nil {
		users = []models.UserResponse{}
	}

	// 3. Devolver la lista en formato JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetUser obtiene la información del perfil del propio usuario
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("acceso denegado sin auth")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idSrt := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idSrt)
	if err != nil {
		log.Printf("Error al convertir el ID: %v", err)
		http.Error(w, "ID inválido, debe ser un número", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede solicitar su propia información
	if id != userID {
		log.Printf("Usuario %d intentó obtener información del usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	user, err := h.repo.GetById(r.Context(), id)
	if err != nil {
		log.Printf("Error al obtener el usuario: %v", err)
		http.Error(w, "Usuario no encontrado", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// DeleteUser realiza el borrado lógico del propio usuario
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("Error al convertir el ID: %v", err)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede eliminarse a sí mismo
	if id != userID {
		log.Printf("Usuario %d intentó eliminar al usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	err = h.repo.Delete(r.Context(), id)
	if err != nil {
		log.Printf("error al eliminar el usuario: %v", err)
		http.Error(w, "Error al eliminar usuario", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateUser actualiza la información del propio usuario
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("petición update de usuario sin auth")
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("Error al convertir el ID: %v", err)
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// 🔒 VALIDACIÓN BOLA: El usuario solo puede actualizar su propio perfil
	if id != userID {
		log.Printf("Usuario %d intentó actualizar al usuario %d", userID, id)
		http.Error(w, "No tienes permiso para acceder a este recurso", http.StatusForbidden)
		return
	}

	var req models.UserUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front inválido: %v", err)
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	// Aplicar TrimSpace a los campos de texto al actualizar
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Alias = strings.TrimSpace(req.Alias)
	req.Email = strings.TrimSpace(req.Email)

	// Validación básica
	if req.Nombre == "" || req.Email == "" {
		log.Printf("error de validación: nombre o email vacío")
		http.Error(w, "El nombre y el email son obligatorios", http.StatusBadRequest)
		return
	}

	// Validación de formato de email usando net/mail
	_, err = mail.ParseAddress(req.Email)
	if err != nil {
		log.Printf("Formato de email inválido al actualizar: %s", req.Email)
		http.Error(w, "Formato de email inválido", http.StatusBadRequest)
		return
	}

	user, err := h.repo.Update(r.Context(), id, &req)
	if err != nil {
		log.Printf("error al actualizar el usuario: %v", err)
		http.Error(w, "Error al actualizar el usuario", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}