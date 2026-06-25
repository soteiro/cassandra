package main

import (
	"fmt"
    "encoding/json"
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/cors"
)

func main() {
    r := chi.NewRouter()

    // CORS para Angular en desarrollo
    r.Use(cors.Handler(cors.Options{
        AllowedOrigins: []string{"http://localhost:4200"},
        AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
        AllowedHeaders: []string{"Content-Type", "Authorization"},
    }))
    fmt.Println("Server running on port 8080")
    
    r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    r.Get("/api/", func(w http.ResponseWriter, r*http.Request){
    json.NewEncoder(w).Encode((map[string]string{"response": "One Golang To Rule Them All"}))
    })

    http.ListenAndServe(":8080", r)
}