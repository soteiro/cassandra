package finanzas

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
	"cassandra/models"
)

// catalogo describe los tres catálogos simples (bancos, grupos, movimientos esperados),
// que comparten forma: {id, user_id, nombre, eliminado}.
type catalogo struct {
	nombre string
	path   string
	crear  func(t *testing.T, api *apitest.API, u *apitest.User, nombre string) int
}

var catalogos = []catalogo{
	{"bancos", pathBancos, func(t *testing.T, api *apitest.API, u *apitest.User, n string) int {
		return crearBanco(t, api, u, n, "debito").ID
	}},
	{"grupos", pathGrupos, func(t *testing.T, api *apitest.API, u *apitest.User, n string) int {
		return crearGrupo(t, api, u, n).ID
	}},
	{"movimientos-esperados", pathMovs, func(t *testing.T, api *apitest.API, u *apitest.User, n string) int {
		return crearMov(t, api, u, n).ID
	}},
}

type itemCatalogo struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Nombre    string `json:"nombre"`
	Eliminado bool   `json:"eliminado"`
}

func getCatalogo(t *testing.T, api *apitest.API, u *apitest.User, path string, id int) itemCatalogo {
	t.Helper()
	var v itemCatalogo
	api.Do(u, http.MethodGet, apitest.Path("%s/%d", path, id), nil).Expect(t, http.StatusOK).JSON(t, &v)
	return v
}

