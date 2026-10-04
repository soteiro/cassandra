// Package server arma el router HTTP de Cassandra: middlewares, rutas de la API y el
// frontend embebido. Está separado de main para poder levantar la API completa en tests.
package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"cassandra/config"
	"cassandra/handlers"
	"cassandra/middleware"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Options reúne lo que necesita el router.
type Options struct {
	Config *config.Config
	DB     *pgxpool.Pool
	// Frontend es el build de Angular (raíz con index.html). nil: no se sirve frontend.
	Frontend fs.FS
	Version  string
}

// NewRouter construye el handler HTTP completo de la aplicación.
func NewRouter(opts Options) http.Handler {
	cfg, db := opts.Config, opts.DB

	// Inicializar Capas (Inyección de Dependencias)
	userRepo := repository.NewUserRepository(db)
	userHandler := handlers.NewUserHandler(userRepo)
	authRepo := repository.NewAuthRepository(db)
	authHandler := handlers.NewAuthHandler(userRepo, authRepo, cfg.JwtSecret)
	proyectHandler := handlers.NewProyectHandler(repository.NewProyectRepository(db))
	tareasHandler := handlers.NewTareasHandler(repository.NewTareasRepository(db))
	logsHandler := handlers.NewLogsHandler(repository.NewLogsRepository(db))
	notasProyectoHandler := handlers.NewNotasProyectoHandler(repository.NewNotasProyectoRepository(db))
	personaHandler := handlers.NewPersonaHandler(repository.NewPersonaRepository(db))
	interaccionesHandler := handlers.NewInteraccionesHandler(repository.NewInteraccionesRepository(db))
	reflexionesHandler := handlers.NewReflexionesHandler(repository.NewReflexionesRepository(db))
	finanzasHandler := handlers.NewFinanzasHandler(repository.NewFinanzasRepository(db))
	listaDeseosHandler := handlers.NewListaDeseosHandler(repository.NewListaDeseosRepository(db))
	documentosProyectoHandler := handlers.NewDocumentosProyectoHandler(repository.NewDocumentosProyectoRepository(db))

	r := chi.NewRouter()

	// Middlewares globales (DEBEN definirse antes de registrar cualquier ruta)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		// La web se sirve desde el mismo origen que la API; CORS solo hace falta para el
		// dev server de Angular, la app Capacitor y orígenes extra de ALLOWED_ORIGINS.
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Origin"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(httprate.LimitByIP(cfg.RateLimitPerMin, time.Minute))

	// Rutas públicas
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	r.Get("/api/version", VersionHandler(opts.Version))
	r.Get("/api/", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"response": "One Golang To Rule Them All"})
	})

	// Grupo de rutas protegidas
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(cfg.JwtSecret))

		// Las cuentas se crean desde la terminal del servidor (cassandra-app create-user).
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
		r.Get("/api/tareas/{tarea_id}/notas", notasProyectoHandler.GetByTareaID)
		r.Post("/api/tareas/{tarea_id}/notas", notasProyectoHandler.Create)
		r.Post("/api/notas", notasProyectoHandler.Create)
		r.Get("/api/notas", notasProyectoHandler.GetAll)
		r.Get("/api/notas/{id}", notasProyectoHandler.GetByID)
		r.Put("/api/notas/{id}", notasProyectoHandler.Update)
		r.Delete("/api/notas/{id}", notasProyectoHandler.Delete)

		// Rutas de Documentos de Proyectos
		r.Post("/api/proyects/{proyect_id}/documentos", documentosProyectoHandler.Create)
		r.Get("/api/proyects/{proyect_id}/documentos", documentosProyectoHandler.GetByProyectoID)
		r.Get("/api/documentos/{id}", documentosProyectoHandler.GetByID)
		r.Put("/api/documentos/{id}", documentosProyectoHandler.Update)
		r.Delete("/api/documentos/{id}", documentosProyectoHandler.Delete)

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

		// Rutas de Reflexiones
		r.Post("/api/reflexiones", reflexionesHandler.Create)
		r.Get("/api/reflexiones", reflexionesHandler.GetAll)
		r.Get("/api/reflexiones/{id}", reflexionesHandler.GetByID)
		r.Put("/api/reflexiones/{id}", reflexionesHandler.Update)
		r.Delete("/api/reflexiones/{id}", reflexionesHandler.Delete)

		// Rutas de Finanzas
		r.Post("/api/finanzas/bancos", finanzasHandler.CreateBanco)
		r.Get("/api/finanzas/bancos", finanzasHandler.GetBancos)
		r.Get("/api/finanzas/bancos/{id}", finanzasHandler.GetBancoByID)
		r.Put("/api/finanzas/bancos/{id}", finanzasHandler.UpdateBanco)
		r.Delete("/api/finanzas/bancos/{id}", finanzasHandler.DeleteBanco)

		r.Post("/api/finanzas/grupos", finanzasHandler.CreateGrupoItem)
		r.Get("/api/finanzas/grupos", finanzasHandler.GetGruposItems)
		r.Get("/api/finanzas/grupos/{id}", finanzasHandler.GetGrupoItemByID)
		r.Put("/api/finanzas/grupos/{id}", finanzasHandler.UpdateGrupoItem)
		r.Delete("/api/finanzas/grupos/{id}", finanzasHandler.DeleteGrupoItem)

		r.Post("/api/finanzas/movimientos-esperados", finanzasHandler.CreateMovimientoEsperado)
		r.Get("/api/finanzas/movimientos-esperados", finanzasHandler.GetMovimientosEsperados)
		r.Get("/api/finanzas/movimientos-esperados/{id}", finanzasHandler.GetMovimientoEsperadoByID)
		r.Put("/api/finanzas/movimientos-esperados/{id}", finanzasHandler.UpdateMovimientoEsperado)
		r.Delete("/api/finanzas/movimientos-esperados/{id}", finanzasHandler.DeleteMovimientoEsperado)

		r.Post("/api/finanzas/plantilla", finanzasHandler.CreatePlantilla)
		r.Get("/api/finanzas/plantilla", finanzasHandler.GetPlantillaByPeriodo)
		r.Get("/api/finanzas/plantilla/{id}", finanzasHandler.GetPlantillaByID)
		r.Put("/api/finanzas/plantilla/{id}", finanzasHandler.UpdatePlantilla)
		r.Delete("/api/finanzas/plantilla/{id}", finanzasHandler.DeletePlantilla)

		r.Get("/api/finanzas/resumen", finanzasHandler.GetResumenPeriodo)
		r.Post("/api/finanzas/clonar", finanzasHandler.ClonarPeriodo)

		// Rutas de Lista de Deseos
		r.Post("/api/lista-deseos", listaDeseosHandler.Create)
		r.Get("/api/lista-deseos", listaDeseosHandler.GetAll)
		r.Get("/api/lista-deseos/{id}", listaDeseosHandler.GetByID)
		r.Put("/api/lista-deseos/{id}", listaDeseosHandler.Update)
		r.Delete("/api/lista-deseos/{id}", listaDeseosHandler.Delete)
	})

	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)
	r.Post("/api/auth/logout", authHandler.Logout)
	r.Get("/api/auth/me", authHandler.Me)

	// Servidor de Archivos Estáticos y Fallback SPA (DEBE ir al final de las rutas)
	r.Handle("/*", spaHandler(opts.Frontend))

	return r
}

// VersionHandler expone la versión desplegada (deploy y botón de actualizaciones).
func VersionHandler(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"version": version})
	}
}

// spaHandler sirve los archivos del frontend y, para cualquier otra ruta que no sea de
// la API, index.html (las rutas las resuelve Angular).
func spaHandler(dist fs.FS) http.Handler {
	if dist == nil {
		return http.HandlerFunc(http.NotFound)
	}
	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Si la petición es hacia la API y no coincidió con ninguna ruta anterior
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Comprobar si el archivo solicitado existe (ej: favicon.ico, main.js, styles.css)
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if f, err := dist.Open(path); err == nil {
				stat, statErr := f.Stat()
				_ = f.Close()
				if statErr == nil && !stat.IsDir() {
					fileServer.ServeHTTP(w, r)
					return
				}
			}
		}

		// Si no es un archivo estático, entregar index.html (SPA Fallback)
		indexFile, err := dist.Open("index.html")
		if err != nil {
			http.Error(w, "index.html no encontrado", http.StatusInternalServerError)
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
	})
}
