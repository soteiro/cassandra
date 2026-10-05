package finanzas

import (
	"net/http"
	"testing"
	"time"

	"cassandra/internal/apitest"
	"cassandra/models"
)

// La plantilla devuelve solo el período exacto (mismo mes de otro año o mes vecino no
// entran) y excluye borrados.
func TestPlantilla_FiltraPeriodoExacto(t *testing.T) {
	api, a, _ := setup(t)
	objetivo := crearItem(t, api, a, "egreso", 1, 2026, 3, map[string]any{"nombre": "objetivo"})
	crearItem(t, api, a, "egreso", 2, 2025, 3, nil)
	crearItem(t, api, a, "egreso", 3, 2026, 2, nil)
	crearItem(t, api, a, "egreso", 4, 2026, 4, nil)
	borrado := crearItem(t, api, a, "egreso", 5, 2026, 3, nil)
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathPlant, borrado.ID), nil).Expect(t, http.StatusOK)

	items := plantilla(t, api, a, 2026, 3)
	if len(items) != 1 || items[0].ID != objetivo.ID {
		t.Errorf("plantilla 2026-03 = %+v", items)
	}
	if items := plantilla(t, api, a, 2030, 1); len(items) != 0 {
		t.Errorf("período vacío debería devolver [], got %+v", items)
	}
}

// El resumen suma TODOS los estados (pendiente, en proceso y completado): es un
// presupuesto del mes, no lo efectivamente pagado. Excluye borrados y otros períodos.
func TestResumen_SumaTodosLosEstados(t *testing.T) {
	api, a, _ := setup(t)
	crearItem(t, api, a, "ingreso", 1_000_000, 2026, 7, map[string]any{"estado": "completado"})
	crearItem(t, api, a, "ingreso", 200_000, 2026, 7, map[string]any{"estado": "pendiente"})
	crearItem(t, api, a, "egreso", 300_000, 2026, 7, map[string]any{"estado": "en proceso"})
	crearItem(t, api, a, "egreso", 50_000, 2026, 7, map[string]any{"estado": "completado"})
	borrado := crearItem(t, api, a, "egreso", 999_999, 2026, 7, nil)
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathPlant, borrado.ID), nil).Expect(t, http.StatusOK)
	crearItem(t, api, a, "egreso", 777, 2026, 8, nil)
	crearItem(t, api, a, "ingreso", 777, 2025, 7, nil)

	r := resumen(t, api, a, 2026, 7)
	want := models.FinanzasResumenPeriodo{Mes: 7, Anio: 2026, TotalIngresos: 1_200_000, TotalEgresos: 350_000, Balance: 850_000}
	if r != want {
		t.Errorf("resumen = %+v, se esperaba %+v", r, want)
	}

	// Período vacío: todo en cero.
	if r := resumen(t, api, a, 2026, 1); r.TotalIngresos != 0 || r.TotalEgresos != 0 || r.Balance != 0 || r.Mes != 1 || r.Anio != 2026 {
		t.Errorf("resumen vacío = %+v", r)
	}
}

// Montos negativos se aceptan tal cual (no hay validación) y el resumen los suma con signo.
func TestPlantilla_MontoNegativoSeAcepta(t *testing.T) {
	api, a, _ := setup(t)
	it := crearItem(t, api, a, "egreso", -500, 2026, 9, nil)
	if it.Monto != -500 {
		t.Errorf("monto = %d", it.Monto)
	}
	crearItem(t, api, a, "ingreso", 1000, 2026, 9, nil)
	if r := resumen(t, api, a, 2026, 9); r.TotalEgresos != -500 || r.Balance != 1500 {
		t.Errorf("resumen con monto negativo = %+v", r)
	}
}

