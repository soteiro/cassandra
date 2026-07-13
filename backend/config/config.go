package config

import (
	"log"
	"os"
	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseUrl string
	Port string
	JwtSecret string
}

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("error cargando las env, usando variables del sistema")
	}

	return &Config{
		DatabaseUrl: getEnv("DATABASE_URL_LOCAL", "postgres://localhost:5432/db"),
		Port: getEnv("PORT", "8080"),
		JwtSecret: getEnv("JWT_SECRET", "jtwsecretlasjkndlaskndlakmd"),
		}, nil
	}


func getEnv(key, fallback string) string {
		if value, ok := os.LookupEnv(key); ok {
			return value
		}
		return fallback
	}
