package config

import (
	"fmt"
	"net/netip"
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
	// Proxies de los que se acepta X-Real-IP (TRUSTED_PROXIES; por defecto localhost).
	TrustedProxies []netip.Prefix
}

// DefaultTrustedProxies: nginx en el mismo servidor.
var DefaultTrustedProxies = []string{"127.0.0.0/8", "::1/128"}

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

	jwtSecret, err := validateJWTSecret(os.Getenv("JWT_SECRET"))
	if err != nil {
		return nil, err
	}
	trustedProxies, err := parseTrustedProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		return nil, err
	}

	return &Config{
		DatabaseUrl: getEnv("DATABASE_URL_LOCAL", "postgres://localhost:5432/db"),
		Port: getEnv("PORT", "8080"),
		JwtSecret: jwtSecret,
		RateLimitPerMin: getEnvInt("RATE_LIMIT_PER_MIN", 100),
		AllowedOrigins: allowedOrigins(os.Getenv("ALLOWED_ORIGINS")),
		TrustedProxies: trustedProxies,
		}, nil
	}


// MinJWTSecretLength: 32 bytes (256 bits), el tamaño de clave de HS256.
const MinJWTSecretLength = 32

// validateJWTSecret exige un secreto propio: sin valor por defecto (el código es
// público) y lo bastante largo para que no se pueda adivinar ni falsificar sesiones.
func validateJWTSecret(secret string) (string, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET no está definido; genera uno con: openssl rand -base64 48")
	}
	if len(secret) < MinJWTSecretLength {
		return "", fmt.Errorf("JWT_SECRET debe tener al menos %d caracteres (tiene %d); genera uno con: openssl rand -base64 48", MinJWTSecretLength, len(secret))
	}
	return secret, nil
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

// parseTrustedProxies lee IPs o CIDR separados por comas; vacío = DefaultTrustedProxies.
func parseTrustedProxies(value string) ([]netip.Prefix, error) {
	items := strings.Split(value, ",")
	if strings.TrimSpace(value) == "" {
		items = DefaultTrustedProxies
	}
	var prefixes []netip.Prefix
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if !strings.Contains(item, "/") {
			addr, err := netip.ParseAddr(item)
			if err != nil {
				return nil, fmt.Errorf("TRUSTED_PROXIES: %q no es una IP ni un CIDR válido", item)
			}
			prefixes = append(prefixes, netip.PrefixFrom(addr.Unmap(), addr.Unmap().BitLen()))
			continue
		}
		p, err := netip.ParsePrefix(item)
		if err != nil {
			return nil, fmt.Errorf("TRUSTED_PROXIES: %q no es una IP ni un CIDR válido", item)
		}
		prefixes = append(prefixes, p.Masked())
	}
	return prefixes, nil
}
