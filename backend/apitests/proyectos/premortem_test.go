package proyectos

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
)

// El pre-mortem se guarda al crear, se lee en todos los listados y se puede editar;
// es texto libre, así que el registro de eventos no copia su contenido.
func TestPremortem(t *testing.T) {
	api, ana, _ := setup(t)
	const temor = "temor-privado-se-me-acaba-el-tiempo"
	p := crearProyecto(t, api, ana, "Mudanza", map[string]any{"premortem": temor})
	if p.Premortem != temor {
		t.Errorf("POST: premortem = %q", p.Premortem)
	}
	if got := getProyecto(t, api, ana, p.ID); got.Premortem != temor {
		t.Errorf("GET: premortem = %q", got.Premortem)
	}

	sin := crearProyecto(t, api, ana, "Sin premortem", nil)
	if sin.Premortem != "" {
		t.Errorf("sin premortem debe venir vacío: %q", sin.Premortem)
	}

	api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", p.ID), map[string]any{"premortem": "otro temor"}).
		Expect(t, http.StatusOK)
	if got := getProyecto(t, api, ana, p.ID); got.Premortem != "otro temor" {
		t.Errorf("PUT: premortem = %q", got.Premortem)
	}

	var cambios string
	err := api.DB.QueryRow(context.Background(),
		"SELECT string_agg(cambios::text, ' ') FROM eventos WHERE entidad = 'proyecto' AND entidad_id = $1", p.ID).Scan(&cambios)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(cambios, "temor") {
		t.Errorf("el registro de eventos copia el pre-mortem: %s", cambios)
	}
	if !strings.Contains(cambios, `"premortem": {"modificado": true}`) {
		t.Errorf("el cambio de pre-mortem debe registrarse como modificado: %s", cambios)
	}
}

func TestDocumentoRetrospectiva(t *testing.T) {
	api, ana, _ := setup(t)
	p := crearProyecto(t, api, ana, "Cerrado", nil)
	api.Do(ana, http.MethodPost, apitest.Path("/api/proyects/%d/documentos", p.ID), map[string]any{
		"titulo": "Retrospectiva", "contenido": "Aprendí…", "tipo": "retrospectiva",
	}).Expect(t, http.StatusCreated)
}
