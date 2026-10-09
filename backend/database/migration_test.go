package database_test

import (
	"context"
	"io/fs"
	"regexp"
	"strings"
	"testing"
	"testing/fstest"

	"cassandra/database"
	"cassandra/internal/testdb"

	"github.com/jackc/pgx/v5"
)

// migraciones arma un origen de migraciones de test con los archivos dados.
func migraciones(files map[string]string) fstest.MapFS {
	fsys := fstest.MapFS{}
	for name, sql := range files {
		fsys["m/"+name] = &fstest.MapFile{Data: []byte(sql)}
	}
	return fsys
}

var v1 = map[string]string{
	"000001_uno.up.sql":   "CREATE TABLE uno (id INT);",
	"000001_uno.down.sql": "DROP TABLE uno;",
}

var v2 = map[string]string{
	"000001_uno.up.sql":   "CREATE TABLE uno (id INT);",
	"000001_uno.down.sql": "DROP TABLE uno;",
	"000002_dos.up.sql":   "CREATE TABLE dos (id INT);",
	"000002_dos.down.sql": "DROP TABLE dos;",
}

func version(t *testing.T, url string) (int, bool) {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var v int
	var dirty bool
	if err := conn.QueryRow(ctx, "SELECT version, dirty FROM schema_migrations").Scan(&v, &dirty); err != nil {
		t.Fatal(err)
	}
	return v, dirty
}

func tableExists(t *testing.T, url, table string) bool {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var ok bool
	if err := conn.QueryRow(ctx, "SELECT to_regclass($1) IS NOT NULL", table).Scan(&ok); err != nil {
		t.Fatal(err)
	}
	return ok
}

// Tras un deploy fallido, el binario anterior arranca sobre una base que ya tiene
// migraciones que él no conoce.
func TestBinarioAnteriorArrancaSobreBaseMasNueva(t *testing.T) {
	url := testdb.NewEmpty(t, "migraciones_nueva")
	if err := database.RunMigrationsFrom(url, migraciones(v2), "m"); err != nil {
		t.Fatalf("versión nueva: %v", err)
	}
	if err := database.RunMigrationsFrom(url, migraciones(v1), "m"); err != nil {
		t.Fatalf("el binario anterior debe arrancar: %v", err)
	}
	if v, dirty := version(t, url); v != 2 || dirty {
		t.Fatalf("la base no debe cambiar: versión %d dirty=%v", v, dirty)
	}
}

// Una migración que falla se deshace entera y deja la base limpia en la versión
// anterior, para que el binario anterior pueda arrancar.
func TestMigracionFallidaDejaLaVersionAnterior(t *testing.T) {
	url := testdb.NewEmpty(t, "migraciones_rota")
	if err := database.RunMigrationsFrom(url, migraciones(v1), "m"); err != nil {
		t.Fatal(err)
	}

	rota := map[string]string{
		"000001_uno.up.sql":   v1["000001_uno.up.sql"],
		"000001_uno.down.sql": v1["000001_uno.down.sql"],
		// La primera sentencia funciona y la segunda falla: no debe quedar nada.
		"000002_rota.up.sql":   "CREATE TABLE parcial (id INT); SELECT * FROM no_existe;",
		"000002_rota.down.sql": "DROP TABLE parcial;",
	}
	err := database.RunMigrationsFrom(url, migraciones(rota), "m")
	if err == nil {
		t.Fatal("la migración rota debe devolver un error")
	}
	if !strings.Contains(err.Error(), "se deshizo") {
		t.Errorf("el error debe decir que se deshizo: %v", err)
	}
	if v, dirty := version(t, url); v != 1 || dirty {
		t.Fatalf("se esperaba versión 1 limpia, hay %d dirty=%v", v, dirty)
	}
	if tableExists(t, url, "parcial") {
		t.Error("la sentencia que funcionó debe haberse deshecho")
	}

	// El binario anterior arranca sin intervención.
	if err := database.RunMigrationsFrom(url, migraciones(v1), "m"); err != nil {
		t.Fatalf("el binario anterior debe arrancar: %v", err)
	}
}

// Si la primera migración falla, la base queda como si nunca se hubiera migrado.
func TestPrimeraMigracionFallida(t *testing.T) {
	url := testdb.NewEmpty(t, "migraciones_primera")
	rota := map[string]string{
		"000001_rota.up.sql":   "SELECT * FROM no_existe;",
		"000001_rota.down.sql": "SELECT 1;",
	}
	if err := database.RunMigrationsFrom(url, migraciones(rota), "m"); err == nil {
		t.Fatal("la migración rota debe devolver un error")
	}
	if err := database.RunMigrationsFrom(url, migraciones(v1), "m"); err != nil {
		t.Fatalf("después de arreglarla debe migrar: %v", err)
	}
	if v, dirty := version(t, url); v != 1 || dirty {
		t.Fatalf("se esperaba versión 1 limpia, hay %d dirty=%v", v, dirty)
	}
}

// Una base que ya estaba dirty al arrancar no se toca: no se sabe qué la dejó así.
func TestBaseYaDirtyNoSeToca(t *testing.T) {
	url := testdb.NewEmpty(t, "migraciones_dirty")
	if err := database.RunMigrationsFrom(url, migraciones(v1), "m"); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, "UPDATE schema_migrations SET dirty = true"); err != nil {
		t.Fatal(err)
	}
	conn.Close(ctx)

	if err := database.RunMigrationsFrom(url, migraciones(v2), "m"); err == nil {
		t.Fatal("una base dirty debe devolver un error")
	}
	if v, dirty := version(t, url); v != 1 || !dirty {
		t.Fatalf("la marca no debe cambiar: versión %d dirty=%v", v, dirty)
	}
}

// Deshacer una migración fallida solo es seguro si cada archivo corre en una única
// transacción implícita. Estas sentencias la romperían.
func TestMigracionesSinControlDeTransaccion(t *testing.T) {
	prohibido := regexp.MustCompile(`(?i)(\bBEGIN\s*;|\bCOMMIT\b|\bROLLBACK\b|\bCONCURRENTLY\b)`)
	comentarios := regexp.MustCompile(`--[^\n]*`)
	// Cuerpos de funciones PL/pgSQL: su BEGIN … END no es control de transacción.
	cuerpos := regexp.MustCompile(`(?s)\$\$.*?\$\$`)

	err := fs.WalkDir(database.MigrationFS(), "migrations", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, err := fs.ReadFile(database.MigrationFS(), path)
		if err != nil {
			return err
		}
		sql := cuerpos.ReplaceAllString(comentarios.ReplaceAllString(string(data), ""), "")
		if m := prohibido.FindString(sql); m != "" {
			t.Errorf("%s usa %q: cada migración debe ser una sola transacción implícita", path, m)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
