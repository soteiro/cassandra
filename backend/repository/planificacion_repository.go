package repository

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"slices"
	"time"

	"cassandra/internal/calendario"
	"cassandra/models"

	"github.com/jackc/pgx/v5"
)

// Planificación: horario base, bloques de trabajo y huecos libres. Vive junto al
// calendario porque los huecos salen de sus turnos y actividades.

// MinutosHuecoMinimo: huecos más cortos no se ofrecen para planificar.
const MinutosHuecoMinimo = 15

var ErrBloqueSolapado = errors.New("el bloque se solapa con otro bloque de trabajo")

const bloqueCols = `b.id, b.tarea_id, t.nombre, t.proyecto_id, p.nombre, COALESCE(t.estado, 'Abierto'),
	to_char(b.fecha, 'YYYY-MM-DD'), to_char(b.hora_inicio, 'HH24:MI'), to_char(b.hora_fin, 'HH24:MI'), b.origen
	FROM calendario_bloques b
	JOIN tareas_proyectos t ON t.id = b.tarea_id AND t.user_id = b.user_id AND t.eliminado = false
	JOIN proyectos p ON p.id = t.proyecto_id AND p.user_id = b.user_id AND p.eliminado = false`

func scanBloques(rows pgx.Rows) ([]models.Bloque, error) {
	defer rows.Close()
	out := []models.Bloque{}
	for rows.Next() {
		var b models.Bloque
		if err := rows.Scan(&b.ID, &b.TareaID, &b.Tarea, &b.ProyectoID, &b.ProyectoNombre, &b.Estado,
			&b.Fecha, &b.HoraInicio, &b.HoraFin, &b.Origen); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// bloques de trabajo vigentes del usuario entre dos fechas.
func (r *CalendarioRepository) bloques(ctx context.Context, userID int, desde, hasta time.Time) ([]models.Bloque, error) {
	rows, err := r.db.Query(ctx, `SELECT `+bloqueCols+`
		WHERE b.user_id = $1 AND NOT b.liberado AND b.fecha BETWEEN $2::date AND $3::date
		ORDER BY b.fecha, b.hora_inicio, b.id`, userID, desde, hasta)
	if err != nil {
		log.Printf("[REPO:Calendario.bloques] Error en SQL: %v | user_id=%d", err, userID)
		return nil, err
	}
	return scanBloques(rows)
}

// HorarioBase devuelve las franjas del usuario ordenadas por día y hora.
func (r *CalendarioRepository) HorarioBase(ctx context.Context, userID int) ([]models.FranjaHorario, error) {
	rows, err := r.db.Query(ctx, `SELECT dia_semana, to_char(hora_inicio, 'HH24:MI'), to_char(hora_fin, 'HH24:MI')
		FROM horario_base WHERE user_id = $1 ORDER BY dia_semana, hora_inicio`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FranjaHorario{}
	for rows.Next() {
		var f models.FranjaHorario
		if err := rows.Scan(&f.DiaSemana, &f.HoraInicio, &f.HoraFin); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// SetHorarioBase reemplaza todas las franjas del usuario.
func (r *CalendarioRepository) SetHorarioBase(ctx context.Context, userID int, franjas []models.FranjaHorario) ([]models.FranjaHorario, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM horario_base WHERE user_id = $1`, userID); err != nil {
		return nil, err
	}
	for _, f := range franjas {
		if _, err := tx.Exec(ctx, `INSERT INTO horario_base (user_id, dia_semana, hora_inicio, hora_fin)
			VALUES ($1, $2, $3::time, $4::time)`, userID, f.DiaSemana, f.HoraInicio, f.HoraFin); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.HorarioBase(ctx, userID)
}

// DeleteBloque borra un bloque del usuario. Con proyectos != nil, solo si su tarea es de
// uno de esos proyectos (lo que permite la key).
func (r *CalendarioRepository) DeleteBloque(ctx context.Context, userID, id int, proyectos []int) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM calendario_bloques b USING tareas_proyectos t
		WHERE b.id = $1 AND b.user_id = $2 AND t.id = b.tarea_id
		  AND ($3::integer[] IS NULL OR t.proyecto_id = ANY($3))`, id, userID, proyectos)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w: bloque %d", ErrNoEncontrado, id)
	}
	return nil
}

// calculo reúne todo lo que interviene en los huecos de un rango.
type calculo struct {
	desde, hasta time.Time
	cals         []models.Calendario
	turnos       []models.TurnoDia
	ocurrencias  []models.OcurrenciaDia
	bloques      []models.Bloque
	base         []models.FranjaHorario
	huecos       []calendario.Hueco
}

func minutos(s string) int {
	m, _ := calendario.HoraMin(s)
	return m
}

// calcular lee el rango y calcula los huecos libres desde `inicio` (minutos desde las
// 00:00 de desde). Usa todos los calendarios: los que la key no ve también ocupan.
func (r *CalendarioRepository) calcular(ctx context.Context, userID int, desde, hasta time.Time, inicio int) (*calculo, error) {
	c := &calculo{desde: desde, hasta: hasta}
	var err error
	if c.cals, err = r.List(ctx, userID); err != nil {
		return nil, err
	}
	disp := map[int]string{}
	for _, cal := range c.cals {
		disp[cal.ID] = cal.Disponibilidad
		if cal.Tipo != "turnos" {
			continue
		}
		// Desde el día anterior: una Noche que empieza antes del rango ocupa su mañana.
		t, err := r.turnos(ctx, cal.ID, desde.AddDate(0, 0, -1), hasta)
		if err != nil {
			return nil, err
		}
		c.turnos = append(c.turnos, t...)
	}
	if c.ocurrencias, err = r.ocurrenciasConNoche(ctx, userID, desde, hasta); err != nil {
		return nil, err
	}
	if c.bloques, err = r.bloques(ctx, userID, desde, hasta); err != nil {
		return nil, err
	}
	if c.base, err = r.HorarioBase(ctx, userID); err != nil {
		return nil, err
	}
	c.huecos = huecosDe(desde, hasta, c.cals, c.turnos, c.ocurrencias, c.bloques, c.base, inicio)
	return c, nil
}

// cruzaMedianoche: una actividad cuyo fin no es posterior a su inicio termina al día siguiente.
func cruzaMedianoche(inicio, fin string) bool { return fin <= inicio }

// ocurrenciasConNoche son las ocurrencias del rango más las del día anterior que cruzan
// la medianoche: dormir desde las 22:30 de ayer también ocupa esta mañana.
func (r *CalendarioRepository) ocurrenciasConNoche(ctx context.Context, userID int, desde, hasta time.Time) ([]models.OcurrenciaDia, error) {
	ocs, err := r.ocurrencias(ctx, userID, desde.AddDate(0, 0, -1), hasta)
	if err != nil {
		return nil, err
	}
	antes := desde.AddDate(0, 0, -1).Format(calendario.Layout)
	out := ocs[:0]
	for _, o := range ocs {
		if o.Fecha != antes || cruzaMedianoche(o.HoraInicio, o.HoraFin) {
			out = append(out, o)
		}
	}
	return out, nil
}

// huecosDe calcula el tiempo libre del rango con los datos ya leídos: horario base más lo
// que libera, menos lo que ocupa y los bloques. inicio son minutos desde las 00:00 de desde.
func huecosDe(desde, hasta time.Time, cals []models.Calendario, turnos []models.TurnoDia,
	ocurrencias []models.OcurrenciaDia, bloques []models.Bloque, base []models.FranjaHorario, inicio int) []calendario.Hueco {
	disp := map[int]string{}
	for _, cal := range cals {
		disp[cal.ID] = cal.Disponibilidad
	}
	offset := func(fecha string) int {
		d, _ := calendario.ParseDia(fecha)
		return int(d.Sub(desde).Hours()/24) * calendario.MinutosDia
	}
	var libera, ocupa []calendario.Intervalo
	agregar := func(tipo string, x calendario.Intervalo) {
		switch tipo {
		case "ocupa":
			ocupa = append(ocupa, x)
		case "libera":
			libera = append(libera, x)
		}
	}
	for _, t := range turnos {
		if ini, fin, ok := calendario.HorarioTurno(t.Codigo); ok {
			o := offset(t.Fecha)
			agregar(disp[t.CalendarioID], calendario.Intervalo{Ini: o + ini, Fin: o + fin})
		}
	}
	for _, oc := range ocurrencias {
		if oc.Cancelada {
			continue
		}
		o, ini, fin := offset(oc.Fecha), minutos(oc.HoraInicio), minutos(oc.HoraFin)
		if cruzaMedianoche(oc.HoraInicio, oc.HoraFin) {
			fin += calendario.MinutosDia
		}
		agregar(disp[oc.CalendarioID], calendario.Intervalo{Ini: o + ini, Fin: o + fin})
	}
	for _, b := range bloques {
		o := offset(b.Fecha)
		ocupa = append(ocupa, calendario.Intervalo{Ini: o + minutos(b.HoraInicio), Fin: o + minutos(b.HoraFin)})
	}
	franjas := make([]calendario.Franja, 0, len(base))
	for _, f := range base {
		franjas = append(franjas, calendario.Franja{DiaSemana: f.DiaSemana, Ini: minutos(f.HoraInicio), Fin: minutos(f.HoraFin)})
	}
	dias := int(hasta.Sub(desde).Hours()/24) + 1
	return calendario.Huecos(desde, dias, franjas, libera, ocupa, inicio, MinutosHuecoMinimo)
}

// HuecosLibres convierte huecos al formato de la API.
func huecosLibres(hs []calendario.Hueco) []models.HuecoLibre {
	out := make([]models.HuecoLibre, 0, len(hs))
	for _, h := range hs {
		out = append(out, models.HuecoLibre{Fecha: h.Fecha.Format(calendario.Layout),
			HoraInicio: calendario.FormatoHora(h.Ini), HoraFin: calendario.FormatoHora(h.Fin), Minutos: h.Minutos()})
	}
	return out
}

var nombresTurno = map[string]string{"L": "Largo", "N": "Noche", "S": "Saliente", "F": "Libre", "V": "Vacaciones", "M": "Licencia"}

// Disponibilidad arma la vista para un asistente. calendarios y proyectos limitan lo que
// se muestra con nombre (nil = todo, para una sesión normal): el tiempo ocupado de lo
// demás aparece como "Ocupado", sin título.
func (r *CalendarioRepository) Disponibilidad(ctx context.Context, userID int, desde, hasta time.Time, ahora time.Time, calendarios, proyectos []int) (*models.Disponibilidad, error) {
	inicio := int(ahora.Sub(desde).Minutes())
	c, err := r.calcular(ctx, userID, desde, hasta, inicio)
	if err != nil {
		return nil, err
	}
	ve := func(ids []int, id int) bool { return ids == nil || slices.Contains(ids, id) }
	res := &models.Disponibilidad{
		Desde: desde.Format(calendario.Layout), Hasta: hasta.Format(calendario.Layout),
		Ahora: ahora.Format("2006-01-02T15:04"), HorarioBase: c.base,
		Calendarios: []models.CalendarioVisible{}, Huecos: []models.HuecoLibre{}, Eventos: []models.EventoCalendario{},
		Bloques: []models.Bloque{}, Deadlines: []models.Deadline{}, Avisos: []string{},
	}
	disp := map[int]string{}
	for _, cal := range c.cals {
		disp[cal.ID] = cal.Disponibilidad
		if ve(calendarios, cal.ID) {
			res.Calendarios = append(res.Calendarios, models.CalendarioVisible{ID: cal.ID, Nombre: cal.Nombre, Tipo: cal.Tipo, Disponibilidad: cal.Disponibilidad})
		}
	}
	res.Huecos = huecosLibres(c.huecos)
	for _, h := range c.huecos {
		res.MinutosLibres += h.Minutos()
	}

	enRango := func(f string) bool { return f >= res.Desde && f <= res.Hasta }
	ocupado := func(e models.EventoCalendario) models.EventoCalendario {
		e.Titulo, e.CalendarioID, e.Disponibilidad = "Ocupado", nil, "ocupa"
		return e
	}
	for _, t := range c.turnos {
		if !enRango(t.Fecha) {
			continue
		}
		e := models.EventoCalendario{Fecha: t.Fecha, Titulo: nombresTurno[t.Codigo], Disponibilidad: disp[t.CalendarioID]}
		ini, fin, conHora := calendario.HorarioTurno(t.Codigo)
		if conHora {
			e.HoraInicio, e.HoraFin = calendario.FormatoHora(ini), calendario.FormatoHora(fin%calendario.MinutosDia)
			e.TerminaDiaSig = fin > calendario.MinutosDia
		}
		switch id := t.CalendarioID; {
		case ve(calendarios, id):
			e.CalendarioID = &id
			res.Eventos = append(res.Eventos, e)
		case conHora && disp[id] == "ocupa":
			res.Eventos = append(res.Eventos, ocupado(e))
		}
	}
	for _, oc := range c.ocurrencias {
		if oc.Cancelada || !enRango(oc.Fecha) {
			continue
		}
		e := models.EventoCalendario{Fecha: oc.Fecha, HoraInicio: oc.HoraInicio, HoraFin: oc.HoraFin, Titulo: oc.Titulo,
			TerminaDiaSig: cruzaMedianoche(oc.HoraInicio, oc.HoraFin), Disponibilidad: disp[oc.CalendarioID]}
		switch id := oc.CalendarioID; {
		case ve(calendarios, id):
			e.CalendarioID = &id
			res.Eventos = append(res.Eventos, e)
		case disp[id] == "ocupa":
			res.Eventos = append(res.Eventos, ocupado(e))
		}
	}
	for _, b := range c.bloques {
		if ve(proyectos, b.ProyectoID) {
			res.Bloques = append(res.Bloques, b)
		} else {
			res.Eventos = append(res.Eventos, ocupado(models.EventoCalendario{Fecha: b.Fecha, HoraInicio: b.HoraInicio, HoraFin: b.HoraFin}))
		}
	}
	slices.SortStableFunc(res.Eventos, func(a, b models.EventoCalendario) int {
		if a.Fecha != b.Fecha {
			return compare(a.Fecha, b.Fecha)
		}
		return compare(a.HoraInicio, b.HoraInicio)
	})

	deadlines, err := r.deadlines(ctx, userID, desde, hasta, calendario.Dia(ahora))
	if err != nil {
		return nil, err
	}
	for _, d := range deadlines {
		if ve(proyectos, d.ProyectoID) {
			res.Deadlines = append(res.Deadlines, d)
		}
	}
	if len(c.base) == 0 {
		res.Avisos = append(res.Avisos, "No hay horario base: los huecos solo incluyen lo que liberan los calendarios. Pedir al usuario que lo configure.")
	}
	return res, nil
}

func compare(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

// Planificar reserva bloques de trabajo para una tarea del proyecto, todos o ninguno.
// Rechaza solapes con otros bloques; si un bloque no cae entero en un hueco libre se
// guarda igual y se avisa. Un reintento con el mismo operacion_id devuelve el resultado
// original.
func (r *CalendarioRepository) Planificar(ctx context.Context, userID, projectID, taskID int, keyID int64, req models.PlanificarRequest) (*models.PlanificacionResult, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}
	payload, err := json.Marshal(struct {
		Proyecto, Tarea int
		Req             models.PlanificarRequest
	}{projectID, taskID, req})
	if err != nil {
		return nil, err
	}
	hash := fmt.Sprintf("%x", sha256.Sum256(payload))

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// Serializa las planificaciones y permite que los eventos de tareas referencien al usuario.
	if _, err := tx.Exec(ctx, `SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE`, userID); err != nil {
		return nil, err
	}
	var prevHash string
	var prev []byte
	err = tx.QueryRow(ctx, `SELECT request_hash, resultado FROM planificacion_operaciones
		WHERE user_id = $1 AND operacion_id = $2`, userID, req.OperacionID).Scan(&prevHash, &prev)
	if err == nil {
		if prevHash != hash {
			return nil, models.ErrTaskOperationConflict
		}
		var out models.PlanificacionResult
		return &out, json.Unmarshal(prev, &out)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	// El cierre de esta tarea debe ocurrir antes de planificar o después de guardar los bloques.
	var terminada bool
	if err := tx.QueryRow(ctx, `SELECT COALESCE(t.estado IN ('Terminado', 'Completado'), false) FROM tareas_proyectos t
		JOIN proyectos p ON p.id = t.proyecto_id AND p.user_id = t.user_id AND p.eliminado = false
		WHERE t.id = $1 AND t.proyecto_id = $2 AND t.user_id = $3 AND t.eliminado = false
		FOR NO KEY UPDATE OF t`, taskID, projectID, userID).Scan(&terminada); err != nil {
		return nil, err
	}
	if terminada {
		return nil, fmt.Errorf("%w: la tarea está terminada", models.ErrTaskInvalid)
	}

	// Huecos del rango de los bloques, antes de insertarlos.
	desde, hasta := "9999-12-31", "0000-01-01"
	for _, b := range req.Bloques {
		desde, hasta = min(desde, b.Fecha), max(hasta, b.Fecha)
	}
	d, _ := calendario.ParseDia(desde)
	h, _ := calendario.ParseDia(hasta)
	c, err := r.calcular(ctx, userID, d, h, 0)
	if err != nil {
		return nil, err
	}

	origen := "app"
	var key any
	if keyID != 0 {
		origen, key = "mcp", keyID
	}
	out := &models.PlanificacionResult{Bloques: []models.Bloque{}, Avisos: []string{}}
	ids := []int{}
	for _, b := range req.Bloques {
		var solapa bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM calendario_bloques b
			JOIN tareas_proyectos t ON t.id = b.tarea_id AND t.eliminado = false
			WHERE b.user_id = $1 AND NOT b.liberado AND b.fecha = $2::date
			  AND b.hora_inicio < $4::time AND $3::time < b.hora_fin)`,
			userID, b.Fecha, b.HoraInicio, b.HoraFin).Scan(&solapa); err != nil {
			return nil, err
		}
		if solapa {
			return nil, fmt.Errorf("%w: %w (%s %s–%s)", models.ErrTaskInvalid, ErrBloqueSolapado, b.Fecha, b.HoraInicio, b.HoraFin)
		}
		var bid int
		if err := tx.QueryRow(ctx, `INSERT INTO calendario_bloques (user_id, tarea_id, fecha, hora_inicio, hora_fin, origen, api_key_id)
			VALUES ($1, $2, $3::date, $4::time, $5::time, $6, $7) RETURNING id`,
			userID, taskID, b.Fecha, b.HoraInicio, b.HoraFin, origen, key).Scan(&bid); err != nil {
			return nil, err
		}
		ids = append(ids, bid)
		if !dentroDeHueco(c, b) {
			out.Avisos = append(out.Avisos, fmt.Sprintf("%s %s–%s no cae entero en un hueco libre", b.Fecha, b.HoraInicio, b.HoraFin))
		}
	}
	rows, err := tx.Query(ctx, `SELECT `+bloqueCols+` WHERE b.id = ANY($1) ORDER BY b.fecha, b.hora_inicio`, ids)
	if err != nil {
		return nil, err
	}
	if out.Bloques, err = scanBloques(rows); err != nil {
		return nil, err
	}
	result, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO planificacion_operaciones (user_id, operacion_id, request_hash, resultado, api_key_id)
		VALUES ($1, $2, $3, $4, $5)`, userID, req.OperacionID, hash, result, key); err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}

func dentroDeHueco(c *calculo, b models.BloqueInput) bool {
	ini, fin := minutos(b.HoraInicio), minutos(b.HoraFin)
	for _, h := range c.huecos {
		if h.Fecha.Format(calendario.Layout) == b.Fecha && h.Ini <= ini && fin <= h.Fin {
			return true
		}
	}
	return false
}
