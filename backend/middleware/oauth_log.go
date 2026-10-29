package middleware

import "net/http"

// Chi registra RequestURI. El código OAuth y el estado permanecen en URL para
// validar el callback, pero no se copian a los registros de acceso de la app.
func RedactOAuthRequestURI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/connections/ticktick/callback" {
			copy := r.Clone(r.Context())
			copy.RequestURI = r.URL.EscapedPath()
			next.ServeHTTP(w, copy)
			return
		}
		next.ServeHTTP(w, r)
	})
}
