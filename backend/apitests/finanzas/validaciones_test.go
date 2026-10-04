package finanzas

import (
	"net/http"
	"strings"
	"testing"

	"cassandra/internal/apitest"
)

func TestSinToken_401(t *testing.T) {
	api, _, _ := setup(t)
	rutas := []struct{ method, path string }{
		{http.MethodGet, pathBancos}, {http.MethodPost, pathBancos}, {http.MethodGet, pathBancos + "/1"},
		{http.MethodPut, pathBancos + "/1"}, {http.MethodDelete, pathBancos + "/1"},
		{http.MethodGet, pathGrupos}, {http.MethodPost, pathGrupos}, {http.MethodGet, pathGrupos + "/1"},
		{http.MethodPut, pathGrupos + "/1"}, {http.MethodDelete, pathGrupos + "/1"},
		{http.MethodGet, pathMovs}, {http.MethodPost, pathMovs}, {http.MethodGet, pathMovs + "/1"},
		{http.MethodPut, pathMovs + "/1"}, {http.MethodDelete, pathMovs + "/1"},
		{http.MethodGet, pathPlant + "?anio=2026&mes=1"}, {http.MethodPost, pathPlant}, {http.MethodGet, pathPlant + "/1"},
		{http.MethodPut, pathPlant + "/1"}, {http.MethodDelete, pathPlant + "/1"},
		{http.MethodGet, pathResumen + "?anio=2026&mes=1"}, {http.MethodPost, pathClonar},
		{http.MethodGet, pathDeseos}, {http.MethodPost, pathDeseos}, {http.MethodGet, pathDeseos + "/1"},
		{http.MethodPut, pathDeseos + "/1"}, {http.MethodDelete, pathDeseos + "/1"},
	}
	for _, r := range rutas {
		api.Do(nil, r.method, r.path, nil).Expect(t, http.StatusUnauthorized)
	}
}

func TestValidaciones_JSONInvalido(t *testing.T) {
	api, a, _ := setup(t)
	banco := crearBanco(t, api, a, "B", "debito")
	grupo := crearGrupo(t, api, a, "G")
	mov := crearMov(t, api, a, "M")
	it := crearItem(t, api, a, "egreso", 1, 2026, 1, nil)
	d := crearDeseo(t, api, a, map[string]any{"nombre": "D"})

	for _, r := range []struct{ method, path string }{
		{http.MethodPost, pathBancos}, {http.MethodPut, apitest.Path("%s/%d", pathBancos, banco.ID)},
		{http.MethodPost, pathGrupos}, {http.MethodPut, apitest.Path("%s/%d", pathGrupos, grupo.ID)},
		{http.MethodPost, pathMovs}, {http.MethodPut, apitest.Path("%s/%d", pathMovs, mov.ID)},
		{http.MethodPost, pathPlant}, {http.MethodPut, apitest.Path("%s/%d", pathPlant, it.ID)},
		{http.MethodPost, pathClonar},
		{http.MethodPost, pathDeseos}, {http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID)},
	} {
		res := api.Do(a, r.method, r.path, "{json roto")
		if res.Status != http.StatusBadRequest {
			t.Errorf("%s %s con JSON roto: %d; cuerpo: %s", r.method, r.path, res.Status, res.Body)
		}
		// Tipos incorrectos también son JSON inválido para el decoder.
		res = api.Do(a, r.method, r.path, `{"nombre": 123, "mes": "x", "anio_origen": "x"}`)
		if res.Status != http.StatusBadRequest {
			t.Errorf("%s %s con tipos incorrectos: %d; cuerpo: %s", r.method, r.path, res.Status, res.Body)
		}
	}
}

