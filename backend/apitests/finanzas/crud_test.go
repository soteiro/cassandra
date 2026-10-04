package finanzas

import (
	"net/http"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

func TestCRUD_Bancos(t *testing.T) {
	api, a, _ := setup(t)

	// tipo vacío => efectivo; tipo en mayúsculas se normaliza.
	b1 := crearBanco(t, api, a, "  Santander  ", "")
	if b1.Nombre != "Santander" || b1.Tipo != "efectivo" || b1.UserID != a.ID || b1.Eliminado {
		t.Errorf("banco creado = %+v", b1)
	}
	b2 := crearBanco(t, api, a, "Tenpo", "CREDITO")
	if b2.Tipo != "credito" {
		t.Errorf("tipo no normalizado: %q", b2.Tipo)
	}

	var lista []models.BancoResponse
	api.Do(a, http.MethodGet, pathBancos, nil).Expect(t, http.StatusOK).JSON(t, &lista)
	if len(lista) != 2 || lista[0].Nombre != "Santander" || lista[1].Nombre != "Tenpo" {
		t.Errorf("listado (orden por nombre) = %+v", lista)
	}

	// PUT parcial: solo cambia lo enviado.
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathBancos, b1.ID), map[string]any{"tipo": "debito"}).Expect(t, http.StatusOK)
	var got models.BancoResponse
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathBancos, b1.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Nombre != "Santander" || got.Tipo != "debito" {
		t.Errorf("tras PUT parcial = %+v", got)
	}
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathBancos, b1.ID), map[string]any{"nombre": " BCI "}).Expect(t, http.StatusOK)
	got = models.BancoResponse{}
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathBancos, b1.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Nombre != "BCI" || got.Tipo != "debito" {
		t.Errorf("tras PUT nombre = %+v", got)
	}

	// DELETE es borrado lógico: desaparece de GET y del listado, la fila sigue con eliminado=true.
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathBancos, b1.ID), nil).Expect(t, http.StatusOK)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathBancos, b1.ID), nil).Expect(t, http.StatusNotFound)
	api.Do(a, http.MethodGet, pathBancos, nil).Expect(t, http.StatusOK).JSON(t, &lista)
	if len(lista) != 1 || lista[0].ID != b2.ID {
		t.Errorf("listado tras borrar = %+v", lista)
	}
	assertSoftDeleted(t, api, "banco", b1.ID)
}

func TestCRUD_GruposYMovimientos(t *testing.T) {
	for _, c := range []struct {
		catalogo
		tabla string
	}{{catalogos[1], "grupo_item_finanzas"}, {catalogos[2], "movimiento_esperado_finanzas"}} {
		t.Run(c.nombre, func(t *testing.T) {
			api, a, _ := setup(t)
			id := c.crear(t, api, a, "  Hogar ")
			c.crear(t, api, a, "Auto")

			got := getCatalogo(t, api, a, c.path, id)
			if got.Nombre != "Hogar" || got.UserID != a.ID {
				t.Errorf("creado = %+v", got)
			}
			var lista []itemCatalogo
			api.Do(a, http.MethodGet, c.path, nil).Expect(t, http.StatusOK).JSON(t, &lista)
			if len(lista) != 2 || lista[0].Nombre != "Auto" {
				t.Errorf("listado (orden por nombre) = %+v", lista)
			}

			api.Do(a, http.MethodPut, apitest.Path("%s/%d", c.path, id), map[string]any{"nombre": "Casa"}).Expect(t, http.StatusOK)
			if got = getCatalogo(t, api, a, c.path, id); got.Nombre != "Casa" {
				t.Errorf("tras PUT = %+v", got)
			}

			api.Do(a, http.MethodDelete, apitest.Path("%s/%d", c.path, id), nil).Expect(t, http.StatusOK)
			api.Do(a, http.MethodGet, apitest.Path("%s/%d", c.path, id), nil).Expect(t, http.StatusNotFound)
			api.Do(a, http.MethodGet, c.path, nil).Expect(t, http.StatusOK).JSON(t, &lista)
			if len(lista) != 1 {
				t.Errorf("listado tras borrar = %+v", lista)
			}
			assertSoftDeleted(t, api, c.tabla, id)
		})
	}
}

