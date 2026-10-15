package finanzas

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestDeseos_GastoReal(t *testing.T) {
	api, a, _ := setup(t)
	grupo := crearGrupo(t, api, a, "Tecnología")
	assertGasto := func(item models.ListaDeseosResponse, want *int) {
		t.Helper()
		if want == nil {
			if item.GastoReal != nil {
				t.Errorf("ítem %d: gasto_real = %d, se esperaba NULL", item.ID, *item.GastoReal)
			}
		} else if item.GastoReal == nil || *item.GastoReal != *want {
			t.Errorf("ítem %d: se esperaba gasto_real = %d, respuesta = %+v", item.ID, *want, item)
		}
	}

	esperados := make(map[int]*int)
	var id int
	for _, caso := range []struct {
		nombre string
		gasto  *int
	}{
		{"Sin gasto", nil},
		{"Gratis", ptr(0)},
		{"Pagado", ptr(75_000)},
	} {
		body := map[string]any{"nombre": caso.nombre, "grupo_item_finanzas_id": grupo.ID}
		if caso.gasto != nil {
			body["gasto_real"] = *caso.gasto
		}
		item := crearDeseo(t, api, a, body)
		assertGasto(item, caso.gasto)
		esperados[item.ID] = caso.gasto
		id = item.ID

		var got models.ListaDeseosResponse
		api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, item.ID), nil).
			Expect(t, http.StatusOK).JSON(t, &got)
		assertGasto(got, caso.gasto)
	}

	var lista []models.ListaDeseosResponse
	api.Do(a, http.MethodGet, pathDeseos, nil).Expect(t, http.StatusOK).JSON(t, &lista)
	if len(lista) != len(esperados) {
		t.Fatalf("listado = %d ítems, se esperaban %d", len(lista), len(esperados))
	}
	for _, item := range lista {
		want, ok := esperados[item.ID]
		if !ok {
			t.Fatalf("ítem inesperado en listado: %d", item.ID)
		}
		assertGasto(item, want)
		if item.GrupoItemFinanzasID == nil || *item.GrupoItemFinanzasID != grupo.ID ||
			item.GrupoItemFinanzasNombre == nil || *item.GrupoItemFinanzasNombre != grupo.Nombre || item.Eliminado {
			t.Errorf("columnas del listado incorrectas: %+v", item)
		}
	}

	for _, caso := range []struct {
		body map[string]any
		want int
	}{
		{map[string]any{"gasto_real": 90_000}, 90_000},
		{map[string]any{"nombre": "Renombrado"}, 90_000},
		{map[string]any{"gasto_real": 0}, 0},
	} {
		var updated models.ListaDeseosResponse
		path := apitest.Path("%s/%d", pathDeseos, id)
		api.Do(a, http.MethodPut, path, caso.body).Expect(t, http.StatusOK).JSON(t, &updated)
		assertGasto(updated, &caso.want)

		var persisted models.ListaDeseosResponse
		api.Do(a, http.MethodGet, path, nil).Expect(t, http.StatusOK).JSON(t, &persisted)
		assertGasto(persisted, &caso.want)
	}
}
