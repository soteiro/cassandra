package memorymcp

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Herramientas de PM: ver la disponibilidad del calendario, cambiar tareas y reservar
// bloques de trabajo en los huecos libres.

type DisponibilidadInput struct {
	Desde string `json:"desde,omitempty" jsonschema:"Primer día YYYY-MM-DD; por defecto hoy"`
	Hasta string `json:"hasta,omitempty" jsonschema:"Último día YYYY-MM-DD; por defecto 13 días después de desde; rango máximo 31 días"`
}

type UpdateTaskInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"ID del proyecto autorizado"`
	TareaID    int `json:"tarea_id"`
	models.UpdateIntegrationTaskRequest
}

type PlanTaskInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"ID del proyecto autorizado"`
	TareaID    int `json:"tarea_id"`
	models.PlanificarRequest
}

type RemoveBlockInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"Proyecto de la tarea del bloque"`
	BloqueID   int `json:"bloque_id"`
}

type RemoveBlockResult struct {
	Eliminado bool `json:"eliminado"`
	BloqueID  int  `json:"bloque_id"`
}

func positive32(v int, name string) error {
	if v <= 0 || v > math.MaxInt32 {
		return errors.New(name + " debe ser un entero positivo de 32 bits")
	}
	return nil
}

// now es la hora local de la máquina del conector, que es la del usuario.
var now = time.Now

func addPlanningTools(s *mcp.Server, c *Client, read *mcp.ToolAnnotations) {
	closed, destructive, notDestructive := false, true, false
	update := &mcp.ToolAnnotations{IdempotentHint: true, DestructiveHint: &destructive, OpenWorldHint: &closed}
	plan := &mcp.ToolAnnotations{IdempotentHint: true, DestructiveHint: &notDestructive, OpenWorldHint: &closed}

	mcp.AddTool(s, &mcp.Tool{
		Name: "ver_disponibilidad",
		Description: "Ver huecos libres, eventos, bloques de trabajo y deadlines del usuario para planificar. Requiere calendar:read. " +
			"Los huecos ya descuentan lo que ocupa (actividades, bloques) y suman lo que libera (p. ej. colegio) sobre el horario base, desde la hora actual. " +
			"Eventos sin calendario_id son tiempo ocupado que la key no puede ver. Leer avisos.",
		Annotations: read,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in DisponibilidadInput) (*mcp.CallToolResult, models.Disponibilidad, error) {
		var out models.Disponibilidad
		q := url.Values{"ahora": {now().Format("2006-01-02T15:04")}}
		for k, v := range map[string]string{"desde": in.Desde, "hasta": in.Hasta} {
			if v != "" {
				if _, err := time.Parse("2006-01-02", v); err != nil {
					return nil, out, errors.New(k + " debe tener formato YYYY-MM-DD")
				}
				q.Set(k, v)
			}
		}
		err := c.request(ctx, http.MethodGet, "/api/integrations/calendar?"+q.Encode(), nil, &out)
		return nil, out, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "actualizar_tarea",
		Description: "Cambiar estado, prioridad, fecha_inicio, fecha_limite o estimacion_min de una tarea del proyecto autorizado. Requiere tasks:manage. " +
			"Terminado cierra también sus subtareas pendientes. Cerrar solo con evidencia de que está hecha o cuando el usuario lo diga; los cambios quedan en el historial con origen mcp.",
		Annotations: update,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in UpdateTaskInput) (*mcp.CallToolResult, models.IntegrationTask, error) {
		var out models.IntegrationTask
		path, err := tasksPath(in.ProyectoID)
		if err == nil {
			err = positive32(in.TareaID, "tarea_id")
		}
		if err == nil {
			err = in.UpdateIntegrationTaskRequest.Validate()
		}
		if err == nil {
			err = c.request(ctx, http.MethodPatch, path+"/"+strconv.Itoa(in.TareaID), in.UpdateIntegrationTaskRequest, &out)
		}
		return nil, out, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "planificar_tarea",
		Description: "Reservar de 1 a 20 bloques de trabajo con hora para una tarea, todos o ninguno. Requiere tasks:manage. " +
			"Elegirlos dentro de los huecos de ver_disponibilidad y antes del deadline. Un solape con otro bloque se rechaza; " +
			"fuera de un hueco se guarda con aviso. Usar operacion_id estable para reintentar sin duplicar.",
		Annotations: plan,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in PlanTaskInput) (*mcp.CallToolResult, models.PlanificacionResult, error) {
		var out models.PlanificacionResult
		path, err := tasksPath(in.ProyectoID)
		if err == nil {
			err = positive32(in.TareaID, "tarea_id")
		}
		if err == nil {
			err = in.PlanificarRequest.Validate()
		}
		if err == nil {
			err = c.request(ctx, http.MethodPost, path+"/"+strconv.Itoa(in.TareaID)+"/bloques", in.PlanificarRequest, &out)
		}
		return nil, out, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "quitar_bloque",
		Description: "Quitar un bloque de trabajo de una tarea del proyecto autorizado, p. ej. para replanificar. Requiere tasks:manage.",
		Annotations: update,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in RemoveBlockInput) (*mcp.CallToolResult, RemoveBlockResult, error) {
		var out RemoveBlockResult
		err := positive32(in.ProyectoID, "proyecto_id")
		if err == nil {
			err = positive32(in.BloqueID, "bloque_id")
		}
		if err == nil {
			err = c.request(ctx, http.MethodDelete, "/api/integrations/projects/"+strconv.Itoa(in.ProyectoID)+"/bloques/"+strconv.Itoa(in.BloqueID), nil, &out)
		}
		return nil, out, err
	})
}
