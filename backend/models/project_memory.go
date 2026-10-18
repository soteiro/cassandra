package models

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrMemoryInvalid = errors.New("entrada de memoria inválida")
var ErrMemoryConflict = errors.New("la memoria cambió o el identificador de operación ya fue usado con otro contenido")

type MemorySource struct {
	Tipo       string `json:"tipo" jsonschema:"commit, conversacion, archivo o nota"`
	Referencia string `json:"referencia" jsonschema:"SHA, URL o referencia identificable; nunca credenciales ni transcripciones completas"`
}

type ProjectMemory struct {
	DeQueTrata string         `json:"de_que_trata"`
	EnQueQuede string         `json:"en_que_quede"`
	PorQueAsi  string         `json:"por_que_asi"`
	QueSigue   []string       `json:"que_sigue" jsonschema:"Una a tres acciones concretas, la primera es la próxima acción"`
	Fuentes    []MemorySource `json:"fuentes"`
}

type MemoryEntryInput struct {
	Titulo      string         `json:"titulo"`
	Contenido   string         `json:"contenido" jsonschema:"Hasta 150 palabras, incluyendo título"`
	Tipo        string         `json:"tipo" jsonschema:"decision o exploracion"`
	Estado      string         `json:"estado" jsonschema:"explorada, elegida, implementada o descartada"`
	Fuentes     []MemorySource `json:"fuentes"`
	SustituyeID *int64         `json:"sustituye_id,omitempty" jsonschema:"ID de una ficha del mismo proyecto a la que reemplaza"`
}

type MemoryEntry struct {
	ID int64 `json:"id"`
	MemoryEntryInput
	DocumentoID   int       `json:"documento_id"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

type MemoryWriteRequest struct {
	OperacionID      string             `json:"operacion_id" jsonschema:"Identificador estable y único del avance; reusar solo para reintentar exactamente la misma petición"`
	RevisionEsperada *int64             `json:"revision_esperada" jsonschema:"Revisión obtenida con obtener_contexto; 0 si aún no hay memoria"`
	Memoria          *ProjectMemory     `json:"memoria,omitempty" jsonschema:"Síntesis completa de reemplazo, máximo 400 palabras entre todos los apartados"`
	Fichas           []MemoryEntryInput `json:"fichas,omitempty" jsonschema:"Hasta cinco fichas nuevas; no guardar cada intervención de la conversación"`
}

type MemoryWriteResult struct {
	Revision    int64   `json:"revision"`
	DocumentoID *int    `json:"documento_id"`
	FichaIDs    []int64 `json:"ficha_ids"`
}

type MemoryProjectInfo struct {
	ID                   int    `json:"id"`
	Nombre               string `json:"nombre"`
	PorQue               string `json:"por_que"`
	ParaQue              string `json:"para_que"`
	CriterioFinalizacion string `json:"criterio_finalizacion"`
	TextoTruncado        bool   `json:"texto_truncado"`
}

type MemoryContext struct {
	Proyecto            MemoryProjectInfo `json:"proyecto"`
	Revision            int64             `json:"revision"`
	Memoria             *ProjectMemory    `json:"memoria"`
	DocumentoID         *int              `json:"documento_id"`
	FechaActualizacion  *time.Time        `json:"fecha_actualizacion"`
	Fichas              []MemoryEntry     `json:"fichas"`
	FichasVigentesTotal int               `json:"fichas_vigentes_total"`
}

type MemorySearchResult struct {
	Fichas []MemoryEntry `json:"fichas"`
	HayMas bool          `json:"hay_mas"`
}

var operationIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{8,100}$`)

func invalidMemory(msg string) error { return fmt.Errorf("%w: %s", ErrMemoryInvalid, msg) }

func validateSources(sources []MemorySource) error {
	if len(sources) < 1 || len(sources) > 10 {
		return invalidMemory("se requieren entre una y diez fuentes")
	}
	for _, s := range sources {
		if strings.ContainsRune(s.Referencia, '\x00') {
			return invalidMemory("las fuentes no pueden contener caracteres NUL")
		}
		switch s.Tipo {
		case "commit", "conversacion", "archivo", "nota":
		default:
			return invalidMemory("tipo de fuente desconocido")
		}
		if strings.TrimSpace(s.Referencia) == "" || utf8.RuneCountInString(s.Referencia) > 1024 {
			return invalidMemory("referencia de fuente vacía o demasiado larga")
		}
	}
	return nil
}