// Sin anio/mes, plantilla y resumen usan el mes actual del servidor (comportamiento
// documentado del handler).
func TestPlantillaYResumen_SinParametrosUsanMesActual(t *testing.T) {
	api, a, _ := setup(t)
	now := time.Now()
	crearItem(t, api, a, "ingreso", 42, now.Year(), int(now.Month()), nil)

	var r models.FinanzasResumenPeriodo
	api.Do(a, http.MethodGet, pathResumen, nil).Expect(t, http.StatusOK).JSON(t, &r)
	if r.Anio != now.Year() || r.Mes != int(now.Month()) || r.TotalIngresos != 42 {
		t.Errorf("resumen sin parámetros = %+v", r)
	}
	var items []models.FinanzasPlantillaResponse
	api.Do(a, http.MethodGet, pathPlant, nil).Expect(t, http.StatusOK).JSON(t, &items)
	if len(items) != 1 {
		t.Errorf("plantilla sin parámetros = %+v", items)
	}
}

type clonarResp struct {
	Mensaje           string `json:"mensaje"`
	RegistrosClonados int    `json:"registros_clonados"`
	MesDestino        int    `json:"mes_destino"`
	AnioDestino       int    `json:"anio_destino"`
}

func clonar(t *testing.T, api *apitest.API, u *apitest.User, ao, mo, ad, md int) clonarResp {
	t.Helper()
	var out clonarResp
	api.Do(u, http.MethodPost, pathClonar, map[string]any{"anio_origen": ao, "mes_origen": mo, "anio_destino": ad, "mes_destino": md}).
		Expect(t, http.StatusOK).JSON(t, &out)
	return out
}

// Clonar diciembre -> enero del año siguiente: copia los ítems activos con estado
// 'pendiente', conservando tipo, nombre, monto y referencias; el origen no cambia.
func TestClonar_CruceDeAnio(t *testing.T) {
	api, a, _ := setup(t)
	banco := crearBanco(t, api, a, "Santander", "debito")
	grupo := crearGrupo(t, api, a, "Hogar")
	mov := crearMov(t, api, a, "pago yo")
	crearItem(t, api, a, "ingreso", 1_500_000, 2026, 12, map[string]any{"nombre": "Sueldo", "estado": "completado"})
	crearItem(t, api, a, "egreso", 400_000, 2026, 12, map[string]any{
		"nombre": "Arriendo", "estado": "en proceso", "banco_id": banco.ID, "grupo_item_id": grupo.ID, "movimiento_esperado_id": mov.ID,
	})
	borrado := crearItem(t, api, a, "egreso", 9, 2026, 12, map[string]any{"nombre": "Borrado"})
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathPlant, borrado.ID), nil).Expect(t, http.StatusOK)

	out := clonar(t, api, a, 2026, 12, 2027, 1)
	if out.RegistrosClonados != 2 || out.MesDestino != 1 || out.AnioDestino != 2027 {
		t.Errorf("respuesta clonar = %+v", out)
	}

	dest := plantilla(t, api, a, 2027, 1)
	if len(dest) != 2 {
		t.Fatalf("destino = %+v", dest)
	}
	porNombre := map[string]models.FinanzasPlantillaResponse{}
	for _, it := range dest {
		porNombre[it.Nombre] = it
		if it.Estado != "pendiente" || it.Anio != 2027 || it.Mes != 1 || it.UserID != a.ID {
			t.Errorf("ítem clonado = %+v", it)
		}
	}
	if s := porNombre["Sueldo"]; s.Tipo != "ingreso" || s.Monto != 1_500_000 {
		t.Errorf("Sueldo clonado = %+v", s)
	}
	ar := porNombre["Arriendo"]
	if ar.Tipo != "egreso" || ar.Monto != 400_000 || ar.BancoID == nil || *ar.BancoID != banco.ID ||
		ar.GrupoItemID == nil || *ar.GrupoItemID != grupo.ID || ar.MovimientoEsperadoID == nil || *ar.MovimientoEsperadoID != mov.ID {
		t.Errorf("Arriendo clonado = %+v", ar)
	}
	if _, ok := porNombre["Borrado"]; ok {
		t.Error("se clonó un ítem borrado")
	}

	orig := plantilla(t, api, a, 2026, 12)
	if len(orig) != 2 {
		t.Errorf("origen alterado: %+v", orig)
	}
	for _, it := range orig {
		if it.Estado == "pendiente" {
			t.Errorf("el origen perdió su estado: %+v", it)
		}
	}
	if r := resumen(t, api, a, 2027, 1); r.TotalIngresos != 1_500_000 || r.TotalEgresos != 400_000 {
		t.Errorf("resumen destino = %+v", r)
	}
}