func TestValidaciones_NombreObligatorio(t *testing.T) {
	api, a, _ := setup(t)
	banco := crearBanco(t, api, a, "B", "debito")
	grupo := crearGrupo(t, api, a, "G")
	mov := crearMov(t, api, a, "M")
	it := crearItem(t, api, a, "egreso", 1, 2026, 1, nil)
	d := crearDeseo(t, api, a, map[string]any{"nombre": "D"})

	for _, nombre := range []string{"", "   "} {
		for _, p := range []string{pathBancos, pathGrupos, pathMovs, pathDeseos} {
			api.Do(a, http.MethodPost, p, map[string]any{"nombre": nombre}).Expect(t, http.StatusBadRequest)
		}
		api.Do(a, http.MethodPost, pathPlant, map[string]any{"nombre": nombre, "tipo": "egreso", "anio": 2026, "mes": 1}).Expect(t, http.StatusBadRequest)

		for _, p := range []string{
			apitest.Path("%s/%d", pathBancos, banco.ID), apitest.Path("%s/%d", pathGrupos, grupo.ID),
			apitest.Path("%s/%d", pathMovs, mov.ID), apitest.Path("%s/%d", pathPlant, it.ID),
			apitest.Path("%s/%d", pathDeseos, d.ID),
		} {
			api.Do(a, http.MethodPut, p, map[string]any{"nombre": nombre}).Expect(t, http.StatusBadRequest)
		}
	}
	// Cuerpo vacío {} también falla por nombre ausente.
	api.Do(a, http.MethodPost, pathBancos, map[string]any{}).Expect(t, http.StatusBadRequest)
	if got := getCatalogo(t, api, a, pathBancos, banco.ID); got.Nombre != "B" {
		t.Errorf("banco modificado por PUT inválido: %+v", got)
	}
}

func TestValidaciones_TipoBanco(t *testing.T) {
	api, a, _ := setup(t)
	api.Do(a, http.MethodPost, pathBancos, map[string]any{"nombre": "x", "tipo": "cripto"}).Expect(t, http.StatusBadRequest)
	b := crearBanco(t, api, a, "x", "debito")
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathBancos, b.ID), map[string]any{"tipo": "cripto"}).Expect(t, http.StatusBadRequest)
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathBancos, b.ID), map[string]any{"tipo": ""}).Expect(t, http.StatusBadRequest)
	for _, tipo := range []string{"debito", "credito", "efectivo"} {
		crearBanco(t, api, a, "ok-"+tipo, tipo)
	}
}

// El handler anuncia y acepta 'prepago', pero el CHECK de la tabla banco no lo incluye.
func TestValidaciones_TipoBancoPrepago(t *testing.T) {
	bug(t, "tipo de banco 'prepago' pasa la validación del handler pero el CHECK de la BD lo rechaza: 500")
	api, a, _ := setup(t)
	res := api.Do(a, http.MethodPost, pathBancos, map[string]any{"nombre": "Tenpo", "tipo": "prepago"})
	if res.Status != http.StatusCreated && res.Status != http.StatusBadRequest {
		t.Errorf("POST banco prepago: %d (se esperaba 201 si se soporta o 400 si no); cuerpo: %s", res.Status, res.Body)
	}
	b := crearBanco(t, api, a, "x", "debito")
	res = api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathBancos, b.ID), map[string]any{"tipo": "prepago"})
	if res.Status != http.StatusOK && res.Status != http.StatusBadRequest {
		t.Errorf("PUT banco prepago: %d; cuerpo: %s", res.Status, res.Body)
	}
}

func TestValidaciones_Plantilla(t *testing.T) {
	api, a, _ := setup(t)
	base := func(over map[string]any) map[string]any {
		m := map[string]any{"nombre": "x", "tipo": "egreso", "monto": 1, "anio": 2026, "mes": 6}
		for k, v := range over {
			m[k] = v
		}
		return m
	}
	casos := map[string]map[string]any{
		"tipo vacío":      {"tipo": ""},
		"tipo inválido":   {"tipo": "transferencia"},
		"estado inválido": {"estado": "pagado"},
		"mes 0":           {"mes": 0},
		"mes 13":          {"mes": 13},
		"mes negativo":    {"mes": -1},
		"anio 2000":       {"anio": 2000},
		"anio ausente":    {"anio": 0},
	}
	for nombre, over := range casos {
		res := api.Do(a, http.MethodPost, pathPlant, base(over))
		if res.Status != http.StatusBadRequest {
			t.Errorf("POST %s: %d; cuerpo: %s", nombre, res.Status, res.Body)
		}
	}

	it := crearItem(t, api, a, "egreso", 1, 2026, 6, nil)
	putCasos := map[string]map[string]any{
		"tipo inválido":   {"tipo": "x"},
		"estado inválido": {"estado": "x"},
		"mes 0":           {"mes": 0},
		"mes 13":          {"mes": 13},
		"anio 1999":       {"anio": 1999},
	}
	for nombre, body := range putCasos {
		res := api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathPlant, it.ID), body)
		if res.Status != http.StatusBadRequest {
			t.Errorf("PUT %s: %d; cuerpo: %s", nombre, res.Status, res.Body)
		}
	}
	if items := plantilla(t, api, a, 2026, 6); len(items) != 1 || items[0].Tipo != "egreso" || items[0].Estado != "pendiente" {
		t.Errorf("la plantilla cambió tras peticiones inválidas: %+v", items)
	}
}

