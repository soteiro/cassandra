package models

import "time"

const (
	MemoryRead  = "memory:read"
	MemoryWrite = "memory:write"
	TasksRead   = "tasks:read"
	TasksCreate = "tasks:create"
	// TasksManage: cambiar estado, prioridad, fechas y estimación, y planificar bloques.
	TasksManage = "tasks:manage"
	// CalendarRead: ver la disponibilidad. Solo los calendarios elegidos muestran su contenido.
	CalendarRead = "calendar:read"
)

// ValidScope indica si el permiso existe.
func ValidScope(s string) bool {
	switch s {
	case MemoryRead, MemoryWrite, TasksRead, TasksCreate, TasksManage, CalendarRead:
		return true
	}
	return false
}

type APIKey struct {
	ID            int64      `json:"id"`
	Nombre        string     `json:"nombre"`
	Prefijo       string     `json:"prefijo"`
	Scopes        []string   `json:"scopes"`
	ProyectoIDs   []int      `json:"proyecto_ids"`
	CalendarioIDs []int      `json:"calendario_ids"`
	FechaCreacion time.Time  `json:"fecha_creacion"`
	ExpiraEn      *time.Time `json:"expira_en"`
	RevocadaEn    *time.Time `json:"revocada_en"`
	UltimoUso     *time.Time `json:"ultimo_uso"`
}

type CreateAPIKeyRequest struct {
	Nombre      string   `json:"nombre"`
	Scopes      []string `json:"scopes"`
	ProyectoIDs []int    `json:"proyecto_ids"`
	// Calendarios cuyo contenido ve la key (requiere calendar:read).
	CalendarioIDs []int      `json:"calendario_ids,omitempty"`
	ExpiraEn      *time.Time `json:"expira_en,omitempty"`
}

// El secreto solo existe en la respuesta a la creación.
type IssuedAPIKey struct {
	APIKey
	Token string `json:"token"`
}

type APIKeyAccess struct {
	UserID      int
	APIKeyID    int64
	Scopes      []string
	ProyectoIDs []int
	// Calendarios expuestos; nil para una sesión normal (ve todo).
	CalendarioIDs []int
}