func TestClonar_OrigenVacio(t *testing.T) {
	api, a, _ := setup(t)
	if out := clonar(t, api, a, 2026, 2, 2026, 3); out.RegistrosClonados != 0 {
		t.Errorf("clonar origen vacío = %+v", out)
	}
	if items := plantilla(t, api, a, 2026, 3); len(items) != 0 {
		t.Errorf("destino = %+v", items)
	}
}

// Si el destino ya tiene datos, clonar AÑADE (no reemplaza ni evita duplicados):
// clonar dos veces duplica los ítems.
func TestClonar_DestinoConDatosAcumula(t *testing.T) {
	api, a, _ := setup(t)
	crearItem(t, api, a, "egreso", 100, 2026, 3, map[string]any{"nombre": "Luz"})
	crearItem(t, api, a, "egreso", 999, 2026, 4, map[string]any{"nombre": "Ya estaba"})

	clonar(t, api, a, 2026, 3, 2026, 4)
	if items := plantilla(t, api, a, 2026, 4); len(items) != 2 {
		t.Errorf("destino tras 1 clonación = %+v", items)
	}
	clonar(t, api, a, 2026, 3, 2026, 4)
	if items := plantilla(t, api, a, 2026, 4); len(items) != 3 {
		t.Errorf("destino tras 2 clonaciones = %d ítems, se esperaban 3 (duplica)", len(items))
	}
}

// Clonar un período sobre sí mismo no tiene sentido y duplica todo el mes.
func TestClonar_MismoPeriodoSeRechaza(t *testing.T) {
	api, a, _ := setup(t)
	crearItem(t, api, a, "egreso", 100, 2026, 3, nil)
	res := api.Do(a, http.MethodPost, pathClonar, map[string]any{"anio_origen": 2026, "mes_origen": 3, "anio_destino": 2026, "mes_destino": 3})
	expect4xx(t, res, "clonar sobre sí mismo")
	if items := plantilla(t, api, a, 2026, 3); len(items) != 1 {
		t.Errorf("el mes quedó con %d ítems", len(items))
	}
}

func TestDeseos_CRUDYCompra(t *testing.T) {
	api, a, _ := setup(t)
	grupo := crearGrupo(t, api, a, "Tecnología")

	d := crearDeseo(t, api, a, map[string]any{
		"nombre": "  Teclado ", "presupuesto": 80_000, "valor_estimado": 75_000,
		"justificacion": "el actual falla", "grupo_item_finanzas_id": grupo.ID,
	})
	if d.Nombre != "Teclado" || d.Presupuesto != 80_000 || d.ValorEstimado != 75_000 || d.Comprado ||
		d.FechaCompra != nil || d.UserID != a.ID || d.Justificacion == nil || *d.Justificacion != "el actual falla" ||
		d.GrupoItemFinanzasNombre == nil || *d.GrupoItemFinanzasNombre != "Tecnología" {
		t.Errorf("deseo creado = %+v", d)
	}

	// Marcar comprado sin fecha => fecha_compra = ahora.
	antes := time.Now().Add(-time.Minute)
	var got models.ListaDeseosResponse
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID), map[string]any{"comprado": true}).Expect(t, http.StatusOK)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, d.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if !got.Comprado || got.FechaCompra == nil || got.FechaCompra.Before(antes) || got.FechaCompra.After(time.Now().Add(time.Minute)) {
		t.Errorf("tras marcar comprado = %+v", got)
	}
	if got.Nombre != "Teclado" || got.Presupuesto != 80_000 {
		t.Errorf("PUT parcial pisó campos: %+v", got)
	}

	// Desmarcar => fecha_compra se limpia.
	got = models.ListaDeseosResponse{}
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID), map[string]any{"comprado": false}).Expect(t, http.StatusOK)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, d.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.Comprado || got.FechaCompra != nil {
		t.Errorf("tras desmarcar = %+v", got)
	}

	// Marcar comprado con fecha explícita.
	fecha := time.Date(2026, 5, 10, 12, 0, 0, 0, time.UTC)
	got = models.ListaDeseosResponse{}
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID), map[string]any{"comprado": true, "fecha_compra": fecha}).Expect(t, http.StatusOK)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, d.ID), nil).Expect(t, http.StatusOK).JSON(t, &got)
	if !got.Comprado || got.FechaCompra == nil || !got.FechaCompra.Equal(fecha) {
		t.Errorf("tras comprar con fecha = %+v", got)
	}

	// Crear ya comprado sin fecha => fecha_compra = ahora.
	d2 := crearDeseo(t, api, a, map[string]any{"nombre": "Libro", "comprado": true})
	if !d2.Comprado || d2.FechaCompra == nil {
		t.Errorf("deseo creado comprado = %+v", d2)
	}

	// DELETE lógico: 204, desaparece y PUT posterior => 404.
	api.Do(a, http.MethodDelete, apitest.Path("%s/%d", pathDeseos, d.ID), nil).Expect(t, http.StatusNoContent)
	api.Do(a, http.MethodGet, apitest.Path("%s/%d", pathDeseos, d.ID), nil).Expect(t, http.StatusNotFound)
	api.Do(a, http.MethodPut, apitest.Path("%s/%d", pathDeseos, d.ID), map[string]any{"nombre": "x"}).Expect(t, http.StatusNotFound)
	var lista []models.ListaDeseosResponse
	api.Do(a, http.MethodGet, pathDeseos, nil).Expect(t, http.StatusOK).JSON(t, &lista)
	if len(lista) != 1 || lista[0].ID != d2.ID {
		t.Errorf("listado tras borrar = %+v", lista)
	}
	assertSoftDeleted(t, api, "lista_deseos", d.ID)
}