func TestCRUD_Plantilla(t *testing.T) {
	api, a, _ := setup(t)
	banco := crearBanco(t, api, a, "Santander", "debito")
	grupo := crearGrupo(t, api, a, "Hogar")
	mov := crearMov(t, api, a, "pago yo")

	it := crearItem(t, api, a, "EGRESO", 350_000, 2026, 4, map[string]any{
		"nombre": " Arriendo ", "banco_id": banco.ID, "grupo_item_id": grupo.ID, "movimiento_esperado_id": mov.ID,
	})
	if it.Tipo != "egreso" || it.Estado != "pendiente" || it.Nombre != "Arriendo" || it.Monto != 350_000 ||
		it.UserID != a.ID || it.Mes != 4 || it.Anio != 2026 {
		t.Errorf("ítem creado = %+v", it)
	}
	if it.BancoNombre == nil || *it.BancoNombre != "Santander" || it.GrupoItemNombre == nil || *it.GrupoItemNombre != "Hogar" ||
		it.MovimientoEsperadoNombre == nil || *it.MovimientoEsperadoNombre != "pago yo" {
		t.Errorf("nombres relacionados no resueltos: %+v", it)
	}

	// Estado explícito al crear.
	it2 := crearItem(t, api, a, "ingreso", 1_000, 2026, 4, map[string]any{"estado": "En Proceso"})
	if it2.Estado != "en proceso" {
		t.Errorf("estado = %q", it2.Estado)
	}

	// PUT parcial y verificación con GET.
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathPlant, it.ID), map[string]any{"monto": 360_000, "estado": "completado"}).Expect(t, http.StatusOK)
	var got models.FinanzasPlantillaResponse
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathPlant, it.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Monto != 360_000 || got.Estado != "completado" || got.Nombre != "Arriendo" || got.Tipo != "egreso" ||
		got.BancoID == nil || *got.BancoID != banco.ID {
		t.Errorf("tras PUT = %+v", got)
	}

	// Mover de período con PUT.
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathPlant, it.ID), map[string]any{"mes": 5}).Expect(t, http.StatusOK)
	if items := plantilla(t, api, a, 2026, 4); len(items) != 1 || items[0].ID != it2.ID {
		t.Errorf("abril tras mover = %+v", items)
	}
	if items := plantilla(t, api, a, 2026, 5); len(items) != 1 || items[0].ID != it.ID {
		t.Errorf("mayo tras mover = %+v", items)
	}

	// DELETE lógico.
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathPlant, it.ID), nil).Expect(t, http.StatusOK)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathPlant, it.ID), nil).Expect(t, http.StatusNotFound)
	if items := plantilla(t, api, a, 2026, 5); len(items) != 0 {
		t.Errorf("mayo tras borrar = %+v", items)
	}
	assertSoftDeleted(t, api, "finanzas_plantilla", it.ID)
}

// Borrar (lógicamente) un banco no rompe los ítems que lo usan: siguen mostrando su nombre.
func TestPlantilla_BancoBorradoSigueReferenciado(t *testing.T) {
	api, a, _ := setup(t)
	banco := crearBanco(t, api, a, "Viejo", "debito")
	it := crearItem(t, api, a, "egreso", 10, 2026, 1, map[string]any{"banco_id": banco.ID})
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathBancos, banco.ID), nil).Expect(t, http.StatusOK)

	var got models.FinanzasPlantillaResponse
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathPlant, it.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.BancoID == nil || *got.BancoID != banco.ID || got.BancoNombre == nil || *got.BancoNombre != "Viejo" {
		t.Errorf("ítem tras borrar banco = %+v", got)
	}
}

func assertSoftDeleted(t *testing.T, api *apitest.API, tabla string, id int) {
	t.Helper()
	var eliminado bool
	err := api.DB.QueryRow(t.Context(), "SELECT eliminado FROM "+tabla+" WHERE id = $1", id).Scan(&eliminado)
	if err != nil {
		t.Fatalf("%s %d: la fila debería seguir existiendo (borrado lógico): %v", tabla, id, err)
	}
	if !eliminado {
		t.Errorf("%s %d: eliminado = false tras DELETE", tabla, id)
	}
}
