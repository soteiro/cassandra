package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"cassandra/models"

	"github.com/jackc/pgx/v5"
)

type APIKeyAuthenticator interface {
	Authenticate(context.Context, string) (*models.APIKeyAccess, error)
}

const apiKeyAccessKey contextKey = "apiKeyAccess"

func GetAPIKeyAccess(ctx context.Context) *models.APIKeyAccess {
	a, _ := ctx.Value(apiKeyAccessKey).(*models.APIKeyAccess)
	return a
}

// IntegrationAuth admite sesión o key solo en rutas de integración explícitas.
// Cada handler exige además el permiso y proyecto correspondientes.
func IntegrationAuth(jwtSecret string, users ActiveUsers, keys APIKeyAuthenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		session := AuthMiddleware(jwtSecret, users)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractAccessToken(r)
			if !strings.HasPrefix(token, "cass_mem_") {
				session.ServeHTTP(w, r)
				return
			}
			a, err := keys.Authenticate(r.Context(), token)
			if errors.Is(err, pgx.ErrNoRows) {
				http.Error(w, "Key inválida, revocada o vencida", http.StatusUnauthorized)
				return
			}
			if err != nil {
				http.Error(w, "No se pudo verificar la key", http.StatusInternalServerError)
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, a.UserID)
			ctx = context.WithValue(ctx, apiKeyAccessKey, a)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
