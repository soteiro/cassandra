package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"log"

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
	log.Printf("peticion de login recibida")
	//decodificar el json enviado desde angular
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("json enviado desde front invalido: %v", err)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// buscar el user en la db
	user, err := h.UserRepo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("error al buscar el usuario por email: %v", err)
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// comparar al usuario por correo en la db
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		log.Printf("error al comparar la password: %v", err)
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// generar el accesstoken
	accessToken, err := utils.GenerateAccessToken(user.ID, h.jwtSecret)
	if err != nil {
		log.Printf("error al generar el jwt: %v", err)
		http.Error(w, "Error al crear el jwt", http.StatusInternalServerError)
		return
	}

	//generar el refreshToken
	refreshToken, err := utils.GenerateRefreshToken()
	if err != nil {
		log.Printf("error al generar el refreshToken: %v", err)
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

	// accesstoken en cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // TODO: true en produccion (HTTPS)
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	// refreshtoken en cookie httponly (7 dias)
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // TODO: true en produccion (HTTPS)
		SameSite: http.SameSiteLaxMode,
		Expires:  expiredAT,
	})

	//enviar respuesta (sin tokens en el body)
	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "login exitoso"})

}

// refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	// leer el refresh token desde la cookie
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		log.Printf("peticion de refresh sin cookie")
		http.Error(w, "el refresh token es obligatorio", http.StatusUnauthorized)
		return
	}

	userID, err := h.AuthRepo.GetUserIDByRefreshToken(r.Context(), cookie.Value)
	if err != nil {
		log.Printf("error al validar el refresh token: %v", err)
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// si el refreshtoken es valido, regenerar un nuevo access token
	newAccessToken, err := utils.GenerateAccessToken(userID, h.jwtSecret)
	if err != nil {
		log.Printf("error al generar un nuevo token: %v", err)
		http.Error(w, "error al generar un nuevo token", http.StatusInternalServerError)
		return
	}

	// accesstoken en cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Cambiar a true en producción
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	log.Printf("Refresh exitoso %v", userID)
	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "token renovado"})
}

//logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// leer el refresh token desde la cookie
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		log.Printf("peticion de logout sin cookie")
		http.Error(w, "el refresh token es obligatorio", http.StatusUnauthorized)
		return
	}

	

	// eliminar el refresh token de la db
	err = h.AuthRepo.DeleteRefreshToken(r.Context(), cookie.Value)
	if err != nil {
		log.Printf("error al eliminar el refresh token de la db: %v", err)
		http.Error(w, "error al cerrar sesion", http.StatusInternalServerError)
		return
	}

	// eliminar las cookies del cliente (MaxAge < 0 las borra)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // TODO: true en produccion (HTTPS)
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // TODO: true en produccion (HTTPS)
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	log.Printf("Logout exitoso")
	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "logout exitoso"})
}

// auth me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// intentar leer la cookie del access_token
	accessCookie, err := r.Cookie("access_token")
	if err == nil && accessCookie.Value != "" {
		//validar el token
		userID, err := utils.ValidateAccessToken(accessCookie.Value, h.jwtSecret)
		if err == nil {
			//acceso token valido,  sesion ok
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]int{"user_id":userID})
			return
		}
		log.Printf("[ME] access token invalido o expirado: %v", err)
	}

	//intentar con refresh token, si se llega aqui, el token es invalido o expirado
	refreshCookie, err := r.Cookie("refresh_token")
	if err != nil || refreshCookie.Value == "" {
		log.Printf("[ME] refresh token no encontrado o invalido: %v", err)
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// verificar el refresh token contra la db
	userID, err := h.AuthRepo.GetUserIDByRefreshToken(r.Context(), refreshCookie.Value)
	if err != nil {
		log.Printf("[ME] refresh token invalido o no encontrado en db: %v", err)
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// si el refresh token es valido, generar un nuevo access token
	newAccessToken, err := utils.GenerateAccessToken(userID, h.jwtSecret)
	if err != nil {
		log.Printf("[ME] error al generar un nuevo access token: %v", err)
		http.Error(w, "error al generar un nuevo access token", http.StatusInternalServerError)
		return
	}

	// enviar el nuevo access token en la cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:	 "/",
		HttpOnly: true,
		Secure:   false, 
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	//responder igual que el caso feliz
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]int{"user_id":userID})
}