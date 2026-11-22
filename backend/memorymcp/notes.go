package memorymcp

import (
	"context"
	"net/http"
	"net/url"
	"strconv"

	"cassandra/models"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type SearchNotesInput struct {
	ProyectoID int `json:"proyecto_id" jsonschema:"ID del proyecto vinculado y autorizado"`
	models.MemoryNoteQuery
}

// Las notas las escribe el usuario: aquí solo se buscan. No existe herramienta para escribirlas.
func addNoteTools(s *mcp.Server, c *Client, read *mcp.ToolAnnotations) {
	mcp.AddTool(s, &mcp.Tool{
		Name: "buscar_notas", Description: "Buscar notas que el usuario escribió en un proyecto: documentación (cómo se resolvió algo, a menudo vinculada a una tarea) y notas de negocio. Requiere memory:read. Búsqueda literal con paginación, de la más reciente a la más antigua; tarea_id filtra por tarea y 0 devuelve las notas sin tarea. Solo lectura: no hay herramientas para escribir notas.", Annotations: read,
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in SearchNotesInput) (*mcp.CallToolResult, models.MemoryNoteList, error) {
		var out models.MemoryNoteList
		path, err := projectPath(in.ProyectoID)
		if err == nil {
			err = in.MemoryNoteQuery.Validate()
		}
		if err == nil {
			q := url.Values{"q": {in.Consulta}, "limit": {strconv.Itoa(in.Limit)}, "offset": {strconv.Itoa(in.Offset)}}
			if in.TareaID != nil {
				q.Set("tarea_id", strconv.Itoa(*in.TareaID))
			}
			err = c.request(ctx, http.MethodGet, path+"/notes?"+q.Encode(), nil, &out)
		}
		return nil, out, err
	})
}
