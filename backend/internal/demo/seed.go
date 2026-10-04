// Package demo carga datos de ejemplo ficticios en una base vacía (entorno de QA o
// para probar una instalación nueva). Se niega a tocar una base que ya tenga usuarios.
package demo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cassandra/internal/admin"
	"cassandra/models"
	"cassandra/repository"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotEmpty protege de sembrar sobre una base con datos reales.
var ErrNotEmpty = errors.New("la base de datos ya tiene usuarios: seed-demo solo se ejecuta sobre una base vacía")

// Summary resume lo que se creó.
type Summary struct {
	Email       string
	Proyectos   int
	Tareas      int
	Personas    int
	Movimientos int
}

// Seed crea un usuario demo y datos de ejemplo de cada módulo. now fija el mes de las finanzas.
func Seed(ctx context.Context, db *pgxpool.Pool, email, password string, now time.Time) (*Summary, error) {
	var users int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&users); err != nil {
		return nil, err
	}
	if users > 0 {
		return nil, ErrNotEmpty
	}

	s := &seeder{
		ctx:       ctx,
		proyectos: repository.NewProyectRepository(db),
		tareas:    repository.NewTareasRepository(db),
		notas:     repository.NewNotasProyectoRepository(db),
		docs:      repository.NewDocumentosProyectoRepository(db),
		personas:  repository.NewPersonaRepository(db),
		inter:     repository.NewInteraccionesRepository(db),
		finanzas:  repository.NewFinanzasRepository(db),
	}

	user, err := admin.CreateUser(ctx, repository.NewUserRepository(db), admin.NewUser{
		Nombre: "Usuaria Demo", Alias: "demo", Email: email, Password: password,
	})
	if err != nil {
		return nil, err
	}
	s.userID = user.ID
	s.summary.Email = user.Email

	s.proyectosYTareas()
	s.crm()
	s.finanzasDelMes(now)
	if s.err != nil {
		return nil, s.err
	}
	return &s.summary, nil
}

// seeder acumula el primer error para que el guion de datos se lea de corrido.
type seeder struct {
	ctx       context.Context
	userID    int
	err       error
	summary   Summary
	proyectos *repository.ProyectRepository
	tareas    *repository.TareasRepository
	notas     *repository.NotasProyectoRepository
	docs      *repository.DocumentosProyectoRepository
	personas  *repository.PersonaRepository
	inter     *repository.InteraccionesRepository
	finanzas  *repository.FinanzasRepository
}

func (s *seeder) fail(what string, err error) {
	if err != nil && s.err == nil {
		s.err = fmt.Errorf("seed-demo: %s: %w", what, err)
	}
}

func (s *seeder) proyecto(nombre, prioridad string, padre *int) int {
	if s.err != nil {
		return 0
	}
	p, err := s.proyectos.Create(s.ctx, &models.ProyectRequest{
		Nombre: nombre, UserID: s.userID, Prioridad: prioridad, ProyectoPadreID: padre,
		Descripcion:          "Proyecto de ejemplo.",
		PorQue:               "Para tener datos con los que probar la app.",
		ParaQue:              "Validar los flujos principales en QA.",
		CriterioFinalizacion: "Cuando todas sus tareas estén terminadas.",
	})
	s.fail("proyecto "+nombre, err)
	if p == nil {
		return 0
	}
	s.summary.Proyectos++
	return p.ID
}

func (s *seeder) tarea(proyectoID int, nombre, estado, prioridad string, padre *int) int {
	if s.err != nil {
		return 0
	}
	t, err := s.tareas.Create(s.ctx, &models.TareaRequest{
		Nombre: nombre, UserID: s.userID, ProyectID: proyectoID,
		Estado: &estado, Prioridad: &prioridad, TareaPadreID: padre,
	})
	s.fail("tarea "+nombre, err)
	if t == nil {
		return 0
	}
	s.summary.Tareas++
	return t.ID
}

