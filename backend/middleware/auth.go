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
			log.Printf("[AUTH DEBUG] token recibido (len=%d): %q  origen=%s", len(tokenStr), tokenStr, origenToken(r))
			log.Printf("[AUTH DEBUG] error al validar: %v", err)
			http.Error(w, "Token invalido", http.StatusUnauthorized)
			return
		}

			// 3. Inyectar el userId en el contexto de la aplicacion
			ctx := context.WithValue(r.Context(), UserIDKey, userId)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractAccessToken obtiene el access token JWT segun el cliente:
//  1. Header Authorization: Bearer <token>  -> clientes tipo Bruno/curl/movil
//  2. Cookie HttpOnly access_token           -> frontend Angular (browser real)
//
// El header es autoritativo: si esta presente (aunque sea invalido)
// NO se cae a la cookie. Esto evita que una variable Bruno vacia
// {{accessToken}} se enmascare con una cookie stale del cookie jar.
func extractAccessToken(r *http.Request) string {
	autheader := r.Header.Get("Authorization")
	if autheader != "" {
		parts := strings.SplitN(autheader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			return strings.TrimSpace(parts[1])
		}
		// header presente pero malformado: forzar 401 con mensaje claro,
		// sin caer a la cookie (que podria tener basura).
		return ""
	}

	// Sin header Authorization: usar la cookie HttpOnly (browser real).
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

// origenToken indica de donde salio el token recibido por el middleware,
// para distinguir "lo mando Bruno por header" vs "lo mando el browser por cookie".
func origenToken(r *http.Request) string {
	if r.Header.Get("Authorization") != "" {
		return "header Authorization"
	}
	if _, err := r.Cookie("access_token"); err == nil {
		return "cookie access_token"
	}
	return "desconocido"
}