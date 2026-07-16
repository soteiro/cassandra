package models

import (
	"time"
)

type LoginRequest struct {
	Email string `json:"email"`
	Password string `json:"password"`
}

//tokenResponse, envia de vuelta tras un login o un refresh exitoso
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type RefreshToken struct {
	ID int `json:"id"`
	UserID int `json:"user_id"`
	Token string `json:"token"`
	ExpiraEn time.Time `json:"expira_en"`
	CreadoEn time.Time `json:"creado_en"`
}

