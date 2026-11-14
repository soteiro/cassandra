package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"cassandra/internal/calendario"
	"cassandra/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CalendarioRepository guarda los calendarios propios (turnos y actividades) y arma el
// rango que dibuja el calendario, junto con los deadlines de tareas y proyectos.
type CalendarioRepository struct {
	db *pgxpool.Pool
}

func NewCalendarioRepository(db *pgxpool.Pool) *CalendarioRepository {
	return &CalendarioRepository{db: db}
}

// El ciclo que se muestra en la configuración es el último que se fijó.
const calendarioCols = `c.id, c.nombre, c.color, c.tipo, c.oculto,
	(SELECT to_char(cc.ancla, 'YYYY-MM-DD') FROM calendario_ciclos cc
	  WHERE cc.calendario_id = c.id ORDER BY cc.desde DESC LIMIT 1)`

func scanCalendario(row pgx.Row) (*models.Calendario, error) {
	var c models.Calendario
	if err := row.Scan(&c.ID, &c.Nombre, &c.Color, &c.Tipo, &c.Oculto, &c.PrimerLargo); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CalendarioRepository) List(ctx context.Context, userID int) ([]models.Calendario, error) {
	rows, err := r.db.Query(ctx, `SELECT `+calendarioCols+` FROM calendarios c
		WHERE c.user_id = $1 AND c.eliminado = false ORDER BY c.id`, userID)
	if err != nil {
		log.Printf("[REPO:Calendario.List] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	defer rows.Close()
	cals := []models.Calendario{}
	for rows.Next() {
		c, err := scanCalendario(rows)
		if err != nil {
			return nil, err
		}
		cals = append(cals, *c)
	}
	return cals, rows.Err()
}

func (r *CalendarioRepository) Get(ctx context.Context, id, userID int) (*models.Calendario, error) {
	return scanCalendario(r.db.QueryRow(ctx, `SELECT `+calendarioCols+` FROM calendarios c
		WHERE c.id = $1 AND c.user_id = $2 AND c.eliminado = false`, id, userID))
}

func (r *CalendarioRepository) Create(ctx context.Context, userID int, req *models.CalendarioRequest) (*models.Calendario, error) {
	var id int
	err := r.db.QueryRow(ctx, `INSERT INTO calendarios (user_id, nombre, color, tipo)
		VALUES ($1, $2, $3, $4) RETURNING id`, userID, req.Nombre, req.Color, req.Tipo).Scan(&id)
	if err != nil {
		log.Printf("[REPO:Calendario.Create] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	return r.Get(ctx, id, userID)
}

func (r *CalendarioRepository) Update(ctx context.Context, id, userID int, req *models.CalendarioUpdateRequest) (*models.Calendario, error) {
	tag, err := r.db.Exec(ctx, `UPDATE calendarios
		SET nombre = COALESCE($1, nombre), color = COALESCE($2, color), oculto = COALESCE($3, oculto)
		WHERE id = $4 AND user_id = $5 AND eliminado = false`, req.Nombre, req.Color, req.Oculto, id, userID)
	if err != nil {
		log.Printf("[REPO:Calendario.Update] Error en SQL: %v | id=%d user_id=%d", err, id, userID)
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("%w: calendario %d", ErrNoEncontrado, id)
	}
	return r.Get(ctx, id, userID)
}

func (r *CalendarioRepository) Delete(ctx context.Context, id, userID int) error {
	tag, err := r.db.Exec(ctx, `UPDATE calendarios SET eliminado = true
		WHERE id = $1 AND user_id = $2 AND eliminado = false`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w: calendario %d", ErrNoEncontrado, id)
	}
	return nil
}

// SetCiclo fija el primer Largo: rige desde esa fecha y reemplaza los ciclos fijados
// desde ese día en adelante. Lo anterior queda como estaba.
func (r *CalendarioRepository) SetCiclo(ctx context.Context, calendarioID int, primerLargo time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM calendario_ciclos WHERE calendario_id = $1 AND desde >= $2::date`,
		calendarioID, primerLargo); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO calendario_ciclos (calendario_id, desde, ancla) VALUES ($1, $2::date, $2::date)`,
		calendarioID, primerLargo); err != nil {
		log.Printf("[REPO:Calendario.SetCiclo] Error en SQL: %v | calendario_id=%d", err, calendarioID)
		return err
	}
	return tx.Commit(ctx)
}

func (r *CalendarioRepository) SetExcepcion(ctx context.Context, calendarioID int, fecha time.Time, codigo string) error {
	_, err := r.db.Exec(ctx, `INSERT INTO calendario_excepciones (calendario_id, fecha, codigo)
		VALUES ($1, $2::date, $3) ON CONFLICT (calendario_id, fecha) DO UPDATE SET codigo = EXCLUDED.codigo`,
		calendarioID, fecha, codigo)
	return err
}

func (r *CalendarioRepository) DeleteExcepcion(ctx context.Context, calendarioID int, fecha time.Time) error {
	_, err := r.db.Exec(ctx, `DELETE FROM calendario_excepciones WHERE calendario_id = $1 AND fecha = $2::date`,
		calendarioID, fecha)
	return err
}

// ActividadInput es una actividad ya validada por el handler.
type ActividadInput struct {
	Titulo     string
	Fecha      time.Time
	HoraInicio string
	HoraFin    string
	DiasSemana []int16
	Hasta      *time.Time
}

const actividadCols = `a.id, a.calendario_id, a.titulo, to_char(a.fecha, 'YYYY-MM-DD'),
	to_char(a.hora_inicio, 'HH24:MI'), to_char(a.hora_fin, 'HH24:MI'), a.dias_semana,
	to_char(a.hasta, 'YYYY-MM-DD')`

func scanActividad(row pgx.Row) (*models.Actividad, error) {
	var a models.Actividad
	var dias []int16
	if err := row.Scan(&a.ID, &a.CalendarioID, &a.Titulo, &a.Fecha, &a.HoraInicio, &a.HoraFin, &dias, &a.Hasta); err != nil {
		return nil, err
	}
	a.DiasSemana = make([]int, len(dias))
	for i, d := range dias {
		a.DiasSemana[i] = int(d)
	}
	return &a, nil
}

func (r *CalendarioRepository) GetActividad(ctx context.Context, id, userID int) (*models.Actividad, error) {
	return scanActividad(r.db.QueryRow(ctx, `SELECT `+actividadCols+`
		FROM calendario_actividades a JOIN calendarios c ON c.id = a.calendario_id
		WHERE a.id = $1 AND c.user_id = $2 AND a.eliminado = false AND c.eliminado = false`, id, userID))
}

func (r *CalendarioRepository) CreateActividad(ctx context.Context, calendarioID, userID int, in *ActividadInput) (*models.Actividad, error) {
	var id int
	err := r.db.QueryRow(ctx, `INSERT INTO calendario_actividades
		(calendario_id, titulo, fecha, hora_inicio, hora_fin, dias_semana, hasta)
		VALUES ($1, $2, $3::date, $4::time, $5::time, $6, $7::date) RETURNING id`,
		calendarioID, in.Titulo, in.Fecha, in.HoraInicio, in.HoraFin, in.DiasSemana, in.Hasta).Scan(&id)
	if err != nil {
		log.Printf("[REPO:Calendario.CreateActividad] Error en SQL: %v | calendario_id=%d", err, calendarioID)
		return nil, err
	}
	return r.GetActividad(ctx, id, userID)
}

func (r *CalendarioRepository) UpdateActividad(ctx context.Context, id, userID int, in *ActividadInput) (*models.Actividad, error) {
	tag, err := r.db.Exec(ctx, `UPDATE calendario_actividades a
		SET titulo = $1, fecha = $2::date, hora_inicio = $3::time, hora_fin = $4::time, dias_semana = $5, hasta = $6::date
		FROM calendarios c
		WHERE a.id = $7 AND c.id = a.calendario_id AND c.user_id = $8 AND a.eliminado = false AND c.eliminado = false`,
		in.Titulo, in.Fecha, in.HoraInicio, in.HoraFin, in.DiasSemana, in.Hasta, id, userID)
	if err != nil {
		log.Printf("[REPO:Calendario.UpdateActividad] Error en SQL: %v | id=%d", err, id)
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("%w: actividad %d", ErrNoEncontrado, id)
	}
	return r.GetActividad(ctx, id, userID)
}

func (r *CalendarioRepository) DeleteActividad(ctx context.Context, id, userID int) error {
	tag, err := r.db.Exec(ctx, `UPDATE calendario_actividades a SET eliminado = true
		FROM calendarios c
		WHERE a.id = $1 AND c.id = a.calendario_id AND c.user_id = $2 AND a.eliminado = false`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w: actividad %d", ErrNoEncontrado, id)
	}
	return nil
}

// SetCancelada marca o desmarca que la actividad no ocurre ese día.
func (r *CalendarioRepository) SetCancelada(ctx context.Context, actividadID int, fecha time.Time, cancelada bool) error {
	var err error
	if cancelada {
		_, err = r.db.Exec(ctx, `INSERT INTO calendario_cancelaciones (actividad_id, fecha)
			VALUES ($1, $2::date) ON CONFLICT DO NOTHING`, actividadID, fecha)
	} else {
		_, err = r.db.Exec(ctx, `DELETE FROM calendario_cancelaciones WHERE actividad_id = $1 AND fecha = $2::date`,
			actividadID, fecha)
	}
	return err
}

// Rango arma todo lo que hay que dibujar entre desde y hasta. hoy decide qué deadlines
// están atrasados: los vencidos y pendientes se incluyen aunque queden antes del rango.
func (r *CalendarioRepository) Rango(ctx context.Context, userID int, desde, hasta, hoy time.Time) (*models.CalendarioRango, error) {
	res := &models.CalendarioRango{
		Desde: desde.Format(calendario.Layout), Hasta: hasta.Format(calendario.Layout),
		Deadlines: []models.Deadline{}, Turnos: []models.TurnoDia{}, Ocurrencias: []models.OcurrenciaDia{},
	}
	if err := r.db.QueryRow(ctx, `SELECT calendario_ocultar_deadlines FROM users WHERE id = $1 AND eliminado = false`,
		userID).Scan(&res.OcultarDeadlines); err != nil {
		return nil, err
	}
	cals, err := r.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	res.Calendarios = cals

	if res.Deadlines, err = r.deadlines(ctx, userID, desde, hasta, hoy); err != nil {
		return nil, err
	}
	for _, c := range cals {
		if c.Tipo != "turnos" {
			continue
		}
		turnos, err := r.turnos(ctx, c.ID, desde.AddDate(0, 0, -1), hasta)
		if err != nil {
			return nil, err
		}
		res.Turnos = append(res.Turnos, turnos...)
	}
	if res.Ocurrencias, err = r.ocurrencias(ctx, userID, desde, hasta); err != nil {
		return nil, err
	}
	return res, nil
}

func (r *CalendarioRepository) deadlines(ctx context.Context, userID int, desde, hasta, hoy time.Time) ([]models.Deadline, error) {
	// Fechas guardadas como medianoche UTC del día (como proyectos.fecha_limite).
	rows, err := r.db.Query(ctx, `
		SELECT 'tarea', t.id, t.nombre, t.proyecto_id, COALESCE(p.nombre, ''), COALESCE(t.estado, ''),
		       to_char((t.fecha_inicio AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD'),
		       to_char((t.fecha_limite AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
		FROM tareas_proyectos t
		JOIN proyectos p ON p.id = t.proyecto_id AND p.user_id = t.user_id AND p.eliminado = false
		WHERE t.user_id = $1 AND t.eliminado = false AND t.fecha_limite IS NOT NULL
		  AND COALESCE(t.estado, '') NOT IN ('Terminado', 'Completado', 'Cancelado')
		  AND (COALESCE(t.fecha_inicio, t.fecha_limite) AT TIME ZONE 'UTC')::date <= $3::date
		  AND ((t.fecha_limite AT TIME ZONE 'UTC')::date >= $2::date OR (t.fecha_limite AT TIME ZONE 'UTC')::date < $4::date)
		UNION ALL
		SELECT 'proyecto', p.id, p.nombre, p.id, p.nombre, p.estado,
		       to_char((p.fecha_inicio AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD'),
		       to_char((p.fecha_limite AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
		FROM proyectos p
		WHERE p.user_id = $1 AND p.eliminado = false AND p.fecha_limite IS NOT NULL
		  AND p.estado NOT IN ('Completado', 'Cancelado')
		  AND (COALESCE(p.fecha_inicio, p.fecha_limite) AT TIME ZONE 'UTC')::date <= $3::date
		  AND ((p.fecha_limite AT TIME ZONE 'UTC')::date >= $2::date OR (p.fecha_limite AT TIME ZONE 'UTC')::date < $4::date)
		ORDER BY 8, 3`, userID, desde, hasta, hoy)
	if err != nil {
		log.Printf("[REPO:Calendario.deadlines] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	defer rows.Close()
	out := []models.Deadline{}
	for rows.Next() {
		var d models.Deadline
		if err := rows.Scan(&d.Tipo, &d.ID, &d.Titulo, &d.ProyectoID, &d.ProyectoNombre, &d.Estado, &d.FechaInicio, &d.FechaLimite); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *CalendarioRepository) turnos(ctx context.Context, calendarioID int, desde, hasta time.Time) ([]models.TurnoDia, error) {
	rows, err := r.db.Query(ctx, `SELECT desde, ancla FROM calendario_ciclos WHERE calendario_id = $1 ORDER BY desde`, calendarioID)
	if err != nil {
		return nil, err
	}
	var ciclos []calendario.Ciclo
	for rows.Next() {
		var c calendario.Ciclo
		if err := rows.Scan(&c.Desde, &c.Ancla); err != nil {
			rows.Close()
			return nil, err
		}
		ciclos = append(ciclos, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	exc := map[string]string{}
	rows, err = r.db.Query(ctx, `SELECT to_char(fecha, 'YYYY-MM-DD'), codigo FROM calendario_excepciones
		WHERE calendario_id = $1 AND fecha BETWEEN $2::date AND $3::date`, calendarioID, desde, hasta)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var f, cod string
		if err := rows.Scan(&f, &cod); err != nil {
			rows.Close()
			return nil, err
		}
		exc[f] = cod
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := []models.TurnoDia{}
	for d := calendario.Dia(desde); !d.After(calendario.Dia(hasta)); d = d.AddDate(0, 0, 1) {
		f := d.Format(calendario.Layout)
		base := calendario.TurnoBase(d, ciclos)
		codigo := base
		if e, ok := exc[f]; ok {
			codigo = e
		}
		if codigo == "" {
			continue
		}
		out = append(out, models.TurnoDia{CalendarioID: calendarioID, Fecha: f, Codigo: codigo, Base: base, Cambio: codigo != base})
	}
	return out, nil
}

func (r *CalendarioRepository) ocurrencias(ctx context.Context, userID int, desde, hasta time.Time) ([]models.OcurrenciaDia, error) {
	rows, err := r.db.Query(ctx, `SELECT `+actividadCols+`
		FROM calendario_actividades a JOIN calendarios c ON c.id = a.calendario_id
		WHERE c.user_id = $1 AND c.eliminado = false AND a.eliminado = false
		  AND a.fecha <= $3::date AND (a.hasta IS NULL OR a.hasta >= $2::date)
		  AND (cardinality(a.dias_semana) > 0 OR a.fecha >= $2::date)
		ORDER BY a.hora_inicio, a.id`, userID, desde, hasta)
	if err != nil {
		log.Printf("[REPO:Calendario.ocurrencias] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	var acts []models.Actividad
	for rows.Next() {
		a, err := scanActividad(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		acts = append(acts, *a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	canceladas := map[string]bool{}
	rows, err = r.db.Query(ctx, `SELECT k.actividad_id, to_char(k.fecha, 'YYYY-MM-DD')
		FROM calendario_cancelaciones k
		JOIN calendario_actividades a ON a.id = k.actividad_id
		JOIN calendarios c ON c.id = a.calendario_id
		WHERE c.user_id = $1 AND k.fecha BETWEEN $2::date AND $3::date`, userID, desde, hasta)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int
		var f string
		if err := rows.Scan(&id, &f); err != nil {
			rows.Close()
			return nil, err
		}
		canceladas[fmt.Sprintf("%d|%s", id, f)] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := []models.OcurrenciaDia{}
	for _, a := range acts {
		regla, err := reglaDe(a)
		if err != nil {
			return nil, err
		}
		for _, d := range calendario.Ocurrencias(regla, desde, hasta) {
			f := d.Format(calendario.Layout)
			out = append(out, models.OcurrenciaDia{
				ActividadID: a.ID, CalendarioID: a.CalendarioID, Fecha: f, Titulo: a.Titulo,
				HoraInicio: a.HoraInicio, HoraFin: a.HoraFin, Semanal: len(a.DiasSemana) > 0,
				Cancelada: canceladas[fmt.Sprintf("%d|%s", a.ID, f)],
			})
		}
	}
	return out, nil
}

func reglaDe(a models.Actividad) (calendario.Regla, error) {
	fecha, err := calendario.ParseDia(a.Fecha)
	if err != nil {
		return calendario.Regla{}, err
	}
	regla := calendario.Regla{Fecha: fecha, Dias: a.DiasSemana}
	if a.Hasta != nil {
		h, err := calendario.ParseDia(*a.Hasta)
		if err != nil {
			return calendario.Regla{}, err
		}
		regla.Hasta = &h
	}
	return regla, nil
}
