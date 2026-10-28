package models

import "time"

const (
	MemoryRead  = "memory:read"
	MemoryWrite = "memory:write"
	TasksRead   = "tasks:read"
	TasksCreate = "tasks:create"
)

type APIKey struct {
	ID            int64      `json:"id"`
	Nombre        string     `json:"nombre"`
	Prefijo       string     `json:"prefijo"`
	Scopes        []string   `json:"scopes"`
	ProyectoIDs   []int      `json:"proyecto_ids"`
	FechaCreacion time.Time  `json:"fecha_creacion"`
	ExpiraEn      *time.Time `json:"expira_en"`
	RevocadaEn    *time.Time `json:"revocada_en"`
	UltimoUso     *time.Time `json:"ultimo_uso"`
}

type CreateAPIKeyRequest struct {
	Nombre      string     `json:"nombre"`
	Scopes      []string   `json:"scopes"`
	ProyectoIDs []int      `json:"proyecto_ids"`
	ExpiraEn    *time.Time `json:"expira_en,omitempty"`
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
}
