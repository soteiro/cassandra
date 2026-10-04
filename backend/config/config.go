package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseUrl string
	Port string
	JwtSecret string
	// Peticiones máximas por IP y minuto. Se sube en los tests e2e.
	RateLimitPerMin int
	// Orígenes CORS: los de desarrollo y la app Capacitor, más ALLOWED_ORIGINS.
	AllowedOrigins []string
}

// DefaultAllowedOrigins cubre el dev server de Angular y la app Android (Capacitor).
// La web desplegada no los necesita: se sirve desde el mismo origen que la API.
var DefaultAllowedOrigins = []string{
	"http://localhost:4200",
	"http://localhost",
	"https://localhost",
	"capacitor://localhost",
	"http://localhost:8080",
}

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("error cargando las env, usando variables del sistema")
	}

	return &Config{
		DatabaseUrl: getEnv("DATABASE_URL_LOCAL", "postgres://localhost:5432/db"),
		Port: getEnv("PORT", "8080"),
		JwtSecret: getEnv("JWT_SECRET", "jtwsecretlasjkndlaskndlakmd"),
		RateLimitPerMin: getEnvInt("RATE_LIMIT_PER_MIN", 100),
		AllowedOrigins: allowedOrigins(os.Getenv("ALLOWED_ORIGINS")),
		}, nil
	}


func getEnv(key, fallback string) string {
		if value, ok := os.LookupEnv(key); ok {
			return value
		}
		return fallback
	}


func getEnvInt(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		log.Printf("valor inválido para %s=%q, usando %d", key, value, fallback)
		return fallback
	}
	return n
}

// allowedOrigins agrega a los orígenes por defecto los de extra (separados por comas).
func allowedOrigins(extra string) []string {
	origins := append([]string{}, DefaultAllowedOrigins...)
	for _, o := range strings.Split(extra, ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
