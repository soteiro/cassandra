#!/usr/bin/env bash
# Preparación única del servidor para el deploy automático desde GitHub Actions.
#
#   sudo ./setup-server.sh /ruta/a/cassandra-deploy.pub
#
# Idempotente: se puede volver a ejecutar sin pisar configuraciones existentes.
# Hace:
#   1. Usuario cassandra-deploy (solo puede ejecutar cassandra-deploy por SSH).
#   2. /opt/cassandra/{prod,qa}/releases, /var/backups/cassandra, script y unit cassandra@.service.
#   3. sudoers mínimo: reiniciar cassandra@prod / cassandra@qa y detener cassandra@qa.
#   4. Producción: pasa del cassandra.service antiguo (/opt/cassandra/cassandra-app + .env)
#      a cassandra@prod con /etc/cassandra/prod.env (pide confirmación; corte de segundos).
#   5. QA: rol y base cassandra_qa, /etc/cassandra/qa.env con secretos aleatorios.
set -euo pipefail

SERVICE_USER=cassandra
DEPLOY_USER=cassandra-deploy
LEGACY_DIR=/opt/cassandra
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

log() { printf '\n==> %s\n' "$*"; }
warn() { printf '    AVISO: %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
random_secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }

[[ $EUID -eq 0 ]] || die "ejecútalo como root (sudo)"
[[ $# -eq 1 && -r $1 ]] || die "uso: sudo $0 /ruta/a/cassandra-deploy.pub"
pubkey=$(head -n1 "$1")
[[ $pubkey == ssh-* ]] || die "$1 no parece una clave pública SSH"
for cmd in openssl psql pg_dump curl flock sha256sum; do
  command -v "$cmd" >/dev/null || die "falta el comando $cmd"
done
id "$SERVICE_USER" >/dev/null 2>&1 || die "no existe el usuario $SERVICE_USER (el de la instalación actual)"

# --- 1. Usuario de deploy ---
log "Usuario $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  # Necesita una shell real para que sshd ejecute el comando forzado; no tiene contraseña.
  useradd --system --create-home --home-dir "/home/$DEPLOY_USER" --shell /bin/bash "$DEPLOY_USER"
  passwd -l "$DEPLOY_USER" >/dev/null
fi
# Leer /etc/cassandra/*.env (grupo cassandra).
usermod -aG "$SERVICE_USER" "$DEPLOY_USER"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
auth="/home/$DEPLOY_USER/.ssh/authorized_keys"
line="command=\"/usr/local/bin/cassandra-deploy\",restrict $pubkey"
touch "$auth"
grep -qxF "$line" "$auth" || echo "$line" >> "$auth"
chown "$DEPLOY_USER:$DEPLOY_USER" "$auth" && chmod 0600 "$auth"
command -v restorecon >/dev/null && restorecon -R "/home/$DEPLOY_USER/.ssh" || true

# --- 2. Directorios, script y unit ---
log "Directorios, script de deploy y unit"
for env in prod qa; do
  install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$LEGACY_DIR/$env" "$LEGACY_DIR/$env/releases"
done
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/backups/cassandra
install -d -m 0750 -o root -g "$SERVICE_USER" /etc/cassandra
install -m 0755 -o root -g root "$SCRIPT_DIR/cassandra-deploy" /usr/local/bin/cassandra-deploy
install -m 0644 -o root -g root "$SCRIPT_DIR/cassandra@.service" /etc/systemd/system/cassandra@.service
systemctl daemon-reload

# --- 3. sudoers ---
log "sudoers"
sudoers=/etc/sudoers.d/cassandra-deploy
tmp=$(mktemp)
cat > "$tmp" <<'SUDOERS_END'
cassandra-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart cassandra@prod.service, /usr/bin/systemctl restart cassandra@qa.service, /usr/bin/systemctl stop cassandra@qa.service
SUDOERS_END
visudo -cf "$tmp" >/dev/null || die "sudoers inválido"
install -m 0440 -o root -g root "$tmp" "$sudoers" && rm -f "$tmp"

# --- 4. Producción: del servicio antiguo a cassandra@prod ---
log "Producción"
prod_env=/etc/cassandra/prod.env
if [[ ! -e $prod_env ]]; then
  [[ -r $LEGACY_DIR/.env ]] || die "no encuentro $LEGACY_DIR/.env para crear $prod_env"
  install -m 0640 -o root -g "$SERVICE_USER" "$LEGACY_DIR/.env" "$prod_env"
  grep -q '^PORT=' "$prod_env" || echo 'PORT=8080' >> "$prod_env"
  echo "    creado $prod_env a partir de $LEGACY_DIR/.env (el original no se toca)"
fi
jwt=$(sed -n 's/^JWT_SECRET=//p' "$prod_env" | tr -d "\"'" | head -n1)
if (( ${#jwt} < 32 )); then
  warn "JWT_SECRET de producción tiene ${#jwt} caracteres; las versiones nuevas exigen 32 o más."
  warn "Reemplázalo en $prod_env (se cierran las sesiones abiertas) antes del próximo deploy."
fi

if [[ ! -e $LEGACY_DIR/prod/current ]]; then
  [[ -x $LEGACY_DIR/cassandra-app ]] || die "no encuentro el binario actual $LEGACY_DIR/cassandra-app"
  legacy_version=$("$LEGACY_DIR/cassandra-app" version 2>/dev/null || echo legacy)
  [[ $legacy_version == v* ]] || legacy_version=legacy
  legacy_release="$LEGACY_DIR/prod/releases/$legacy_version-migrado"
  install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$legacy_release"
  install -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$LEGACY_DIR/cassandra-app" "$legacy_release/cassandra-app"
  ln -sfn "$legacy_release" "$LEGACY_DIR/prod/current"
  chown -h "$DEPLOY_USER:$DEPLOY_USER" "$LEGACY_DIR/prod/current"
fi

if systemctl is-active --quiet cassandra@prod.service; then
  echo "    cassandra@prod ya está activo"
else
  read -r -p "    Cambiar cassandra.service por cassandra@prod ahora (corte de unos segundos)? [s/N] " ok
  if [[ $ok =~ ^[sS]$ ]]; then
    systemctl disable --now cassandra.service 2>/dev/null || true
    systemctl enable --now cassandra@prod.service
    port=$(sed -n 's/^PORT=//p' "$prod_env" | head -n1); port=${port:-8080}
    for _ in $(seq 1 20); do curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && break; sleep 1; done
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
      echo "    cassandra@prod responde en :$port"
    else
      warn "cassandra@prod no responde; volviendo al servicio antiguo"
      systemctl disable --now cassandra@prod.service || true
      systemctl enable --now cassandra.service
      die "revisa: journalctl -u cassandra@prod"
    fi
  else
    warn "producción sigue con cassandra.service; vuelve a ejecutar el script para cambiarla"
  fi
fi

# --- 5. QA ---
log "QA"
qa_env=/etc/cassandra/qa.env
if [[ ! -e $qa_env ]]; then
  qa_db_password=$(random_secret)
  role_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'cassandra_qa'")
  if [[ $role_exists == 1 ]]; then
    sudo -u postgres psql -q -c "ALTER ROLE cassandra_qa PASSWORD '$qa_db_password'"
  else
    sudo -u postgres psql -q -c "CREATE ROLE cassandra_qa LOGIN PASSWORD '$qa_db_password'"
  fi
  db_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'cassandra_qa'")
  [[ $db_exists == 1 ]] || sudo -u postgres psql -q -c "CREATE DATABASE cassandra_qa OWNER cassandra_qa"

  tmp=$(mktemp)
  {
    echo "DATABASE_URL_LOCAL=postgres://cassandra_qa:$qa_db_password@localhost:5432/cassandra_qa?sslmode=disable"
    echo "JWT_SECRET=$(random_secret)"
    echo "PORT=8081"
    echo "DEMO_EMAIL=qa@cassandra.local"
    echo "DEMO_PASSWORD=$(random_secret | cut -c1-20)"
  } > "$tmp"
  install -m 0640 -o root -g "$SERVICE_USER" "$tmp" "$qa_env" && rm -f "$tmp"
  echo "    creado $qa_env (usuario demo: qa@cassandra.local; contraseña en DEMO_PASSWORD)"
fi
systemctl enable cassandra@qa.service >/dev/null 2>&1
echo "    cassandra@qa habilitado; arrancará con el primer deploy a qa"

log "Listo"
cat <<'NEXT_STEPS'
Siguientes pasos:
  - nginx: el dominio de QA → http://127.0.0.1:8081 (producción sigue en :8080).
  - GitHub: configura los secrets indicados en deploy/README.md.
  - Prueba la clave (debe responder con el uso del script, no con una shell):
      ssh -i cassandra-deploy cassandra-deploy@<servidor>
NEXT_STEPS