// B no puede ver, listar, editar ni borrar catálogos de A; lo de A queda intacto.
func TestAislamiento_Catalogos(t *testing.T) {
	for _, c := range catalogos {
		t.Run(c.nombre, func(t *testing.T) {
			api, a, b := setup(t)
			idA := c.crear(t, api, a, nombreSecret)
			c.crear(t, api, b, "propio-de-beto")

			expectDenegado(t, api.Do(b, http.MethodGet, apitest.Path("%s/%d", c.path, idA), nil), "GET ajeno")

			var lista []itemCatalogo
			res := api.Do(b, http.MethodGet, c.path, nil).Expect(t, http.StatusOK)
			res.JSON(t, &lista)
			if len(lista) != 1 || lista[0].Nombre != "propio-de-beto" {
				t.Errorf("listado de B = %+v; se esperaba solo su propio ítem", lista)
			}
			if strings.Contains(string(res.Body), nombreSecret) {
				t.Errorf("el listado de B filtra datos de A: %s", res.Body)
			}

			put := api.Do(b, http.MethodPut, apitest.Path("%s/%d", c.path, idA), map[string]any{"nombre": "hackeado"})
			expectNo2xx(t, put, "PUT ajeno")
			if strings.Contains(string(put.Body), nombreSecret) {
				t.Errorf("PUT ajeno filtra datos de A: %s", put.Body)
			}
			expectNo2xx(t, api.Do(b, http.MethodPut, apitest.Path("%s/%d", c.path, idA), map[string]any{"eliminado": true}), "PUT eliminado ajeno")
			expectNo2xx(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", c.path, idA), nil), "DELETE ajeno")

			got := getCatalogo(t, api, a, c.path, idA)
			if got.Nombre != nombreSecret || got.Eliminado || got.UserID != a.ID {
				t.Errorf("el recurso de A fue modificado por B: %+v", got)
			}
		})
	}
}

// Igual que el anterior, pero exige el código correcto (403/404) en PUT/DELETE ajeno.
func TestAislamiento_Catalogos_CodigoPutDeleteAjeno(t *testing.T) {
	for _, c := range catalogos {
		t.Run(c.nombre, func(t *testing.T) {
			api, a, b := setup(t)
			idA := c.crear(t, api, a, nombreSecret)
			expectDenegado(t, api.Do(b, http.MethodPut, apitest.Path("%s/%d", c.path, idA), map[string]any{"nombre": "x"}), "PUT ajeno")
			expectDenegado(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", c.path, idA), nil), "DELETE ajeno")
		})
	}
}

func TestAislamiento_Plantilla(t *testing.T) {
	api, a, b := setup(t)
	bancoA := crearBanco(t, api, a, nombreSecret, "credito")
	itA := crearItem(t, api, a, "ingreso", 1_000_000, 2026, 3, map[string]any{"nombre": nombreSecret, "banco_id": bancoA.ID})
	crearItem(t, api, a, "egreso", 400_000, 2026, 3, nil)
	crearItem(t, api, b, "egreso", 50, 2026, 3, map[string]any{"nombre": "cafe-beto"})

	expectDenegado(t, api.Do(b, http.MethodGet, apitest.Path("%s/%d", pathPlant, itA.ID), nil), "GET ítem ajeno")

	itemsB := plantilla(t, api, b, 2026, 3)
	if len(itemsB) != 1 || itemsB[0].Nombre != "cafe-beto" {
		t.Errorf("plantilla de B = %+v; se esperaba solo su ítem", itemsB)
	}

	r := resumen(t, api, b, 2026, 3)
	if r.TotalIngresos != 0 || r.TotalEgresos != 50 || r.Balance != -50 {
		t.Errorf("resumen de B incluye montos ajenos: %+v", r)
	}

	put := api.Do(b, http.MethodPut, apitest.Path("%s/%d", pathPlant, itA.ID), map[string]any{"monto": 1, "estado": "completado"})
	expectNo2xx(t, put, "PUT ítem ajeno")
	if strings.Contains(string(put.Body), nombreSecret) {
		t.Errorf("PUT ajeno filtra datos: %s", put.Body)
	}
	expectNo2xx(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", pathPlant, itA.ID), nil), "DELETE ítem ajeno")

	var got models.FinanzasPlantillaResponse
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathPlant, itA.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Monto != 1_000_000 || got.Estado != "pendiente" || got.Eliminado {
		t.Errorf("ítem de A modificado por B: %+v", got)
	}
	ra := resumen(t, api, a, 2026, 3)
	if ra.TotalIngresos != 1_000_000 || ra.TotalEgresos != 400_000 || ra.Balance != 600_000 {
		t.Errorf("resumen de A = %+v", ra)
	}
}

func TestAislamiento_Plantilla_CodigoPutDeleteAjeno(t *testing.T) {
	api, a, b := setup(t)
	itA := crearItem(t, api, a, "ingreso", 10, 2026, 3, nil)
	expectDenegado(t, api.Do(b, http.MethodPut, apitest.Path("%s/%d", pathPlant, itA.ID), map[string]any{"monto": 1}), "PUT ajeno")
	expectDenegado(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", pathPlant, itA.ID), nil), "DELETE ajeno")
}

// B no debe poder crear un ítem que apunte a banco/grupo/movimiento de A: además de
// mezclar datos, la respuesta (JOIN) le devolvería los nombres de A.
func TestAislamiento_Plantilla_CrearConReferenciasAjenas(t *testing.T) {
	api, a, b := setup(t)
	bancoA := crearBanco(t, api, a, nombreSecret, "debito")
	grupoA := crearGrupo(t, api, a, nombreSecret)
	movA := crearMov(t, api, a, nombreSecret)

	for campo, id := range map[string]int{"banco_id": bancoA.ID, "grupo_item_id": grupoA.ID, "movimiento_esperado_id": movA.ID} {
		res := api.Do(b, http.MethodPost, pathPlant, map[string]any{
			"nombre": "x", "tipo": "egreso", "monto": 1, "anio": 2026, "mes": 3, campo: id,
		})
		expect4xx(t, res, "POST con "+campo+" ajeno")
		if strings.Contains(string(res.Body), nombreSecret) {
			t.Errorf("POST con %s ajeno filtra el nombre de A: %s", campo, res.Body)
		}
	}
	if items := plantilla(t, api, b, 2026, 3); len(items) != 0 {
		t.Errorf("se crearon ítems con referencias ajenas: %+v", items)
	}
}

func TestAislamiento_Plantilla_EditarConReferenciasAjenas(t *testing.T) {
	api, a, b := setup(t)
	bancoA := crearBanco(t, api, a, nombreSecret, "debito")
	grupoA := crearGrupo(t, api, a, nombreSecret)
	movA := crearMov(t, api, a, nombreSecret)
	itB := crearItem(t, api, b, "egreso", 1, 2026, 3, nil)

	for campo, id := range map[string]int{"banco_id": bancoA.ID, "grupo_item_id": grupoA.ID, "movimiento_esperado_id": movA.ID} {
		res := api.Do(b, http.MethodPut, apitest.Path("%s/%d", pathPlant, itB.ID), map[string]any{campo: id})
		expect4xx(t, res, "PUT con "+campo+" ajeno")
		if strings.Contains(string(res.Body), nombreSecret) {
			t.Errorf("PUT con %s ajeno filtra el nombre de A: %s", campo, res.Body)
		}
	}
	var got models.FinanzasPlantillaResponse
	api.Do(b, http.MethodGet, apitest.Path("%s/%d", pathPlant, itB.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.BancoID != nil || got.GrupoItemID != nil || got.MovimientoEsperadoID != nil {
		t.Errorf("el ítem de B quedó apuntando a recursos de A: %+v", got)
	}
}

// Clonar es por usuario: B clonando un período donde solo A tiene datos no copia nada.
func TestAislamiento_Clonar(t *testing.T) {
	api, a, b := setup(t)
	crearItem(t, api, a, "ingreso", 999, 2026, 5, map[string]any{"nombre": nombreSecret})

	var out struct {
		RegistrosClonados int `json:"registros_clonados"`
	}
	api.Do(b, http.MethodPost, pathClonar, map[string]any{"anio_origen": 2026, "mes_origen": 5, "anio_destino": 2026, "mes_destino": 6}).
		Expect(t, http.StatusOK).JSON(t, &out)
	if out.RegistrosClonados != 0 {
		t.Errorf("B clonó %d registros de A", out.RegistrosClonados)
	}
	if items := plantilla(t, api, b, 2026, 6); len(items) != 0 {
		t.Errorf("B tiene ítems en destino: %+v", items)
	}
	if items := plantilla(t, api, a, 2026, 6); len(items) != 0 {
		t.Errorf("la clonación de B creó ítems para A: %+v", items)
	}
	if items := plantilla(t, api, a, 2026, 5); len(items) != 1 || items[0].Nombre != nombreSecret {
		t.Errorf("origen de A alterado: %+v", items)
	}
}

func TestAislamiento_Deseos(t *testing.T) {
	api, a, b := setup(t)
	grupoA := crearGrupo(t, api, a, "grupo-ana")
	dA := crearDeseo(t, api, a, map[string]any{"nombre": nombreSecret, "presupuesto": 500, "grupo_item_finanzas_id": grupoA.ID})
	crearDeseo(t, api, b, map[string]any{"nombre": "deseo-beto"})

	expectDenegado(t, api.Do(b, http.MethodGet, apitest.Path("%s/%d", pathDeseos, dA.ID), nil), "GET deseo ajeno")

	for _, q := range []string{"", "?comprado=false", apitest.Path("?grupo_id=%d", grupoA.ID)} {
		var lista []models.ListaDeseosResponse
		res := api.Do(b, http.MethodGet, pathDeseos+q, nil).Expect(t, http.StatusOK)
		res.JSON(t, &lista)
		for _, d := range lista {
			if d.UserID != b.ID {
				t.Errorf("listado %q de B incluye deseo ajeno: %+v", q, d)
			}
		}
		if strings.Contains(string(res.Body), nombreSecret) {
			t.Errorf("listado %q de B filtra datos de A: %s", q, res.Body)
		}
	}

	expectDenegado(t, api.Do(b, http.MethodPut, apitest.Path("%s/%d", pathDeseos, dA.ID), map[string]any{"nombre": "hackeado", "comprado": true}), "PUT deseo ajeno")
	expectNo2xx(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", pathDeseos, dA.ID), nil), "DELETE deseo ajeno")

	var got models.ListaDeseosResponse
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, dA.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Nombre != nombreSecret || got.Comprado || got.Eliminado {
		t.Errorf("deseo de A modificado por B: %+v", got)
	}
}

func TestAislamiento_Deseos_CodigoDeleteAjeno(t *testing.T) {
	api, a, b := setup(t)
	dA := crearDeseo(t, api, a, map[string]any{"nombre": "x"})
	expectDenegado(t, api.Do(b, http.MethodDelete, apitest.Path("%s/%d", pathDeseos, dA.ID), nil), "DELETE ajeno")
}

func TestAislamiento_Deseos_GrupoAjeno(t *testing.T) {
	api, a, b := setup(t)
	grupoA := crearGrupo(t, api, a, nombreSecret)

	res := api.Do(b, http.MethodPost, pathDeseos, map[string]any{"nombre": "x", "grupo_item_finanzas_id": grupoA.ID})
	expect4xx(t, res, "POST deseo con grupo ajeno")
	if strings.Contains(string(res.Body), nombreSecret) {
		t.Errorf("POST filtra el nombre del grupo de A: %s", res.Body)
	}

	dB := crearDeseo(t, api, b, map[string]any{"nombre": "propio"})
	res = api.Do(b, http.MethodPut, apitest.Path("%s/%d", pathDeseos, dB.ID), map[string]any{"grupo_item_finanzas_id": grupoA.ID})
	expect4xx(t, res, "PUT deseo con grupo ajeno")
	if strings.Contains(string(res.Body), nombreSecret) {
		t.Errorf("PUT filtra el nombre del grupo de A: %s", res.Body)
	}
}
