// Package eventos prueba por HTTP que cada cambio en las tablas funcionales queda en el
// registro de eventos (triggers de la migración 000024): creación, cambios con valor
// anterior y nuevo, texto libre sin copiar su contenido, PUT sin cambios, borrado lógico,
// fecha_actualizacion y origen.
package eventos

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"cassandra/internal/apitest"
)

const secreto = "contenido-privado-que-no-debe-copiarse"

type evento struct {
	Accion     string
	Cambios    map[string]map[string]any
	ProyectoID *int
	UserID     int
	Origen     string
}

func eventosDe(t *testing.T, api *apitest.API, entidad string, id int) []evento {
	t.Helper()
	rows, err := api.DB.Query(context.Background(), `
		SELECT accion, cambios, proyecto_id, user_id, origen
		FROM eventos WHERE entidad = $1 AND entidad_id = $2 ORDER BY id`, entidad, id)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []evento
	for rows.Next() {
		var e evento
		var raw []byte
		if err := rows.Scan(&e.Accion, &raw, &e.ProyectoID, &e.UserID, &e.Origen); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &e.Cambios); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(raw), secreto) {
			t.Errorf("%s %d: el registro copia texto privado: %s", entidad, id, raw)
		}
		out = append(out, e)
	}
	return out
}

func ok(t *testing.T, res *apitest.Response) *apitest.Response {
	t.Helper()
	if res.Status < 200 || res.Status >= 300 {
		t.Fatalf("código %d; cuerpo: %s", res.Status, res.Body)
	}
	return res
}

// caso describe cómo crear, cambiar y borrar un registro de una tabla con trigger.
type caso struct {
	entidad string
	// crear devuelve el id del registro y el proyecto al que pertenece (0 si ninguno).
	crear       func(t *testing.T, api *apitest.API, u *apitest.User, proyecto int) int
	ruta        string         // ruta de PUT/DELETE, con %d para el id
	categorico  map[string]any // cambio de un campo con valor (vacío: la tabla no tiene)
	campo       string         // campo que cambia categorico
	privado     map[string]any // cambio de un campo de texto libre
	campoPriv   string
	conProyecto bool
}

func crearCon(ruta string, body map[string]any) func(*testing.T, *apitest.API, *apitest.User, int) int {
	return func(t *testing.T, api *apitest.API, u *apitest.User, proyecto int) int {
		t.Helper()
		return ok(t, api.Do(u, http.MethodPost, strings.ReplaceAll(ruta, "{p}", itoa(proyecto)), body)).ID(t)
	}
}

func itoa(n int) string { return apitest.Path("%d", n) }

