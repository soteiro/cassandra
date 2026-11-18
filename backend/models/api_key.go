package models

import (
	"slices"
	"time"
)

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
	ID            int64    `json:"id"`
	Nombre        string   `json:"nombre"`
	Prefijo       string   `json:"prefijo"`
	Scopes        []string `json:"scopes"`
	ProyectoIDs   []int    `json:"proyecto_ids"`
	CalendarioIDs []int    `json:"calendario_ids"`
	// TodosProyectos/TodosCalendarios: alcance total, incluidos los que se creen después.
	TodosProyectos   bool       `json:"todos_proyectos"`
	TodosCalendarios bool       `json:"todos_calendarios"`
	FechaCreacion    time.Time  `json:"fecha_creacion"`
	ExpiraEn         *time.Time `json:"expira_en"`
	RevocadaEn       *time.Time `json:"revocada_en"`
	UltimoUso        *time.Time `json:"ultimo_uso"`
}

type CreateAPIKeyRequest struct {
	Nombre      string   `json:"nombre"`
	Scopes      []string `json:"scopes"`
	ProyectoIDs []int    `json:"proyecto_ids"`
	// Calendarios cuyo contenido ve la key (requiere calendar:read).
	CalendarioIDs []int `json:"calendario_ids,omitempty"`
	// Con TodosProyectos, ProyectoIDs debe ir vacío; con TodosCalendarios, CalendarioIDs.
	TodosProyectos   bool       `json:"todos_proyectos,omitempty"`
	TodosCalendarios bool       `json:"todos_calendarios,omitempty"`
	ExpiraEn         *time.Time `json:"expira_en,omitempty"`
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
	// Flags explícitos de alcance total. Una lista vacía o nil nunca equivale a "todos".
	TodosProyectos   bool
	TodosCalendarios bool
}

// PuedeProyecto indica si la key alcanza el proyecto.
func (a *APIKeyAccess) PuedeProyecto(id int) bool {
	return a.TodosProyectos || slices.Contains(a.ProyectoIDs, id)
}

// FiltroProyectos devuelve los proyectos visibles para filtros de repositorio: nil = todos.
func (a *APIKeyAccess) FiltroProyectos() []int {
	if a.TodosProyectos {
		return nil
	}
	if a.ProyectoIDs == nil {
		return []int{}
	}
	return a.ProyectoIDs
}

// FiltroCalendarios devuelve los calendarios visibles para filtros de repositorio: nil = todos.
func (a *APIKeyAccess) FiltroCalendarios() []int {
	if a.TodosCalendarios {
		return nil
	}
	if a.CalendarioIDs == nil {
		return []int{}
	}
	return a.CalendarioIDs
}
