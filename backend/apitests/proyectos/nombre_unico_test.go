package proyectos

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
)

// El nombre es único por usuario y solo entre proyectos activos.
func TestNombreDeProyectoUnicoPorUsuario(t *testing.T) {
	api, ana, _ := setup(t)
	body := proyectoBody
	pathProyecto := func(id int) string { return apitest.Path("/api/proyects/%d", id) }

	id := api.Do(ana, http.MethodPost, "/api/proyects", body("Mudanza")).Expect(t, http.StatusCreated).ID(t)
	api.Do(ana, http.MethodPost, "/api/proyects", body("Mudanza")).Expect(t, http.StatusConflict)

	otro := api.Do(ana, http.MethodPost, "/api/proyects", body("Viaje")).Expect(t, http.StatusCreated).ID(t)
	api.Do(ana, http.MethodPut, pathProyecto(otro), map[string]any{"nombre": "Mudanza"}).Expect(t, http.StatusConflict)

	// Tras borrarlo, el nombre se puede reutilizar.
	api.Do(ana, http.MethodDelete, pathProyecto(id), nil)
	api.Do(ana, http.MethodPost, "/api/proyects", body("Mudanza")).Expect(t, http.StatusCreated)
}
