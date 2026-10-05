package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Recurso identifica una tabla cuyos registros pertenecen a un usuario.
type Recurso string

const (
	Proyecto           Recurso = "proyecto"
	Tarea              Recurso = "tarea"
	Persona            Recurso = "persona"
	Banco              Recurso = "banco"
	GrupoFinanzas      Recurso = "grupo de finanzas"
	MovimientoEsperado Recurso = "movimiento esperado"
)

// Consultas fijas por recurso: nada del SQL proviene de la petición.
var ownershipQueries = map[Recurso]string{
	Proyecto:           `SELECT EXISTS (SELECT 1 FROM proyectos WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
	Tarea:              `SELECT EXISTS (SELECT 1 FROM tareas_proyectos WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
	Persona:            `SELECT EXISTS (SELECT 1 FROM persona WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
	Banco:              `SELECT EXISTS (SELECT 1 FROM banco WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
	GrupoFinanzas:      `SELECT EXISTS (SELECT 1 FROM grupo_item_finanzas WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
	MovimientoEsperado: `SELECT EXISTS (SELECT 1 FROM movimiento_esperado_finanzas WHERE id = $1 AND user_id = $2 AND eliminado = false)`,
}

// ErrNoEncontrado: el recurso referenciado no existe, está borrado o es de otro usuario.
// No se distingue entre esos casos para no revelar datos ajenos.
var ErrNoEncontrado = errors.New("recurso no encontrado")

// Ref es una referencia a verificar. ID <= 0 significa "sin referencia" y se omite.
type Ref struct {
	Recurso Recurso
	ID      int
}

// Ownership verifica que los recursos referenciados en una petición sean del usuario.
type Ownership struct {
	db *pgxpool.Pool
}

func NewOwnership(db *pgxpool.Pool) *Ownership {
	return &Ownership{db: db}
}

// Check devuelve ErrNoEncontrado (envuelto) si alguna referencia no es del usuario.
func (o *Ownership) Check(ctx context.Context, userID int, refs ...Ref) error {
	for _, ref := range refs {
		if ref.ID <= 0 {
			continue
		}
		query, ok := ownershipQueries[ref.Recurso]
		if !ok {
			return fmt.Errorf("ownership: recurso desconocido %q", ref.Recurso)
		}
		var owned bool
		if err := o.db.QueryRow(ctx, query, ref.ID, userID).Scan(&owned); err != nil {
			return fmt.Errorf("ownership: verificando %s %d: %w", ref.Recurso, ref.ID, err)
		}
		if !owned {
			return fmt.Errorf("%w: %s %d", ErrNoEncontrado, ref.Recurso, ref.ID)
		}
	}
	return nil
}
