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
		log.Printf("intento de creacion de proyecto fallido, por no tener auth: %v", ok)
		http.Error(w, "usuario no autenticado", http.StatusUnauthorized)
		return
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front invalido: %v", err)
		http.Error(w, "Json invalido: ", http.StatusBadRequest)
		return
	}

	// Limpiar espacios con TrimSpace
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Descripcion = strings.TrimSpace(req.Descripcion)
	req.Comentario = strings.TrimSpace(req.Comentario)

	// validacion basica
	if req.Nombre == "" {
		log.Printf("error de validacion: nombre vacio")
		http.Error(w, "El nombre no puede estar vacio: ", http.StatusBadRequest)
		return
	}

	// inyectar el user_id desde el contexto
	req.UserID = userID

	// guardar datos 
	proyect, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		log.Printf("error al guardar los datos: %v", err)
		http.Error(w, "error al crear el proyecto: ", http.StatusInternalServerError)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(&proyect)
	log.Printf("nuevo proyecto creado: %v", proyect)
}

// listat con getall
func (h *ProyectHandler) ListProyect(w http.ResponseWriter, r *http.Request) {
	// verificar que el usuario sea dueño de sus datos
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("acceso denegado sin auth")
		http.Error(w, "acceso denegado", http.StatusUnauthorized)
		return
	}

	proyect, err := h.repo.GetAll(r.Context(), userID)
	if err != nil {
		log.Printf("error al listar usuarios: %v", err)
		http.Error(w, "error al listar usuario", http.StatusInternalServerError)
		return
	}
	if proyect == nil {
		log.Printf("no se encontraron proyectos para el usuario: %v", userID)
		proyect = []models.ProyectResponse{}
		return
	}
	w.Header().Set("Content-type", "application/json")
	json.NewEncoder(w).Encode(&proyect)
}

// eliminar proyecto por id, soft
func (h *ProyectHandler) DeleteByID(w http.ResponseWriter, r *http.Request) {
	idstr := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		log.Printf("peticion delete de proyecto sin auth")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(idstr)
	if err != nil {
		log.Printf("id invalido: %v", err)
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}

	res, err := h.repo.Delete(r.Context(), id, userID)
	if err != nil {
		log.Printf("error al eliminar el proyecto: %v", err)
		http.Error(w, "error al borrar el proyecto", http.StatusInternalServerError)
		return
	}
	if res == nil {
		w.WriteHeader(http.StatusNoContent)
		log.Printf("proyecto con id: %d, eliminado por el usuario con id %v", id, userID)
		return
	}
}

func (h *ProyectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	proyectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	strProyectID, err := strconv.Atoi(proyectID)
	if err != nil {
		log.Printf("ID de proyecto invalido")
		http.Error(w, "ID invalido", http.StatusBadRequest)
		return
	}
	if !ok {
		log.Printf("peticion de proyecto por id sin auth")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	res, err := h.repo.GetById(r.Context(), strProyectID, userID)
	if err != nil {
		log.Printf("error en la peticion de proyecto: %v", err)
		http.Error(w, "error en la peticion", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// update
func (h *ProyectHandler) Update(w http.ResponseWriter, r *http.Request) {
	proyectID := chi.URLParam(r, "id")
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	strProyectId, err := strconv.Atoi(proyectID)
	if err != nil {
		log.Printf("ID de proyecto invalido: %v", err)
		http.Error(w, "ID de proyecto invalido", http.StatusBadRequest)
		return
	}
	if !ok {
		log.Printf("intento de modificacion de proyecto sin auth")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// decodificar el json
	var req models.ProyectUpdateRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("update de proyecto con json invalido: %v", err)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// Limpiar espacios en campos de actualización opcionales (punteros)
	if req.Nombre != nil {
		*req.Nombre = strings.TrimSpace(*req.Nombre)
		if *req.Nombre == "" {
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

	proyect, err := h.repo.Update(r.Context(), strProyectId, userID, &req)
	if err != nil {
		log.Printf("error al modificar el proyecto, %v", err)
		http.Error(w, "error al modificar el proyecto", http.StatusInternalServerError)
		return
	}

	// responder
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(proyect)
}