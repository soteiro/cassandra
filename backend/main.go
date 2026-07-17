package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"cassandra/config"
	"cassandra/database"
	"cassandra/handlers"
	"cassandra/middleware"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func main() {
	// 1. Cargar configuración
	cfg, err := config.Load()
	if err != nil {
		log.Fatalln("error al cargar las env")
	}

	// 2. Conectar a PostgreSQL
	dbPool, err := database.Connect(cfg.DatabaseUrl)
	if err != nil {
		log.Fatalf("error al conectar el pool: %v", err)
	}
	defer dbPool.Close()

	// 3. Ejecutar migraciones
	if err := database.RunMigrations(cfg.DatabaseUrl); err != nil {
		log.Fatalf("error al ejecutar las migraciones: %v", err)
	}

	// 4. Inicializar Capas (Inyección de Dependencias)
	userRepo := repository.NewUserRepository(dbPool)
	userHandler := handlers.NewUserHandler(userRepo)
	authRepo := repository.NewAuthRepository(dbPool)
	authHandler := handlers.NewAuthHandler(userRepo, authRepo, cfg.JwtSecret)
	projectRepo := repository.NewProyectRepository(dbPool)
	proyectHandler := handlers.NewProyectHandler(projectRepo)

	// 5. Configurar el Router HTTP
	r := chi.NewRouter()

	// CORS para desarrollo con Angular
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:4200"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	// Rutas de prueba
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Get("/api/db-time", func(w http.ResponseWriter, r *http.Request) {
		var currentTime time.Time
		err := database.DB.QueryRow(r.Context(), "select now()").Scan(&currentTime)
		if err != nil {
			http.Error(w, "error al consultar la base de datos: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "hola desde la base de datos",
			"db_time": currentTime,
		})
	})

	r.Get("/api/db-version", func(w http.ResponseWriter, r *http.Request) {
		var version string
		err := database.DB.QueryRow(r.Context(), "SELECT version()").Scan(&version)
		if err != nil {
			http.Error(w, "Error al obtener la version de la base de datos: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":    "holaaa",
			"status":     "ok",
			"version_db": version,
		})
	})

	// 6. Rutas de la Entidad de Usuarios (usando nuestro Handler)
	r.Post("/api/users", userHandler.CreateUser)

	r.Get("/api/", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"response": "One Golang To Rule Them All"})
	})
	// Grupo de rutas protegidas
	r.Group(func(r chi.Router) {
		// Aplicamos el middleware de autenticación a este grupo
		r.Use(middleware.AuthMiddleware(cfg.JwtSecret))
		r.Get("/api/users", userHandler.ListUsers)
		r.Get("/api/users/{id}", userHandler.GetUser)
		r.Put("/api/users/{id}", userHandler.UpdateUser)
		r.Delete("/api/users/{id}", userHandler.DeleteUser)
		r.Post("/api/proyects", proyectHandler.CreateProyect)
		r.Get("/api/proyects", proyectHandler.ListProyect)
		r.Delete("/api/proyects/{id}", proyectHandler.DeleteByID)
		r.Get("/api/proyects/{id}", proyectHandler.GetByID)
		r.Put("/api/proyects/{id}", proyectHandler.Update)
	})

	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)

	fmt.Println("Server running on port 8080")
	http.ListenAndServe(":8080", r)
}
