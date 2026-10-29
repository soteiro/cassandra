package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cassandra/config"
	"cassandra/internal/ticktick"
	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"
)

type TickTickHandler struct {
	repo     *repository.TickTickRepository
	settings *config.TickTick
	client   *ticktick.Client
	cipher   *ticktick.Cipher
	service  *ticktick.Service
}

func NewTickTickHandler(repo *repository.TickTickRepository, settings *config.TickTick, client *ticktick.Client) *TickTickHandler {
	if client == nil {
		client = ticktick.NewClient()
	}
	h := &TickTickHandler{repo: repo, settings: settings, client: client, service: ticktick.NewService(client)}
	if settings != nil {
		h.cipher, _ = ticktick.NewCipher(settings.EncryptionKey)
	}
	return h
}

func (h *TickTickHandler) available() bool { return h.settings != nil && h.cipher != nil }

func (h *TickTickHandler) Status(w http.ResponseWriter, r *http.Request) {
	out := models.TickTickConnection{Available: h.available()}
	if !h.available() {
		integrationJSON(w, http.StatusOK, out)
		return
	}
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	c, err := h.repo.Get(r.Context(), userID)
	if err != nil {
		dbError(w, "No se pudo consultar la conexión TickTick", err)
		return
	}
	out.Connected = len(c.Token) > 0
	out.ConnectedAt = c.ConnectedAt
	out.NeedsReauthorize = c.NeedsReauthorize || (c.ExpiresAt != nil && !c.ExpiresAt.After(time.Now()))
	if out.Connected {
		if _, err := h.cipher.Decrypt(userID, c.Token); err != nil {
			out.NeedsReauthorize = true
		}
	}
	integrationJSON(w, http.StatusOK, out)
}

func (h *TickTickHandler) Authorize(w http.ResponseWriter, r *http.Request) {
	if !h.available() {
		integrationJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "TickTick todavía no está habilitado en este servidor."})
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "Se requiere JSON", http.StatusUnsupportedMediaType)
		return
	}
	var input struct{}
	if !integrationBody(w, r, &input) {
		return
	}
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		internalError(w, "No se pudo iniciar la conexión", err)
		return
	}
	state := base64.RawURLEncoding.EncodeToString(data)
	if err := h.repo.Start(r.Context(), userID, state); err != nil {
		dbError(w, "No se pudo iniciar la conexión", err)
		return
	}
	h.service.Invalidate(userID)
	integrationJSON(w, http.StatusOK, map[string]string{"authorization_url": h.client.AuthorizeURL(h.settings.ClientID, h.settings.RedirectURI, state)})
}

func (h *TickTickHandler) callbackRedirect(w http.ResponseWriter, r *http.Request, status string) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	target := "/configuracion/ticktick?ticktick=" + status
	if h.settings != nil {
		if u, err := url.Parse(h.settings.RedirectURI); err == nil {
			target = u.Scheme + "://" + u.Host + target
		}
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
}

func (h *TickTickHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if !h.available() {
		h.callbackRedirect(w, r, "unavailable")
		return
	}
	query := r.URL.Query()
	state := query.Get("state")
	if len(state) != 43 || len(query["state"]) != 1 {
		h.callbackRedirect(w, r, "invalid_state")
		return
	}
	userID, version, err := h.repo.Consume(r.Context(), state)
	if err != nil {
		h.callbackRedirect(w, r, "invalid_state")
		return
	}
	code := query.Get("code")
	if query.Get("error") != "" {
		h.callbackRedirect(w, r, "denied")
		return
	}
	if code == "" || len(code) > 4096 || len(query["code"]) != 1 {
		h.callbackRedirect(w, r, "failed")
		return
	}
	token, err := h.client.Exchange(r.Context(), h.settings.ClientID, h.settings.ClientSecret, h.settings.RedirectURI, code)
	if err != nil {
		h.callbackRedirect(w, r, "failed")
		return
	}
	sealed, err := h.cipher.Encrypt(userID, token.AccessToken)
	var expires *time.Time
	if token.ExpiresIn > 0 {
		value := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
		expires = &value
	}
	if err == nil {
		err = h.repo.Save(r.Context(), userID, version, sealed, expires)
	}
	if err != nil {
		// Una desconexión o autorización más nueva no puede ser revertida por el callback.
		_ = h.client.Revoke(r.Context(), token.AccessToken)
		h.callbackRedirect(w, r, "failed")
		return
	}
	h.service.Invalidate(userID)
	h.callbackRedirect(w, r, "connected")
}

func (h *TickTickHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	sealed, err := h.repo.Disconnect(r.Context(), userID)
	if err != nil {
		dbError(w, "No se pudo desconectar TickTick", err)
		return
	}
	h.service.Invalidate(userID)
	out := models.TickTickConnection{Available: h.available()}
	if len(sealed) > 0 && h.available() {
		token, err := h.cipher.Decrypt(userID, sealed)
		out.RevocationFailed = err != nil
		if err == nil {
			out.RevocationFailed = h.client.Revoke(r.Context(), token) != nil
		}
	}
	integrationJSON(w, http.StatusOK, out)
}

func (h *TickTickHandler) Today(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	zone := query.Get("time_zone")
	if zone == "" {
		zone = "UTC"
	}
	start, _, err := ticktick.Day(query.Get("date"), zone, time.Now())
	if err != nil || start.Format(time.DateOnly) != time.Now().In(start.Location()).Format(time.DateOnly) {
		integrationJSON(w, http.StatusBadRequest, map[string]string{"message": "La consulta requiere la fecha de hoy y una zona horaria válida."})
		return
	}
	date := start.Format(time.DateOnly)
	if !h.available() {
		integrationJSON(w, http.StatusOK, ticktick.Empty("unavailable", date, zone))
		return
	}
	userID, _ := middleware.GetUserIDFromContext(r.Context())
	c, err := h.repo.Get(r.Context(), userID)
	if err != nil {
		dbError(w, "No se pudo consultar la conexión TickTick", err)
		return
	}
	if len(c.Token) == 0 {
		integrationJSON(w, http.StatusOK, ticktick.Empty("not_connected", date, zone))
		return
	}
	token, err := h.cipher.Decrypt(userID, c.Token)
	if err != nil || c.NeedsReauthorize || (c.ExpiresAt != nil && !c.ExpiresAt.After(time.Now())) {
		integrationJSON(w, http.StatusOK, ticktick.Empty("reauthorize", date, zone))
		return
	}
	refresh := query.Get("refresh") == "true"
	out, err := h.service.Today(r.Context(), userID, c.Version, token, date, zone, refresh)
	if errors.Is(err, ticktick.ErrAuthorization) {
		if err := h.repo.MarkUnauthorized(r.Context(), userID, c.Version); err != nil {
			dbError(w, "No se pudo actualizar la conexión", err)
			return
		}
		h.service.Invalidate(userID)
		// 401 se reserva a la sesión Cassandra: un token externo vencido no cierra sesión.
		integrationJSON(w, http.StatusOK, ticktick.Empty("reauthorize", date, zone))
		return
	}
	if err != nil {
		message := "No se pudo actualizar TickTick. Vuelve a intentarlo."
		if errors.Is(err, ticktick.ErrRateLimited) {
			message = "TickTick pidió esperar antes de consultar de nuevo."
			w.Header().Set("Retry-After", "30")
		}
		integrationJSON(w, http.StatusServiceUnavailable, map[string]string{"message": message})
		return
	}
	integrationJSON(w, http.StatusOK, out)
}
