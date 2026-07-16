package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"cassandra/models"
	"cassandra/repository"
	"cassandra/utils"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	UserRepo  *repository.UserRepository
	AuthRepo  *repository.AuthRepository
	jwtSecret string
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// constructor
func NewAuthHandler(userRepo *repository.UserRepository, authRepo *repository.AuthRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		UserRepo:  userRepo,
		AuthRepo:  authRepo,
		jwtSecret: jwtSecret,
	}
}

// login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest

	//decodificar el json enviado desde angular
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// buscar el user en la db
	user, err := h.UserRepo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// comparar al usuario por correo en la db
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// generar el accesstoken
	accessToken, err := utils.GenerateAccessToken(user.ID, h.jwtSecret)
	if err != nil {
		http.Error(w, "Error al crear el jwt", http.StatusInternalServerError)
		return
	}

	//generar el refreshToken
	refreshToken, err := utils.GenerateRefreshToken()
	if err != nil {
		http.Error(w, "Error al generar el refreshToken", http.StatusInternalServerError)
		return
	}

	// guardar el refreshToken en la db 7 dias
	expiredAT := time.Now().Add(7 * 24 * time.Hour)
	err = h.AuthRepo.SaveRefreshToken(r.Context(), user.ID, refreshToken, expiredAT)
	if err != nil {
		http.Error(w, "error al guardar el token en la base de datos", http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	//enviar respuesta
	w.Header().Set("Content-type", "application/json")
	json.NewEncoder(w).Encode(models.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})

}

// refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest

	//decodificar la peticion
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Json invalido", http.StatusBadRequest)
		return
	}

	//validar que se envio el refresh token
	if req.RefreshToken == "" {
		http.Error(w, "el refresh token es obligatorio", http.StatusBadRequest)
		return
	}

	userID, err := h.AuthRepo.GetUserIDByRefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		http.Error(w, "sesion invalida: "+ err.Error(), http.StatusUnauthorized)
		return
	}

	// si el refreshtoken es valido, regenerar un nuevo token
	newAccessToken, err := utils.GenerateAccessToken(userID, h.jwtSecret)
	if err != nil {
		http.Error(w, "error al generar un nuevo token: "+ err.Error(), http.StatusInternalServerError)
		return
	}

	//responder con el nuevo token

	w.Header().Set("Content-type", "application/json")
	json.NewEncoder(w).Encode(models.TokenResponse{
		AccessToken: newAccessToken,
		RefreshToken: req.RefreshToken,
	})


}
