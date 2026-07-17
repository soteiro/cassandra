package handlers

import (
	"encoding/json"
	"log"
	"net/http"


	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type ProyectHandler struct {
	repo *repository.ProyectRepository
}

//constructor para inyectar el repo
func NewProyectHandler(repo *repository.ProyectRepository) *ProyectHandler {
	return &ProyectHandler{repo : repo}
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
		http.Error(w, "Json invalido: "+ err.Error(), http.StatusBadRequest)
		return
	}

	// validacion basica, TODO: mejorar para evitar inyecciones sql
	// trim al nombre
	if req.Nombre == "" {
		http.Error(w, "El nombre no puede estar vacio: ", http.StatusBadRequest )
		return
	}

	// obtener el user_id del contexto
	

	// inyectar el user_id desde el contexto
	req.UserID = userID

	//guardar datos 
	proyect, err := h.repo.Create(r.Context(), &req)
	// validar error
	if err != nil {
		log.Printf("error al guardar los datos: %v", err)
		http.Error(w, "error al crear el proyecto: "+err.Error(), http.StatusInternalServerError)
	}

	//responder
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(&proyect)
	log.Printf("nuevo proyecto creado: %v", proyect)
}
