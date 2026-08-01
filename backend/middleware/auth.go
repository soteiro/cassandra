package middleware

import (
	"net/http"
	"strings"
	"context"
	"log"
	"cassandra/utils"
)

type contextKey string

const UserIDKey contextKey = "userID"

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 1. Intentar obtener el access token desde el header Authorization: Bearer <token>
			// o desde la cookie HttpOnly access_token (usada por el frontend Angular).
			tokenStr := extractAccessToken(r)
			if tokenStr == "" {
				log.Printf("falta token: no hay header Authorization ni cookie access_token")
				http.Error(w, "falta la cabezera de auth", http.StatusUnauthorized)
				return
			}

			// 2. Validar el jwt
			userId, err := utils.ValidateAccessToken(tokenStr, jwtSecret)
			if err != nil {
				log.Printf("[AUTH DEBUG] Error al validar el token: %v", err)
				http.Error(w, "Token invalido"+err.Error(), http.StatusUnauthorized)
				return
			}

			// 3. Inyectar el userId en el contexto de la aplicacion
			ctx := context.WithValue(r.Context(), UserIDKey, userId)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractAccessToken intenta obtener el access token JWT desde:
//  1. Header Authorization: Bearer <token> (APIs/otros clientes)
//  2. Cookie HttpOnly access_token (frontend Angular con withCredentials)
func extractAccessToken(r *http.Request) string {
	// Path 1: Authorization header
	autheader := r.Header.Get("Authorization")
	if autheader != "" {
		parts := strings.SplitN(autheader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			return strings.TrimSpace(parts[1])
		}
	}

	// Path 2: cookie HttpOnly access_token
	if cookie, err := r.Cookie("access_token"); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

func GetUserIDFromContext(ctx context.Context) (int, bool) {
	userID, ok := ctx.Value(UserIDKey).(int)
	log.Print("userid: ", userID)
	return userID, ok
}