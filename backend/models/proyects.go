package models

import "time"

// definir la entidad completa
type Proyects struct {
	ID int `json:"id"`
	Nombre string `json:"nombre"`
	FechaCreacion time.Time `json:"fecha_creacion"`
	Eliminado bool `json:"elminado"`
	Descripcion string `json:"descripcion"`
	Comentario string `json:"comentario"`
	UserID int `json:"user_id"`
	Estado string `json:"estado"`
}

// definir los datos que se espera recibir la creacion de un proyecto
type ProyectRequest struct {
	Nombre string `json:"nombre"`
	Descripcion string `json:"descripcion"`
	Comentario string `json:"comentario"`
	UserID int `json:"user_id"`
} 

// datos que devuelva la creacion de un proyecto
type ProyectResponse struct{
	ID int `json:"id"`
	Nombre string `json:"nombre"`
	Descripcion string `json:"descripcion"`
	Comentario string `json:"comentario"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

