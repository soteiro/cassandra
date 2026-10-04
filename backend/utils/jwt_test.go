package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const secret = "test-secret"

func TestAccessTokenRoundTrip(t *testing.T) {
	token, err := GenerateAccessToken(42, secret)
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}
	id, err := ValidateAccessToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateAccessToken: %v", err)
	}
	if id != 42 {
		t.Errorf("user id = %d, se esperaba 42", id)
	}
}

func TestAccessTokenExpiresIn15Minutes(t *testing.T) {
	token, _ := GenerateAccessToken(1, secret)
	claims := &UserClaims{}
	if _, _, err := jwt.NewParser().ParseUnverified(token, claims); err != nil {
		t.Fatal(err)
	}
	ttl := time.Until(claims.ExpiresAt.Time)
	if ttl < 14*time.Minute || ttl > 15*time.Minute {
		t.Errorf("expiración en %v, se esperaban ~15m", ttl)
	}
}

func TestValidateAccessTokenRejects(t *testing.T) {
	sign := func(method jwt.SigningMethod, key any, claims UserClaims) string {
		s, err := jwt.NewWithClaims(method, claims).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	valid := UserClaims{UserID: 1, RegisteredClaims: jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}}
	expired := UserClaims{UserID: 1, RegisteredClaims: jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
	}}

	cases := map[string]string{
		"firma con otro secreto": sign(jwt.SigningMethodHS256, []byte("otro"), valid),
		"token expirado":         sign(jwt.SigningMethodHS256, []byte(secret), expired),
		"algoritmo none":         sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, valid),
		"texto basura":           "no-es-un-jwt",
		"vacío":                  "",
	}
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ValidateAccessToken(token, secret); err == nil {
				t.Error("se esperaba error")
			}
		})
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	a, err := GenerateRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := GenerateRefreshToken()
	if a == b {
		t.Error("dos refresh tokens no deberían ser iguales")
	}
	if len(a) != 44 { // 32 bytes en base64 URL
		t.Errorf("longitud = %d, se esperaba 44", len(a))
	}
}
