package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseUrl string
	Port string
	JwtSecret string
	// Peticiones máximas por IP y minuto. Se sube en los tests e2e.
	RateLimitPerMin int
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