func (s *seeder) proyectosYTareas() {
	cassandra := s.proyecto("Cassandra", "Alta", nil)
	s.proyecto("App Android", "Media", &cassandra)
	mudanza := s.proyecto("Mudanza", "Media", nil)
	s.proyecto("Aprender Go", "Baja", nil)

	s.tarea(cassandra, "Configurar CI", "Terminado", "alta", nil)
	deploy := s.tarea(cassandra, "Deploy por SSH", "En Curso", "urgente", nil)
	s.tarea(cassandra, "Script de deploy", "Terminado", "alta", &deploy)
	s.tarea(cassandra, "Units de systemd", "Abierto", "normal", &deploy)
	s.tarea(cassandra, "Documentar autoalojamiento", "Abierto", "normal", nil)
	s.tarea(cassandra, "Revisar accesibilidad", "Bloqueado", "baja", nil)
	s.tarea(mudanza, "Cotizar flete", "Abierto", "alta", nil)
	s.tarea(mudanza, "Embalar libros", "Pendiente", "normal", nil)

	if s.err != nil {
		return
	}
	_, err := s.notas.Create(s.ctx, &models.NotasProyectoRequest{
		ProyectoID: cassandra, UserID: s.userID,
		Nota: "Las migraciones corren al arrancar: respaldar la base antes de cada deploy a producción.",
	})
	s.fail("nota", err)
	_, err = s.notas.Create(s.ctx, &models.NotasProyectoRequest{
		ProyectoID: cassandra, UserID: s.userID, TareaID: &deploy,
		Nota: "El binario viaja por stdin del SSH y se verifica con SHA256 antes de activarlo.",
	})
	s.fail("nota de tarea", err)

	tags := "deploy, ssh"
	_, err = s.docs.Create(s.ctx, &models.CreateDocumentoRequest{
		ProyectoID: cassandra, UserID: s.userID, Tipo: "decision", Tags: &tags,
		Titulo: "ADR 001: deploy por SSH con comando forzado",
		Contenido: "# Deploy por SSH\n\n" +
			"**Decisión:** GitHub Actions entrega el binario por SSH a un script fijo del servidor.\n\n" +
			"- Sin shell interactiva para la clave de deploy\n" +
			"- Healthcheck y rollback automático\n\n" +
			"| Entorno | Puerto |\n|---|---|\n| QA | 8081 |\n| Producción | 8080 |\n",
	})
	s.fail("documento", err)
}

func (s *seeder) crm() {
	for _, p := range []struct {
		nombre, alias, entorno, info string
		interacciones                []string
	}{
		{"Ada Lovelace", "Ada", "Trabajo", "Colega del área de análisis.", []string{
			"Café para revisar el modelo de datos.",
			"Quedamos en compartir notas sobre el motor analítico.",
		}},
		{"Alan Turing", "Alan", "Universidad", "Compañero del curso de computabilidad.", []string{
			"Llamada para preparar la presentación.",
		}},
	} {
		if s.err != nil {
			return
		}
		persona, err := s.personas.Create(s.ctx, &models.PersonaRequest{
			Nombre: p.nombre, Alias: p.alias, Entorno: p.entorno, Informacion: p.info, UserID: s.userID,
		})
		s.fail("persona "+p.nombre, err)
		if persona == nil {
			return
		}
		s.summary.Personas++
		for _, texto := range p.interacciones {
			_, err := s.inter.Create(s.ctx, &models.InteraccionRequest{PersonaID: persona.ID, Interaccion: texto, UserID: s.userID})
			s.fail("interacción", err)
		}
	}
}

func (s *seeder) finanzasDelMes(now time.Time) {
	if s.err != nil {
		return
	}
	cuenta, err := s.finanzas.CreateBanco(s.ctx, &models.BancoRequest{UserID: s.userID, Nombre: "Cuenta corriente", Tipo: "debito"})
	s.fail("banco", err)
	tarjeta, err := s.finanzas.CreateBanco(s.ctx, &models.BancoRequest{UserID: s.userID, Nombre: "Tarjeta de crédito", Tipo: "credito"})
	s.fail("banco", err)
	grupos := map[string]int{}
	for _, nombre := range []string{"Hogar", "Transporte", "Ocio"} {
		g, err := s.finanzas.CreateGrupoItem(s.ctx, &models.GrupoItemFinanzasRequest{UserID: s.userID, Nombre: nombre})
		s.fail("categoría", err)
		if g != nil {
			grupos[nombre] = g.ID
		}
	}
	if s.err != nil {
		return
	}

	type mov struct {
		tipo, nombre, estado, grupo string
		monto                       int
		banco                       int
	}
	movimientos := []mov{
		{"ingreso", "Sueldo", "completado", "", 1_500_000, cuenta.ID},
		{"egreso", "Arriendo", "completado", "Hogar", 450_000, cuenta.ID},
		{"egreso", "Supermercado", "en proceso", "Hogar", 180_000, tarjeta.ID},
		{"egreso", "Transporte público", "pendiente", "Transporte", 40_000, cuenta.ID},
		{"egreso", "Streaming", "pendiente", "Ocio", 9_990, tarjeta.ID},
	}
	anterior := now.AddDate(0, -1, 0)
	for _, periodo := range []struct {
		t     time.Time
		todos bool // el mes anterior queda todo completado
	}{{anterior, true}, {now, false}} {
		for _, m := range movimientos {
			estado := m.estado
			if periodo.todos {
				estado = "completado"
			}
			req := &models.FinanzasPlantillaRequest{
				UserID: s.userID, Tipo: m.tipo, Estado: estado, Nombre: m.nombre, Monto: m.monto,
				Mes: int(periodo.t.Month()), Anio: periodo.t.Year(), BancoID: &m.banco,
			}
			if id, ok := grupos[m.grupo]; ok {
				req.GrupoItemID = &id
			}
			_, err := s.finanzas.CreatePlantilla(s.ctx, req)
			s.fail("movimiento "+m.nombre, err)
			if err == nil {
				s.summary.Movimientos++
			}
		}
	}
}
