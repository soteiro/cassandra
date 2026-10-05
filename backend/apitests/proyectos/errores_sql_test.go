package proyectos

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
)

// Los errores internos no deben devolver detalles de la base de datos al cliente.
func TestErroresNoExponenSQL(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Proyecto", nil)

	casos := []*apitest.Response{
		api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{"nombre": "x", "proyect_id": p.ID, "estado": "no-existe"}),
		api.Do(ana, http.MethodPut, "/api/tareas/999999", map[string]any{"nombre": "x"}),
		api.Do(ana, http.MethodPost, "/api/finanzas/bancos", map[string]any{"nombre": "b", "tipo": "prepago"}),
	}
	for _, res := range casos {
		body := strings.ToLower(string(res.Body))
		for _, filtrado := range []string{"sqlstate", "viola", "violates", "no rows in result set", "constraint", "restricción"} {
			if strings.Contains(body, filtrado) {
				t.Errorf("respuesta %d expone detalles internos (%q): %s", res.Status, filtrado, res.Body)
			}
		}
	}
}