// Validate se ejecuta dentro de la operación compartida, independientemente del cliente.
func (r *MemoryWriteRequest) Validate() error {
	if !operationIDPattern.MatchString(r.OperacionID) {
		return invalidMemory("operacion_id debe tener 8–100 caracteres: letras, números, guion, punto o dos puntos")
	}
	if r.RevisionEsperada == nil || *r.RevisionEsperada < 0 {
		return invalidMemory("revision_esperada es obligatoria y no puede ser negativa")
	}
	if r.Memoria == nil && len(r.Fichas) == 0 {
		return invalidMemory("se requiere memoria o al menos una ficha")
	}
	if len(r.Fichas) > 5 {
		return invalidMemory("máximo cinco fichas por avance")
	}
	if m := r.Memoria; m != nil {
		if len(m.QueSigue) < 1 || len(m.QueSigue) > 3 {
			return invalidMemory("que_sigue debe contener de una a tres acciones")
		}
		parts := append([]string{m.DeQueTrata, m.EnQueQuede, m.PorQueAsi}, m.QueSigue...)
		for _, p := range parts {
			if strings.ContainsRune(p, '\x00') {
				return invalidMemory("la memoria no puede contener caracteres NUL")
			}
			if strings.TrimSpace(p) == "" {
				return invalidMemory("los cuatro apartados de memoria son obligatorios; indicar si falta información")
			}
		}
		all := strings.Join(parts, " ")
		if len(strings.Fields(all)) > 400 || len(all) > 24000 {
			return invalidMemory("la memoria supera el límite de 400 palabras o 24000 bytes")
		}
		if err := validateSources(m.Fuentes); err != nil {
			return err
		}
	}
	replaced := map[int64]bool{}
	for _, f := range r.Fichas {
		if strings.ContainsRune(f.Titulo+f.Contenido, '\x00') {
			return invalidMemory("las fichas no pueden contener caracteres NUL")
		}
		if strings.TrimSpace(f.Titulo) == "" || utf8.RuneCountInString(f.Titulo) > 160 || strings.TrimSpace(f.Contenido) == "" {
			return invalidMemory("cada ficha necesita un título de hasta 160 caracteres y contenido")
		}
		if len(strings.Fields(f.Titulo+" "+f.Contenido)) > 150 || len(f.Contenido) > 6000 {
			return invalidMemory("la ficha supera el límite de 150 palabras o 6000 bytes")
		}
		if f.Tipo != "decision" && f.Tipo != "exploracion" {
			return invalidMemory("tipo de ficha desconocido")
		}
		switch f.Estado {
		case "explorada", "elegida", "implementada", "descartada":
		default:
			return invalidMemory("estado de ficha desconocido")
		}
		if f.SustituyeID != nil {
			if *f.SustituyeID <= 0 || replaced[*f.SustituyeID] {
				return invalidMemory("sustituye_id inválido o repetido en el avance")
			}
			replaced[*f.SustituyeID] = true
		}
		if err := validateSources(f.Fuentes); err != nil {
			return err
		}
	}
	return nil
}

func sourceMarkdown(sources []MemorySource) string {
	var b strings.Builder
	b.WriteString("\n\n## Fuentes\n")
	for _, s := range sources {
		fmt.Fprintf(&b, "- %s: %s\n", s.Tipo, s.Referencia)
	}
	return b.String()
}

func (m ProjectMemory) Markdown() string {
	var b strings.Builder
	fmt.Fprintf(&b, "## De qué trata\n%s\n\n## En qué quedé\n%s\n\n## Por qué así\n%s\n\n## Qué sigue\n", m.DeQueTrata, m.EnQueQuede, m.PorQueAsi)
	for _, step := range m.QueSigue {
		fmt.Fprintf(&b, "- %s\n", step)
	}
	b.WriteString(sourceMarkdown(m.Fuentes))
	return b.String()
}

func (f MemoryEntryInput) Markdown() string {
	return fmt.Sprintf("Estado: **%s**\n\n%s%s", f.Estado, f.Contenido, sourceMarkdown(f.Fuentes))
}
