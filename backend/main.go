package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"cassandra/config"
	"cassandra/database"
	"cassandra/handlers"
	"cassandra/middleware"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
)

//go:embed dist/*
var frontendFS embed.FS

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
	tareasRepo := repository.NewTareasRepository(dbPool)
	tareasHandler := handlers.NewTareasHandler(tareasRepo)
	logsRepo := repository.NewLogsRepository(dbPool)
	logsHandler := handlers.NewLogsHandler(logsRepo)
	notasProyectoRepo := repository.NewNotasProyectoRepository(dbPool)
	notasProyectoHandler := handlers.NewNotasProyectoHandler(notasProyectoRepo)
	personaRepo := repository.NewPersonaRepository(dbPool)
	personaHandler := handlers.NewPersonaHandler(personaRepo)
	interaccionesRepo := repository.NewInteraccionesRepository(dbPool)
	interaccionesHandler := handlers.NewInteraccionesHandler(interaccionesRepo)

	// 5. Configurar el Router HTTP
	r := chi.NewRouter()

	// Middlewares globales (DEBEN definirse antes de registrar cualquier ruta)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:4200"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	r.Use(httprate.LimitByIP(100, time.Minute))

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

	// 6. Rutas de la Entidad de Usuarios
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
		r.Get("/api/proyects/{id}/subproyectos", proyectHandler.GetSubproyectos)
		r.Put("/api/proyects/{id}", proyectHandler.Update)

		// Rutas de Tareas Protegidas
		r.Post("/api/tareas", tareasHandler.CreateTarea)
		r.Get("/api/tareas", tareasHandler.GetAllTareas)
		r.Get("/api/tareas/{id}", tareasHandler.GetTareaByID)
		r.Put("/api/tareas/{id}", tareasHandler.UpdateTarea)
		r.Delete("/api/tareas/{id}", tareasHandler.DeleteTarea)
		r.Get("/api/proyects/{proyect_id}/tareas", tareasHandler.GetTareasByProyecto)

		// Rutas de Logs en Crudo de Proyectos
		r.Post("/api/proyects/{proyect_id}/logs", logsHandler.CreateLog)
		r.Get("/api/proyects/{proyect_id}/logs", logsHandler.GetLogsByProyecto)
		r.Get("/api/logs/{id}", logsHandler.GetLogByID)
		r.Put("/api/logs/{id}", logsHandler.UpdateLog)
		r.Delete("/api/logs/{id}", logsHandler.DeleteLog)

		// Rutas de Notas de Proyectos
		r.Post("/api/proyects/{proyect_id}/notas", notasProyectoHandler.Create)
		r.Get("/api/proyects/{proyect_id}/notas", notasProyectoHandler.GetByProyectoID)
		r.Get("/api/notas", notasProyectoHandler.GetAll)
		r.Get("/api/notas/{id}", notasProyectoHandler.GetByID)
		r.Put("/api/notas/{id}", notasProyectoHandler.Update)
		r.Delete("/api/notas/{id}", notasProyectoHandler.Delete)
		
		// Rutas de Personas
		r.Post("/api/personas", personaHandler.Create)
		r.Get("/api/personas", personaHandler.GetAll)
		r.Get("/api/personas/{id}", personaHandler.GetByID)
		r.Put("/api/personas/{id}", personaHandler.Update)
		r.Delete("/api/personas/{id}", personaHandler.Delete)

		// Rutas de Interacciones de Personas
		r.Post("/api/personas/{persona_id}/interacciones", interaccionesHandler.Create)
		r.Get("/api/personas/{persona_id}/interacciones", interaccionesHandler.GetByPersonaID)
		r.Post("/api/interacciones", interaccionesHandler.Create)
		r.Get("/api/interacciones", interaccionesHandler.GetAll)
		r.Get("/api/interacciones/{id}", interaccionesHandler.GetByID)
		r.Put("/api/interacciones/{id}", interaccionesHandler.Update)
		r.Delete("/api/interacciones/{id}", interaccionesHandler.Delete)
	})


	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)
	r.Post("/api/auth/logout", authHandler.Logout)
	r.Get("/api/auth/me", authHandler.Me)

	// 7. Servidor de Archivos Estáticos y Fallback SPA (DEBE ir al final de las rutas)
	distFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		log.Fatalf("error al cargar frontend embebido: %v", err)
	}

	fileServer := http.FileServer(http.FS(distFS))

	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Si la petición es hacia la API y no coincidió con ninguna ruta anterior
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Comprobar si el archivo solicitado existe (ej: favicon.ico, main.js, styles.css)
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if f, err := distFS.Open(path); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Si no es un archivo estático, entregar index.html (SPA Fallback)
		indexFile, err := distFS.Open("index.html")
		if err != nil {
			http.Error(w, "index.html no encontrado", http.StatusInternalServerError)
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
	}))

	fmt.Println("Server running on port 8080")
	http.ListenAndServe(":8080", r)
}