func TestDeseos_Filtros(t *testing.T) {
	api, a, _ := setup(t)
	g1 := crearGrupo(t, api, a, "G1")
	g2 := crearGrupo(t, api, a, "G2")
	pendG1 := crearDeseo(t, api, a, map[string]any{"nombre": "pend-g1", "grupo_item_finanzas_id": g1.ID})
	compG1 := crearDeseo(t, api, a, map[string]any{"nombre": "comp-g1", "comprado": true, "grupo_item_finanzas_id": g1.ID})
	pendG2 := crearDeseo(t, api, a, map[string]any{"nombre": "pend-g2", "grupo_item_finanzas_id": g2.ID})
	sinGrupo := crearDeseo(t, api, a, map[string]any{"nombre": "sin-grupo"})

	ids := func(q string) map[int]bool {
		t.Helper()
		var lista []models.ListaDeseosResponse
		api.Do(a, http.MethodGet, pathDeseos+q, nil).Expect(t, http.StatusOK).JSON(t, &lista)
		m := map[int]bool{}
		for _, d := range lista {
			m[d.ID] = true
		}
		return m
	}
	check := func(q string, want ...int) {
		t.Helper()
		got := ids(q)
		if len(got) != len(want) {
			t.Errorf("%q: %d ítems, se esperaban %d (%v)", q, len(got), len(want), got)
			return
		}
		for _, id := range want {
			if !got[id] {
				t.Errorf("%q: falta id %d (%v)", q, id, got)
			}
		}
	}

	check("", pendG1.ID, compG1.ID, pendG2.ID, sinGrupo.ID)
	check("?comprado=true", compG1.ID)
	check("?comprado=false", pendG1.ID, pendG2.ID, sinGrupo.ID)
	check(apitest.Path("?grupo_id=%d", g1.ID), pendG1.ID, compG1.ID)
	check(apitest.Path("?grupo_id=%d&comprado=false", g1.ID), pendG1.ID)
	check("?grupo_id=999999")
	// Filtros con valores no parseables se IGNORAN silenciosamente (devuelven todo).
	check("?comprado=quizas", pendG1.ID, compG1.ID, pendG2.ID, sinGrupo.ID)
	check("?grupo_id=abc", pendG1.ID, compG1.ID, pendG2.ID, sinGrupo.ID)
}
