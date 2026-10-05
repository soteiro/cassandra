// Prueba del propio helper apitest; los tests de cada módulo viven en apitests/<módulo>.
package smoke

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
)

func TestHelper(t *testing.T) {
	api := apitest.New(t, "smoke")
	ana := api.User("ana@cassandra.test")

	api.Do(nil, http.MethodGet, "/api/proyects", nil).Expect(t, http.StatusUnauthorized)
	api.Do(ana, http.MethodGet, "/api/version", nil).Expect(t, http.StatusOK)

	var me struct {
		ID    int    `json:"id"`
		Email string `json:"email"`
	}
	api.Do(ana, http.MethodGet, apitest.Path("/api/users/%d", ana.ID), nil).Expect(t, http.StatusOK).JSON(t, &me)
	if me.ID != ana.ID || me.Email != "ana@cassandra.test" {
		t.Errorf("perfil = %+v", me)
	}
	api.Do(ana, http.MethodPost, "/api/proyects", "{json roto").Expect(t, http.StatusBadRequest)
}