// banco_id/grupo_item_id/movimiento_esperado_id inexistentes violan la FK: debería ser 4xx.
func TestValidaciones_Plantilla_ReferenciaInexistente(t *testing.T) {
	bug(t, "POST/PUT plantilla con banco_id/grupo_item_id/movimiento_esperado_id inexistente responde 500 (violación de FK) en vez de 400")
	api, a, _ := setup(t)
	it := crearItem(t, api, a, "egreso", 1, 2026, 6, nil)
	for _, campo := range []string{"banco_id", "grupo_item_id", "movimiento_esperado_id"} {
		expect4xx(t, api.Do(a, http.MethodPost, pathPlant, map[string]any{
			"nombre": "x", "tipo": "egreso", "anio": 2026, "mes": 6, campo: 999999,
		}), "POST "+campo+" inexistente")
		expect4xx(t, api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathPlant, it.ID), map[string]any{campo: 999999}), "PUT "+campo+" inexistente")
	}
}

func TestValidaciones_Clonar(t *testing.T) {
	api, a, _ := setup(t)
	casos := map[string]map[string]any{
		"mes origen 0":     {"anio_origen": 2026, "mes_origen": 0, "anio_destino": 2026, "mes_destino": 2},
		"mes destino 13":   {"anio_origen": 2026, "mes_origen": 1, "anio_destino": 2026, "mes_destino": 13},
		"anio origen 2000": {"anio_origen": 2000, "mes_origen": 1, "anio_destino": 2026, "mes_destino": 2},
		"anio destino 0":   {"anio_origen": 2026, "mes_origen": 1, "mes_destino": 2},
		"vacío":            {},
	}
	for nombre, body := range casos {
		res := api.Do(a, http.MethodPost, pathClonar, body)
		if res.Status != http.StatusBadRequest {
			t.Errorf("clonar %s: %d; cuerpo: %s", nombre, res.Status, res.Body)
		}
	}
}

func TestValidaciones_IDs(t *testing.T) {
	api, a, _ := setup(t)
	for _, p := range []string{pathBancos, pathGrupos, pathMovs, pathPlant, pathDeseos} {
		for _, id := range []string{"abc", "0", "-1", "1.5"} {
			for _, m := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
				var body any
				if m == http.MethodPut {
					body = map[string]any{"nombre": "x"}
				}
				res := api.Do(a, m, p+"/"+id, body)
				if res.Status != http.StatusBadRequest {
					t.Errorf("%s %s/%s: %d, se esperaba 400; cuerpo: %s", m, p, id, res.Status, res.Body)
				}
			}
		}
		// GET de un id inexistente: 404.
		api.Do(a, http.MethodGet, p+"/999999", nil).Expect(t, http.StatusNotFound)
	}
	// En lista de deseos, PUT inexistente también es 404.
	api.Do(a, http.MethodPut, pathDeseos+"/999999", map[string]any{"nombre": "x"}).Expect(t, http.StatusNotFound)
}

