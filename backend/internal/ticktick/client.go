package ticktick

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrAuthorization   = errors.New("vuelve a conectar TickTick para autorizar la lectura")
	ErrUnavailable     = errors.New("no se pudo consultar TickTick")
	ErrRateLimited     = errors.New("TickTick pidió esperar antes de consultar de nuevo")
	ErrInvalidResponse = errors.New("TickTick devolvió una respuesta incompleta o inválida")
)

type Client struct {
	http      *http.Client
	apiBase   string
	oauthBase string
}

func NewClient() *Client {
	return NewClientForEndpoints("https://api.ticktick.com/open/v1", "https://ticktick.com/oauth")
}

// Endpoints explícitos permiten probar el protocolo real con un servidor local.
// El servidor de producción usa siempre los dominios oficiales, no datos del cliente.
func NewClientForEndpoints(apiBase, oauthBase string) *Client {
	return &Client{http: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, apiBase: strings.TrimRight(apiBase, "/"), oauthBase: strings.TrimRight(oauthBase, "/")}
}

type RawTask struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title"`
	Priority  int    `json:"priority"`
	Status    *int   `json:"status"`
	DueDate   string `json:"dueDate"`
	TimeZone  string `json:"timeZone"`
	IsAllDay  bool   `json:"isAllDay"`
	Kind      string `json:"kind"`
}

type Project struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Closed bool   `json:"closed"`
	Kind   string `json:"kind"`
}

type Token struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int64  `json:"expires_in"`
	Scope       string `json:"scope"`
}

func (c *Client) AuthorizeURL(clientID, redirect, state string) string {
	q := url.Values{"client_id": {clientID}, "redirect_uri": {redirect}, "scope": {"tasks:read"}, "state": {state}, "response_type": {"code"}}
	return c.oauthBase + "/authorize?" + q.Encode()
}

func (c *Client) request(ctx context.Context, method, address, token string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return ErrInvalidResponse
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, address, reader)
	if err != nil {
		return ErrUnavailable
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.do(req, out)
}

func (c *Client) do(req *http.Request, out any) error {
	response, err := c.http.Do(req)
	if err != nil {
		return ErrUnavailable
	}
	defer response.Body.Close()
	switch response.StatusCode {
	case 401, 403:
		return ErrAuthorization
	case 429:
		return ErrRateLimited
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ErrUnavailable
	}
	if out == nil {
		return nil
	}
	const max = 4 << 20
	data, err := io.ReadAll(io.LimitReader(response.Body, max+1))
	if err != nil || len(data) > max || json.Unmarshal(data, out) != nil {
		return ErrInvalidResponse
	}
	return nil
}

func (c *Client) Exchange(ctx context.Context, clientID, secret, redirect, code string) (Token, error) {
	var result Token
	form := url.Values{"code": {code}, "grant_type": {"authorization_code"}, "redirect_uri": {redirect}, "scope": {"tasks:read"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.oauthBase+"/token", strings.NewReader(form.Encode()))
	if err != nil {
		return result, ErrUnavailable
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(clientID, secret)
	if err := c.do(req, &result); err != nil {
		return Token{}, err
	}
	if result.AccessToken == "" || len(result.AccessToken) > 8192 || strings.ContainsAny(result.AccessToken, "\r\n") || result.ExpiresIn < 0 || result.ExpiresIn > 315360000 {
		return Token{}, ErrInvalidResponse
	}
	if result.Scope != "" {
		read := false
		for _, scope := range strings.Fields(result.Scope) {
			if scope != "tasks:read" {
				return Token{}, ErrAuthorization
			}
			read = read || scope == "tasks:read"
		}
		if !read {
			return Token{}, ErrAuthorization
		}
	}
	return result, nil
}

func (c *Client) Revoke(ctx context.Context, token string) error {
	address := strings.TrimSuffix(c.apiBase, "/open/v1") + "/oauth/revoke"
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	if err := form.WriteField("token", token); err != nil {
		return ErrUnavailable
	}
	if err := form.Close(); err != nil {
		return ErrUnavailable
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, address, &body)
	if err != nil {
		return ErrUnavailable
	}
	req.Header.Set("Content-Type", form.FormDataContentType())
	return c.do(req, nil)
}

func (c *Client) Projects(ctx context.Context, token string) ([]Project, bool, error) {
	var projects []Project
	if err := c.request(ctx, http.MethodGet, c.apiBase+"/project?limit=100&offset=0", token, nil, &projects); err != nil {
		return nil, false, err
	}
	if projects == nil {
		return nil, false, ErrInvalidResponse
	}
	partial := len(projects) > 50
	if partial {
		projects = projects[:50]
	}
	for _, p := range projects {
		if p.ID == "" || len(p.ID) > 128 {
			return nil, false, ErrInvalidResponse
		}
	}
	return projects, partial, nil
}

func validID(id string) bool {
	if len(id) < 1 || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

func (c *Client) ProjectTasks(ctx context.Context, token, id string) ([]RawTask, error) {
	if !validID(id) {
		return nil, ErrInvalidResponse
	}
	var result struct {
		Tasks     *[]RawTask `json:"tasks"`
		ErrorCode string     `json:"errorCode"`
	}
	err := c.request(ctx, http.MethodGet, c.apiBase+"/project/"+url.PathEscape(id)+"/data", token, nil, &result)
	if err != nil {
		return nil, err
	}
	if result.Tasks == nil || result.ErrorCode != "" {
		return nil, ErrInvalidResponse
	}
	return *result.Tasks, nil
}

// Consulta de lectura aunque el proveedor utilice POST. Se limita al buzón:
// las listas se leen completas para aplicar dueDate, no startDate, en Cassandra.
func (c *Client) InboxUndone(ctx context.Context, token string, start, end time.Time) ([]RawTask, error) {
	var result []RawTask
	format := "2006-01-02T15:04:05.000-0700"
	err := c.request(ctx, http.MethodPost, c.apiBase+"/task/undone", token, map[string]any{"projectIds": []string{"inbox"}, "startDate": start.Format(format), "endDate": end.Add(-time.Millisecond).Format(format)}, &result)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, ErrInvalidResponse
	}
	return result, nil
}
