package repository

import (
	"context"
	"log"

	"cassandra/internal/pronostico"
	"cassandra/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SemanasVentana es cuántas semanas hacia atrás se usan para el ritmo de un proyecto.
const SemanasVentana = 8

// PronosticosRepository calcula pronósticos a partir de lo que el usuario hizo.
type PronosticosRepository struct {
	db *pgxpool.Pool
}

func NewPronosticosRepository(db *pgxpool.Pool) *PronosticosRepository {
	return &PronosticosRepository{db: db}
}

// Planificacion compara lo que tardaron los proyectos completados con su fecha límite.
func (r *PronosticosRepository) Planificacion(ctx context.Context, userID int) (*models.Planificacion, error) {
	rows, err := r.db.Query(ctx, `
		SELECT extract(epoch FROM fecha_terminado - fecha_creacion) / extract(epoch FROM fecha_limite - fecha_creacion),
		       fecha_terminado::date <= fecha_limite::date
		FROM proyectos
		WHERE user_id = $1 AND eliminado = false AND estado = 'Completado'
		  AND fecha_terminado IS NOT NULL AND fecha_limite IS NOT NULL
		  AND fecha_limite > fecha_creacion`, userID)
	if err != nil {
		log.Printf("[REPO:Pronosticos.Planificacion] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	defer rows.Close()

	res := &models.Planificacion{}
	var factores []float64
	for rows.Next() {
		var factor float64
		var aTiempo bool
		if err := rows.Scan(&factor, &aTiempo); err != nil {
			return nil, err
		}
		factores = append(factores, factor)
		if aTiempo {
			res.ATiempo++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	res.Proyectos = len(factores)
	if len(factores) >= pronostico.MinProyectos {
		m := pronostico.Mediana(factores)
		res.Factor = &m
	}
	return res, nil
}

// Proyecto pronostica cuándo terminaría el proyecto al ritmo de sus últimas semanas.
// La pertenencia se verifica en el handler; aquí además se filtra por usuario.
func (r *PronosticosRepository) Proyecto(ctx context.Context, userID, proyectoID int) (*models.PronosticoProyecto, error) {
	res := &models.PronosticoProyecto{SemanasVentana: SemanasVentana}

	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM tareas_proyectos
			 WHERE user_id = $1 AND proyecto_id = $2 AND eliminado = false
			   AND estado NOT IN ('Terminado', 'Completado')),
			(SELECT count(*) FROM eventos
			 WHERE user_id = $1 AND entidad = 'proyecto' AND entidad_id = $2 AND accion = 'modificado'
			   AND jsonb_typeof(cambios -> 'fecha_limite' -> 'antes') = 'string'
			   AND jsonb_typeof(cambios -> 'fecha_limite' -> 'despues') = 'string'
			   -- El frontend guarda la fecha límite como medianoche UTC: se compara el día en UTC.
			   AND ((cambios -> 'fecha_limite' ->> 'antes')::timestamptz AT TIME ZONE 'UTC')::date
			       <> ((cambios -> 'fecha_limite' ->> 'despues')::timestamptz AT TIME ZONE 'UTC')::date)`,
		userID, proyectoID).Scan(&res.TareasAbiertas, &res.CambiosFechaLimite)
	if err != nil {
		log.Printf("[REPO:Pronosticos.Proyecto] Error en SQL de conteos: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		return nil, err
	}

	// Tareas cerradas por semana (semana 0 = los últimos 7 días). Las que se registran
	// ya hechas cuentan igual: son trabajo real.
	rows, err := r.db.Query(ctx, `
		SELECT floor(extract(epoch FROM now() - fecha_terminado) / 604800)::int AS semana, count(*)
		FROM tareas_proyectos
		WHERE user_id = $1 AND proyecto_id = $2 AND eliminado = false
		  AND fecha_terminado > now() - make_interval(weeks => $3)
		GROUP BY 1`, userID, proyectoID, SemanasVentana)
	if err != nil {
		log.Printf("[REPO:Pronosticos.Proyecto] Error en SQL de ritmo: %v | user_id=%d proyecto_id=%d", err, userID, proyectoID)
		return nil, err
	}
	defer rows.Close()
	porSemana := make([]int, SemanasVentana)
	for rows.Next() {
		var semana, n int
		if err := rows.Scan(&semana, &n); err != nil {
			return nil, err
		}
		if semana >= 0 && semana < SemanasVentana {
			porSemana[semana] += n
			res.TerminadasVentana += n
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if rango, ok := pronostico.Semanas(res.TareasAbiertas, porSemana, uint64(proyectoID)); ok {
		res.SemanasMin, res.SemanasMax = &rango.SemanasMin, &rango.SemanasMax
	}
	return res, nil
}