// PUT/DELETE de ids inexistentes: deberían ser 404 (hoy 500 salvo PUT de deseos).
func TestValidaciones_IDsInexistentesPutDelete(t *testing.T) {
	bug(t, "PUT/DELETE de id inexistente en bancos/grupos/movimientos/plantilla y DELETE en lista-deseos responden 500 en vez de 404")
	api, a, _ := setup(t)
	for _, p := range []string{pathBancos, pathGrupos, pathMovs, pathPlant} {
		expectDenegado(t, api.Do(a, http.MethodPut, p+"/999999", map[string]any{"nombre": "x"}), "PUT "+p)
		expectDenegado(t, api.Do(a, http.MethodDelete, p+"/999999", nil), "DELETE "+p)
	}
	expectDenegado(t, api.Do(a, http.MethodDelete, pathDeseos+"/999999", nil), "DELETE deseos")
}

// anio/mes inválidos en GET plantilla y resumen se ignoran en silencio y se responde con
// el mes actual: el cliente recibe datos de OTRO período sin enterarse. Debería ser 400.
func TestValidaciones_PeriodoInvalidoEnGET(t *testing.T) {
	bug(t, "GET /api/finanzas/plantilla y /resumen con anio/mes inválidos (mes=13, anio=abc…) responden 200 con el mes actual en vez de 400")
	api, a, _ := setup(t)
	for _, p := range []string{pathPlant, pathResumen} {
		for _, q := range []string{"?anio=2026&mes=13", "?anio=2026&mes=0", "?anio=2026&mes=abc", "?anio=abc&mes=1", "?anio=1999&mes=1"} {
			expect4xx(t, api.Do(a, http.MethodGet, p+q, nil), "GET "+p+q)
		}
	}
}

// Ninguna petición inválida de GET produce 500.
func TestValidaciones_PeriodoInvalidoNo500(t *testing.T) {
	api, a, _ := setup(t)
	for _, p := range []string{pathPlant, pathResumen} {
		for _, q := range []string{"", "?anio=2026&mes=13", "?anio=abc&mes=xyz", "?anio=99999999999999999999&mes=1"} {
			if res := api.Do(a, http.MethodGet, p+q, nil); res.Status >= 500 {
				t.Errorf("GET %s%s: %d; cuerpo: %s", p, q, res.Status, res.Body)
			}
		}
	}
}

func TestValidaciones_Deseos(t *testing.T) {
	api, a, _ := setup(t)
	// Grupo inexistente: 400 (el handler traduce la violación de FK).
	res := api.Do(a, http.MethodPost, pathDeseos, map[string]any{"nombre": "x", "grupo_item_finanzas_id": 999999})
	res.Expect(t, http.StatusBadRequest)
	d := crearDeseo(t, api, a, map[string]any{"nombre": "x"})
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID), map[string]any{"grupo_item_finanzas_id": 999999}).Expect(t, http.StatusBadRequest)

	// grupo_item_finanzas_id <= 0 se trata como "sin grupo".
	d0 := crearDeseo(t, api, a, map[string]any{"nombre": "y", "grupo_item_finanzas_id": 0})
	if d0.GrupoItemFinanzasID != nil {
		t.Errorf("grupo 0 debería ser nil: %+v", d0)
	}

	// Montos negativos se aceptan (sin validación).
	neg := crearDeseo(t, api, a, map[string]any{"nombre": "neg", "presupuesto": -10, "valor_estimado": -5})
	if neg.Presupuesto != -10 || neg.ValorEstimado != -5 {
		t.Errorf("deseo con montos negativos = %+v", neg)
	}
}

// Nombres más largos que la columna (VARCHAR(100) en finanzas, VARCHAR(150) en deseos)
// deberían rechazarse con 400, no con un 500 de la BD.
func TestValidaciones_NombreDemasiadoLargo(t *testing.T) {
	bug(t, "nombres que exceden el VARCHAR de la columna responden 500 (error de BD) en vez de 400")
	api, a, _ := setup(t)
	largo := strings.Repeat("x", 151)
	for _, p := range []string{pathBancos, pathGrupos, pathMovs, pathDeseos} {
		expect4xx(t, api.Do(a, http.MethodPost, p, map[string]any{"nombre": largo}), "POST "+p)
	}
	expect4xx(t, api.Do(a, http.MethodPost, pathPlant, map[string]any{"nombre": largo, "tipo": "egreso", "anio": 2026, "mes": 1}), "POST plantilla")
}
