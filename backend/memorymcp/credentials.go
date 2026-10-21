package memorymcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

// LinkFile vincula un repositorio con su proyecto de Cassandra. Nunca contiene secretos.
const LinkFile = ".cassandra-memory.json"

var hostDirUnsafe = regexp.MustCompile(`[^a-z0-9._-]`)

// ResolveAPIKey devuelve la key que debe usar el conector. CASSANDRA_API_KEY manda;
// si falta, busca el proyecto vinculado desde startDir hacia arriba (sin salir del
// repositorio) y lee <keysDir>/<servidor>/<proyecto_id>.key. Así un único MCP global
// usa una key distinta por proyecto. La carpeta por servidor evita que un
// .cassandra-memory.json ajeno redirija una key a otro host: el destino es siempre
// CASSANDRA_URL.
func ResolveAPIKey(envKey, baseURL, startDir, keysDir string) (string, error) {
	if envKey != "" {
		return envKey, nil
	}
	u, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || u.Host == "" {
		return "", errors.New("CASSANDRA_URL inválida: no se puede localizar la key del proyecto")
	}
	hostDir := hostDirUnsafe.ReplaceAllString(strings.ToLower(u.Host), "_")
	if strings.HasPrefix(hostDir, ".") {
		return "", errors.New("CASSANDRA_URL inválida: servidor no admitido para guardar keys")
	}
	id, err := linkedProject(startDir)
	if err != nil {
		return "", err
	}
	path := filepath.Join(keysDir, hostDir, strconv.Itoa(id)+".key")
	key, err := readKeyFile(path)
	if err != nil {
		return "", fmt.Errorf("falta la key del proyecto %d para %s: %w", id, u.Host, err)
	}
	return key, nil
}

// DefaultKeysDir es CASSANDRA_KEYS_DIR o, en su defecto, <config de usuario>/cassandra-memory.
func DefaultKeysDir(override string) (string, error) {
	if override != "" {
		return override, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", errors.New("no se pudo determinar la carpeta de configuración; definir CASSANDRA_KEYS_DIR")
	}
	return filepath.Join(base, "cassandra-memory"), nil
}

func linkedProject(startDir string) (int, error) {
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return 0, errors.New("no se pudo determinar el directorio de trabajo")
	}
	for {
		data, err := readLimited(filepath.Join(dir, LinkFile), 4096)
		switch {
		case err == nil:
			var link struct {
				ProyectoID int `json:"proyecto_id"`
			}
			if json.Unmarshal(data, &link) != nil || link.ProyectoID <= 0 || link.ProyectoID > math.MaxInt32 {
				return 0, fmt.Errorf("%s no es válido: se esperaba un proyecto_id entero positivo", filepath.Join(dir, LinkFile))
			}
			return link.ProyectoID, nil
		case !errors.Is(err, os.ErrNotExist):
			return 0, fmt.Errorf("no se pudo leer %s", filepath.Join(dir, LinkFile))
		}
		// La raíz del repositorio es el límite: no heredar el vínculo de un directorio superior.
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return 0, fmt.Errorf("CASSANDRA_API_KEY no está definida y no hay %s en %s ni en su repositorio", LinkFile, startDir)
}

func readKeyFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("no existe %s", path)
		}
		return "", fmt.Errorf("no se pudo abrir %s", path)
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("%s debe ser un archivo regular", path)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return "", fmt.Errorf("%s es accesible por otros usuarios; ejecutar chmod 600", path)
	}
	data, err := io.ReadAll(io.LimitReader(f, 257))
	if err != nil || len(data) > 256 {
		return "", fmt.Errorf("%s no tiene el formato de una key", path)
	}
	return strings.TrimSpace(string(data)), nil
}

func readLimited(path string, max int64) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > max {
		return nil, errors.New("archivo demasiado grande")
	}
	return data, nil
}