func casos() []caso {
	return []caso{
		{
			entidad: "proyecto", ruta: "/api/proyects/%d", conProyecto: true,
			crear:      func(t *testing.T, api *apitest.API, u *apitest.User, proyecto int) int { return proyecto },
			categorico: map[string]any{"prioridad": "Alta"}, campo: "prioridad",
			privado: map[string]any{"por_que": secreto}, campoPriv: "por_que",
		},
		{
			entidad: "tarea", ruta: "/api/tareas/%d", conProyecto: true,
			crear: func(t *testing.T, api *apitest.API, u *apitest.User, proyecto int) int {
				return ok(t, api.Do(u, http.MethodPost, "/api/tareas", map[string]any{"nombre": "Tarea", "proyect_id": proyecto})).ID(t)
			},
			categorico: map[string]any{"estado": "En Curso"}, campo: "estado",
			privado: map[string]any{"descripcion": secreto}, campoPriv: "descripcion",
		},
		{
			entidad: "nota", ruta: "/api/notas/%d", conProyecto: true,
			crear:   crearCon("/api/proyects/{p}/notas", map[string]any{"nota": "Una nota"}),
			privado: map[string]any{"nota": secreto}, campoPriv: "nota_proyecto",
		},
		{
			entidad: "documento", ruta: "/api/documentos/%d", conProyecto: true,
			crear:      crearCon("/api/proyects/{p}/documentos", map[string]any{"titulo": "Doc", "contenido": "x", "tipo": "general"}),
			categorico: map[string]any{"tipo": "decision"}, campo: "tipo",
			privado: map[string]any{"contenido": secreto}, campoPriv: "contenido",
		},
		{
			entidad: "log", ruta: "/api/logs/%d", conProyecto: true,
			crear:      crearCon("/api/proyects/{p}/logs", map[string]any{"titulo": "Log", "contenido_raw": "x"}),
			categorico: map[string]any{"titulo": "Otro título"}, campo: "titulo",
			privado: map[string]any{"contenido_raw": secreto}, campoPriv: "contenido_raw",
		},
		{
			entidad: "persona", ruta: "/api/personas/%d",
			crear:      crearCon("/api/personas", map[string]any{"nombre": "Ada", "entorno": "Trabajo"}),
			categorico: map[string]any{"entorno": "Familia"}, campo: "entorno",
			privado: map[string]any{"informacion": secreto}, campoPriv: "informacion",
		},
		{
			entidad: "interaccion", ruta: "/api/interacciones/%d",
			crear: func(t *testing.T, api *apitest.API, u *apitest.User, _ int) int {
				p := ok(t, api.Do(u, http.MethodPost, "/api/personas", map[string]any{"nombre": "Alan"})).ID(t)
				return ok(t, api.Do(u, http.MethodPost, apitest.Path("/api/personas/%d/interacciones", p),
					map[string]any{"interaccion": "Café"})).ID(t)
			},
			privado: map[string]any{"interaccion": secreto}, campoPriv: "interaccion",
		},
		{
			entidad: "reflexion", ruta: "/api/reflexiones/%d",
			crear:      crearCon("/api/reflexiones", map[string]any{"reflexion": "Hoy…", "tipo": "reflexion"}),
			categorico: map[string]any{"tipo": "memoria"}, campo: "tipo",
			privado: map[string]any{"reflexion": secreto}, campoPriv: "reflexion",
		},
		{
			entidad: "deseo", ruta: "/api/lista-deseos/%d",
			crear:      crearCon("/api/lista-deseos", map[string]any{"nombre": "Libro", "presupuesto": 1000, "valor_estimado": 1000}),
			categorico: map[string]any{"valor_estimado": 2000}, campo: "valor_estimado",
			privado: map[string]any{"justificacion": secreto}, campoPriv: "justificacion",
		},
		{
			entidad: "banco", ruta: "/api/finanzas/bancos/%d",
			crear:      crearCon("/api/finanzas/bancos", map[string]any{"nombre": "Banco", "tipo": "debito"}),
			categorico: map[string]any{"nombre": "Otro banco"}, campo: "nombre",
		},
		{
			entidad: "grupo_finanzas", ruta: "/api/finanzas/grupos/%d",
			crear:      crearCon("/api/finanzas/grupos", map[string]any{"nombre": "Hogar"}),
			categorico: map[string]any{"nombre": "Casa"}, campo: "nombre",
		},
		{
			entidad: "movimiento_esperado", ruta: "/api/finanzas/movimientos-esperados/%d",
			crear:      crearCon("/api/finanzas/movimientos-esperados", map[string]any{"nombre": "Pago yo"}),
			categorico: map[string]any{"nombre": "Transferencia"}, campo: "nombre",
		},
		{
			entidad: "plantilla_finanzas", ruta: "/api/finanzas/plantilla/%d",
			crear: crearCon("/api/finanzas/plantilla", map[string]any{
				"tipo": "egreso", "mes": 10, "anio": 2026, "nombre": "Luz", "monto": 30000}),
			categorico: map[string]any{"monto": 35000}, campo: "monto",
		},
	}
}

func crearProyecto(t *testing.T, api *apitest.API, u *apitest.User, nombre string) int {
	t.Helper()
	return ok(t, api.Do(u, http.MethodPost, "/api/proyects", map[string]any{
		"nombre": nombre, "descripcion": "d", "por_que": "p", "para_que": "q",
		"criterio_finalizacion": "c", "prioridad": "Media",
	})).ID(t)
}

