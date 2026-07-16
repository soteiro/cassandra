package middleware

import (
	"net/http"
	"strings"
	"context"

	"cassandra/utils"
)

// definir un tipo de  clave privada para evitar coliciones (esto no lo entendi)

type contextKey string

const UserIDKey contextKey = "userID"
func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request){
			// obtener la cabezera de autenticacion
			autheader := r.Header.Get("Authorization")
			if autheader == "" {
				http.Error(w, "falta la cabezera de auth", http.StatusUnauthorized)
				return
			}

			// validar la que la cabezera tenga el formato Bearer <token>
			parts := strings.Split(autheader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "bearer token invalido", http.StatusBadRequest)
				return
			} 

			tokenStr := parts[1]

			//validar el jwt
			userId, err := utils.ValidateAccessToken(tokenStr, jwtSecret)
			if err != nil {
				http.Error(w, "Token invalido"+ err.Error(),http.StatusUnauthorized)
				return
			}	

			//inyectar el userId en el contexto de la aplicacion
			//esto es para que el resto de operadores sepa quien esta ahi
			ctx := context.WithValue(r.Context(), UserIDKey, userId)
			
			next.ServeHTTP(w, r.WithContext(ctx))

		})
	}
}

// handler para acceder al UserId facilmente
func GetUserIDFromContext(ctx context.Context) (int, bool){
	userID, ok := ctx.Value(UserIDKey).(int)
	return userID, ok
}