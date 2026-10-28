package memorymcp

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/url"
	"strconv"

	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type CreateTaskInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"ID del proyecto vinculado y autorizado"`
	models.CreateIntegrationTaskRequest
}

type ListTasksInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"ID del proyecto vinculado y autorizado"`
	models.IntegrationTaskQuery
}

type GetTaskInput struct {
	ProyectoID int `json:"proyecto_id"`
	TareaID    int `json:"tarea_id"`
}

func tasksPath(projectID int) (string, error) {
	if projectID <= 0 || projectID > math.MaxInt32 {
		return "", errors.New("proyecto_id debe ser un entero positivo de 32 bits")
	}
	return "/api/integrations/projects/" + strconv.Itoa(projectID) + "/tasks", nil
}

func addTaskTools(s *mcp.Server, c *Client, read *mcp.ToolAnnotations) {
	closed, destructive := false, false
	create := &mcp.ToolAnnotations{IdempotentHint: true, DestructiveHint: &destructive, OpenWorldHint: &closed}
	mcp.AddTool(s, &mcp.Tool{
		Name: "crear_tarea", Description: "Crear una tarea o subtarea en un proyecto autorizado. Requiere tasks:create. Estado inicial Abierto y prioridad normal. Usar operacion_id estable para reintentar sin duplicados; el padre debe pertenecer al mismo proyecto. Crear solo cuando el usuario lo solicite.", Annotations: create,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in CreateTaskInput) (*mcp.CallToolResult, models.IntegrationTask, error) {
		var out models.IntegrationTask
		path, err := tasksPath(in.ProyectoID)
		if err == nil {
			err = in.CreateIntegrationTaskRequest.Validate()
		}
		if err == nil {
			err = c.request(ctx, http.MethodPost, path, in.CreateIntegrationTaskRequest, &out)
		}
		return nil, out, err
	})
	mcp.AddTool(s, &mcp.Tool{
		Name: "listar_tareas", Description: "Consultar tareas de un proyecto autorizado con búsqueda literal, filtros y paginación. Requiere tasks:read. Devuelve filas planas con tarea_padre_id, orden por ID descendente y hay_mas. Para subtareas directas filtrar por tarea_padre_id; 0 devuelve las principales.", Annotations: read,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in ListTasksInput) (*mcp.CallToolResult, models.IntegrationTaskList, error) {
		var out models.IntegrationTaskList
		path, err := tasksPath(in.ProyectoID)
		if err == nil {
			err = in.IntegrationTaskQuery.Validate()
		}
		if err == nil {
			q := url.Values{
				"q": {in.Consulta}, "estado": {in.Estado}, "prioridad": {in.Prioridad},
				"limit": {strconv.Itoa(in.Limit)}, "offset": {strconv.Itoa(in.Offset)},
			}
			if in.TareaPadreID != nil {
				q.Set("tarea_padre_id", strconv.Itoa(*in.TareaPadreID))
			}
			err = c.request(ctx, http.MethodGet, path+"?"+q.Encode(), nil, &out)
		}
		return nil, out, err
	})
	mcp.AddTool(s, &mcp.Tool{
		Name: "obtener_tarea", Description: "Leer el detalle de una tarea del proyecto autorizado. Requiere tasks:read. No carga subtareas automáticamente; consultarlas con listar_tareas. texto_truncado indica si se acotaron textos antiguos a 4000 caracteres por campo.", Annotations: read,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in GetTaskInput) (*mcp.CallToolResult, models.IntegrationTask, error) {
		var out models.IntegrationTask
		path, err := tasksPath(in.ProyectoID)
		if in.TareaID <= 0 || in.TareaID > math.MaxInt32 {
			err = errors.New("tarea_id debe ser un entero positivo de 32 bits")
		}
		if err == nil {
			err = c.request(ctx, http.MethodGet, path+"/"+strconv.Itoa(in.TareaID), nil, &out)
		}
		return nil, out, err
	})
}