func TestCadaTablaRegistraSusCambios(t *testing.T) {
	api := apitest.New(t, "eventos")
	ana := api.User("ana@eventos.test")

	for _, c := range casos() {
		t.Run(c.entidad, func(t *testing.T) {
			proyecto := crearProyecto(t, api, ana, "Proyecto "+c.entidad)
			id := c.crear(t, api, ana, proyecto)
			ruta := apitest.Path(c.ruta, id)

			evs := eventosDe(t, api, c.entidad, id)
			if len(evs) != 1 || evs[0].Accion != "creado" {
				t.Fatalf("al crear se esperaba un evento 'creado', hay %+v", evs)
			}
			if evs[0].UserID != ana.ID || evs[0].Origen != "app" {
				t.Errorf("user_id/origen: %+v", evs[0])
			}
			if c.conProyecto && (evs[0].ProyectoID == nil || *evs[0].ProyectoID != proyecto) {
				t.Errorf("proyecto_id: se esperaba %d, hay %v", proyecto, evs[0].ProyectoID)
			}
			n := 1

			if c.categorico != nil {
				ok(t, api.Do(ana, http.MethodPut, ruta, c.categorico))
				evs = eventosDe(t, api, c.entidad, id)
				if len(evs) != n+1 {
					t.Fatalf("cambio de %s: se esperaba un evento más, hay %+v", c.campo, evs)
				}
				ult := evs[n].Cambios[c.campo]
				if evs[n].Accion != "modificado" || ult == nil {
					t.Fatalf("cambio de %s: %+v", c.campo, evs[n])
				}
				if _, tieneAntes := ult["antes"]; !tieneAntes || ult["despues"] == nil {
					t.Errorf("cambio de %s sin antes/después: %v", c.campo, ult)
				}
				n++

				// El mismo PUT otra vez no cambia nada: no es un evento.
				ok(t, api.Do(ana, http.MethodPut, ruta, c.categorico))
				if evs = eventosDe(t, api, c.entidad, id); len(evs) != n {
					t.Errorf("un PUT sin cambios no debe registrar nada: %+v", evs[n:])
				}
			}

			if c.privado != nil {
				ok(t, api.Do(ana, http.MethodPut, ruta, c.privado))
				evs = eventosDe(t, api, c.entidad, id)
				if len(evs) != n+1 {
					t.Fatalf("cambio de %s: se esperaba un evento más, hay %+v", c.campoPriv, evs)
				}
				if got := evs[n].Cambios[c.campoPriv]; got["modificado"] != true || len(got) != 1 {
					t.Errorf("texto libre %s: se esperaba solo {modificado: true}, hay %v", c.campoPriv, got)
				}
				n++
			}

			ok(t, api.Do(ana, http.MethodDelete, ruta, nil))
			evs = eventosDe(t, api, c.entidad, id)
			if len(evs) != n+1 || evs[n].Accion != "eliminado" {
				t.Errorf("borrado lógico: se esperaba 'eliminado', hay %+v", evs[n:])
			}
		})
	}
}

func fechaActualizacion(t *testing.T, api *apitest.API, id int) time.Time {
	t.Helper()
	var f time.Time
	if err := api.DB.QueryRow(context.Background(),
		"SELECT fecha_actualizacion FROM tareas_proyectos WHERE id = $1", id).Scan(&f); err != nil {
		t.Fatal(err)
	}
	return f
}

func TestFechaActualizacionSoloConCambiosReales(t *testing.T) {
	api := apitest.New(t, "eventos")
	ana := api.User("ana@eventos.test")
	tarea := ok(t, api.Do(ana, http.MethodPost, "/api/tareas", map[string]any{
		"nombre": "Tarea", "proyect_id": crearProyecto(t, api, ana, "P")})).ID(t)
	ruta := apitest.Path("/api/tareas/%d", tarea)

	inicial := fechaActualizacion(t, api, tarea)
	ok(t, api.Do(ana, http.MethodPut, ruta, map[string]any{}))
	if f := fechaActualizacion(t, api, tarea); !f.Equal(inicial) {
		t.Errorf("un PUT sin cambios movió fecha_actualizacion: %v → %v", inicial, f)
	}
	ok(t, api.Do(ana, http.MethodPut, ruta, map[string]any{"estado": "Bloqueado"}))
	if f := fechaActualizacion(t, api, tarea); !f.After(inicial) {
		t.Errorf("un cambio real debe mover fecha_actualizacion: %v → %v", inicial, f)
	}

	var got struct {
		FechaActualizacion *time.Time `json:"fecha_actualizacion"`
	}
	api.Do(ana, http.MethodGet, ruta, nil).Expect(t, http.StatusOK).JSON(t, &got)
	if got.FechaActualizacion == nil {
		t.Error("GET /api/tareas/{id} debe incluir fecha_actualizacion")
	}
}

// El chat y el MCP marcarán sus escrituras con SET LOCAL cassandra.origen.
func TestOrigenSeFijaPorTransaccion(t *testing.T) {
	api := apitest.New(t, "eventos")
	ana := api.User("ana@eventos.test")
	proyecto := crearProyecto(t, api, ana, "P")

	ctx := context.Background()
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT set_config('cassandra.origen', 'mcp', true)"); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, "UPDATE proyectos SET prioridad = 'Baja' WHERE id = $1", proyecto); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	evs := eventosDe(t, api, "proyecto", proyecto)
	if got := evs[len(evs)-1].Origen; got != "mcp" {
		t.Errorf("origen: se esperaba 'mcp', hay %q", got)
	}

	// Fuera de esa transacción vuelve a ser 'app' (aunque la conexión del pool se reutilice).
	ok(t, api.Do(ana, http.MethodPut, apitest.Path("/api/proyects/%d", proyecto), map[string]any{"prioridad": "Alta"}))
	evs = eventosDe(t, api, "proyecto", proyecto)
	if got := evs[len(evs)-1].Origen; got != "app" {
		t.Errorf("origen tras la transacción: se esperaba 'app', hay %q", got)
	}
}
