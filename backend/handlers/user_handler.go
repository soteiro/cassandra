package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

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
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 2. Validación básica
	if req.Nombre == "" || req.Email == "" {
		http.Error(w, "El nombre y el email son obligatorios", http.StatusBadRequest)
		return
	}

	// hashear password, GenerateFromPassword recibe la pass en bytes y un factor de costo DefaultCost = 10 por defecto
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	if err != nil {
		http.Error(w, "Error interno al procesar la password", http.StatusInternalServerError)
		return
	}

	// Reemplazar la pass en texto plano al hash
	req.Password = string(hashedPassword)
	
	// 3. Llamar al repositorio para guardar el usuario
	user, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		http.Error(w, "Error al crear el usuario: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 4. Escribir la respuesta JSON de éxito (201 Created)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// ListUsers maneja la ruta GET /api/users
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	// 1. Llamar al repositorio
	users, err := h.repo.GetAll(r.Context())
	if err != nil {
		http.Error(w, "Error al obtener usuarios: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Si la base de datos está vacía, evitamos devolver 'null'. Es mejor devolver una lista vacía '[]'
	if users == nil {
		users = []models.UserResponse{}
	}

	// 3. Devolver la lista en formato JSON (200 OK por defecto)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	//obternet el id del parametro de la url
	idSrt := chi.URLParam(r, "id")

	// convertir la string a int
	id, err := strconv.Atoi(idSrt)
	if err != nil {
		http.Error(w, "ID invalido, debe ser un numero", http.StatusBadRequest)
		return
	}
	user, err := h.repo.GetById(r.Context(), id)
	if err != nil {
		// TODO:
		// pgx tiene un error especial cuando no encuentra registros: pgx.ErrNoRows
		// (puedes importar "github.com/jackc/pgx/v5" para validarlo si gustas,
		// pero para simplificar ahora diremos que no se encontró)

		http.Error(w, "usuario no encontrado", http.StatusNotFound)

		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)

}

// DeleteUser realiza el borrado lógico del usuario
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	err = h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "Error al eliminar usuario: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 204 No Content es la respuesta estándar de éxito para un delete si no devolvemos datos
	w.WriteHeader(http.StatusNoContent)
}


//update user
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request){
	idStr := chi.URLParam(r, "id")
	id , err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	var req models.UserUpdateRequest

	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "json invalido: "+ err.Error(), http.StatusBadRequest)
		return
	}

	// validacion basica TODO: mejorar en el futuro
	if req.Nombre == "" || req.Email == "" {
		http.Error(w, "Error al actualizar el usuario: ", http.StatusBadRequest)
		return
	}

	user, err := h.repo.Update(r.Context(), id, &req)
	if err != nil {
		http.Error(w, "error al actualizar el usuario: "+err.Error() , http.StatusInternalServerError)
		return
	}

	//devolver el usuario actualizado
	w.Header().Set("Content-type", "application/json")
	json.NewEncoder(w).Encode(user)


}