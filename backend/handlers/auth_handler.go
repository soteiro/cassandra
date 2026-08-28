package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
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

	// decodificar el json enviado desde angular
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] JSON inválido: %v", err)
		http.Error(w, "json invalido", http.StatusBadRequest)
		return
	}

	// buscar el user en la db
	user, err := h.UserRepo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] Credenciales inválidas (email no encontrado): %s", req.Email)
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// comparar la password con el hash en db
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] Credenciales inválidas (password errónea): %s", req.Email)
		http.Error(w, "Credenciales Invalidas", http.StatusUnauthorized)
		return
	}

	// generar el accesstoken
	accessToken, err := utils.GenerateAccessToken(user.ID, h.jwtSecret)
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] Error al generar JWT access token: %v | user_id=%d", err, user.ID)
		http.Error(w, "Error al crear el jwt", http.StatusInternalServerError)
		return
	}

	// generar el refreshToken
	refreshToken, err := utils.GenerateRefreshToken()
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] Error al generar refresh token: %v | user_id=%d", err, user.ID)
		http.Error(w, "Error al generar el refreshToken", http.StatusInternalServerError)
		return
	}

	// guardar el refreshToken en la db 7 dias
	expiredAT := time.Now().Add(7 * 24 * time.Hour)
	err = h.AuthRepo.SaveRefreshToken(r.Context(), user.ID, refreshToken, expiredAT)
	if err != nil {
		log.Printf("[HANDLER:Auth.Login] Error al guardar refresh token en DB: %v | user_id=%d", err, user.ID)
		http.Error(w, "error al guardar el token en la base de datos", http.StatusInternalServerError)
		return
	}

	secure, sameSite := getCookieSettings(r)

	// accesstoken en cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	// refreshtoken en cookie httponly (7 dias)
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  expiredAT,
	})

	// enviar respuesta
	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Auth.Login] Éxito: login completado | user_id=%d email=%s", user.ID, user.Email)
	json.NewEncoder(w).Encode(map[string]string{"message": "login exitoso"})
}

// refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	// leer el refresh token desde la cookie
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		log.Printf("[HANDLER:Auth.Refresh] Petición sin cookie refresh_token")
		http.Error(w, "el refresh token es obligatorio", http.StatusUnauthorized)
		return
	}

	userID, err := h.AuthRepo.GetUserIDByRefreshToken(r.Context(), cookie.Value)
	if err != nil {
		log.Printf("[HANDLER:Auth.Refresh] Refresh token inválido o expirado: %v", err)
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// si el refreshtoken es valido, regenerar un nuevo access token
	newAccessToken, err := utils.GenerateAccessToken(userID, h.jwtSecret)
	if err != nil {
		log.Printf("[HANDLER:Auth.Refresh] Error al generar nuevo access token: %v | user_id=%d", err, userID)
		http.Error(w, "error al generar un nuevo token", http.StatusInternalServerError)
		return
	}

	secure, sameSite := getCookieSettings(r)

	// accesstoken en cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Auth.Refresh] Éxito: access token renovado | user_id=%d", userID)
	json.NewEncoder(w).Encode(map[string]string{"message": "token renovado"})
}

//logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// leer el refresh token desde la cookie
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		log.Printf("[HANDLER:Auth.Logout] Petición sin cookie refresh_token")
		http.Error(w, "el refresh token es obligatorio", http.StatusUnauthorized)
		return
	}

	// eliminar el refresh token de la db
	err = h.AuthRepo.DeleteRefreshToken(r.Context(), cookie.Value)
	if err != nil {
		log.Printf("[HANDLER:Auth.Logout] Error al eliminar refresh token de la DB: %v", err)
		http.Error(w, "error al cerrar sesion", http.StatusInternalServerError)
		return
	}

	secure, sameSite := getCookieSettings(r)

	// eliminar las cookies del cliente (MaxAge < 0 las borra)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   -1,
	})

	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Auth.Logout] Éxito: sesión cerrada")
	json.NewEncoder(w).Encode(map[string]string{"message": "logout exitoso"})
}

// auth me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// intentar leer la cookie del access_token
	accessCookie, err := r.Cookie("access_token")
	if err == nil && accessCookie.Value != "" {
		// validar el token
		userID, err := utils.ValidateAccessToken(accessCookie.Value, h.jwtSecret)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			log.Printf("[HANDLER:Auth.Me] Éxito vía access_token | user_id=%d", userID)
			json.NewEncoder(w).Encode(map[string]int{"user_id": userID})
			return
		}
		log.Printf("[HANDLER:Auth.Me] Access token inválido o expirado: %v", err)
	}

	// intentar con refresh token
	refreshCookie, err := r.Cookie("refresh_token")
	if err != nil || refreshCookie.Value == "" {
		log.Printf("[HANDLER:Auth.Me] No hay refresh token disponible")
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// verificar el refresh token contra la db
	userID, err := h.AuthRepo.GetUserIDByRefreshToken(r.Context(), refreshCookie.Value)
	if err != nil {
		log.Printf("[HANDLER:Auth.Me] Refresh token no encontrado o inválido: %v", err)
		http.Error(w, "sesion invalida", http.StatusUnauthorized)
		return
	}

	// si el refresh token es valido, generar un nuevo access token
	newAccessToken, err := utils.GenerateAccessToken(userID, h.jwtSecret)
	if err != nil {
		log.Printf("[HANDLER:Auth.Me] Error al generar nuevo access token: %v | user_id=%d", err, userID)
		http.Error(w, "error al generar un nuevo access token", http.StatusInternalServerError)
		return
	}

	secure, sameSite := getCookieSettings(r)

	// enviar el nuevo access token en la cookie httponly (15 min)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  time.Now().Add(15 * time.Minute),
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Printf("[HANDLER:Auth.Me] Éxito vía refresh_token (token renovado) | user_id=%d", userID)
	json.NewEncoder(w).Encode(map[string]int{"user_id": userID})
}

func getCookieSettings(r *http.Request) (bool, http.SameSite) {
	origin := r.Header.Get("Origin")
	isHttps := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
	isCrossOrMobile := strings.HasPrefix(origin, "http://localhost") ||
		strings.HasPrefix(origin, "capacitor://") ||
		strings.HasPrefix(origin, "https://") ||
		strings.Contains(origin, "soteiro.dev")

	if isHttps || isCrossOrMobile {
		return true, http.SameSiteNoneMode
	}
	return false, http.SameSiteLaxMode
}