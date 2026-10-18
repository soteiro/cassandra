package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"cassandra/models"

	"github.com/jackc/pgx/v5"
)

type MemoryKeyAuthenticator interface {
	Authenticate(context.Context, string) (*models.MemoryAccess, error)
}

const memoryAccessKey contextKey = "memoryAccess"

func GetMemoryAccess(ctx context.Context) *models.MemoryAccess {
	a, _ := ctx.Value(memoryAccessKey).(*models.MemoryAccess)
	return a
}

// MemoryAuth permite sesión normal o key acotada solo en /api/memory.
func MemoryAuth(jwtSecret string, users ActiveUsers, keys MemoryKeyAuthenticator) func(http.Handler) http.Handler {
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
			ctx = context.WithValue(ctx, memoryAccessKey, a)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
