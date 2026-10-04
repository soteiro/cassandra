# Deploy automático (QA y producción)

| Evento | Qué pasa | Entorno |
|---|---|---|
| Merge a `qa` | Tests → binario → deploy. La base `cassandra_qa` se reinicia y se cargan datos demo. | `cassandra@qa` en `:8081` |
| Release publicada (merge del PR de release-please) | Tests → binario + APK en la release → respaldo de la base → deploy. | `cassandra@prod` en `:8080` |
| Actions → Release Please → *Run workflow* con un tag | Recompila y despliega ese tag en producción (sirve para volver a una versión anterior). | `cassandra@prod` |

GitHub se conecta por SSH con una clave que **solo puede ejecutar** `/usr/local/bin/cassandra-deploy`
(comando forzado, sin shell ni túneles). El binario viaja por stdin; el script verifica el
SHA256 y la versión, cambia el symlink `current`, reinicia el servicio y comprueba
`/api/version`. Si la versión nueva no responde, vuelve a la anterior.

```
/opt/cassandra/                     ← instalación antigua (queda como respaldo, ya no se usa)
/opt/cassandra-prod/{current → releases/vX.Y.Z-…, releases/}
/opt/cassandra-qa/{current → releases/…, releases/}
/etc/cassandra/{prod,qa}.env        ← configuración de cada entorno
/var/backups/cassandra/             ← pg_dump antes de cada deploy a producción (últimos 10)
/home/cassandra-deploy/.ssh/        ← solo authorized_keys (contexto SELinux ssh_home_t)
```

## 1. Generar la clave de deploy (en tu máquina)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-cassandra" -f cassandra-deploy
```

`cassandra-deploy.pub` va al servidor; `cassandra-deploy` (privada) va a GitHub.

## 2. Preparar el servidor (una vez)

Copia la carpeta `deploy/` y la clave pública al servidor y ejecuta:

```bash
sudo ./deploy/setup-server.sh cassandra-deploy.pub
```

El script es idempotente y pide confirmación antes de cambiar `cassandra.service` por
`cassandra@prod` (corte de unos segundos; si el nuevo servicio no responde, vuelve al antiguo).
Requisitos: `psql`, `pg_dump`, `curl`, `openssl` y que PostgreSQL acepte contraseña en
`localhost` (la misma configuración que ya usa producción).

Revisa después:

- `/etc/cassandra/prod.env`: copia de `/opt/cassandra/.env` más `PORT=8080`. Su `JWT_SECRET`
  debe tener **32 caracteres o más** (el script avisa si no).
- `/etc/cassandra/qa.env`: generado con secretos aleatorios; el usuario demo es
  `DEMO_EMAIL` / `DEMO_PASSWORD` (cámbialos si quieres).
- Que la clave no da shell: `ssh -i cassandra-deploy cassandra-deploy@servidor` debe
  responder `uso: <qa|prod> <sha256> <versión>` y cerrar.

## 3. nginx

Apunta el dominio de QA a `http://127.0.0.1:8081` con las mismas cabeceras que producción
(`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`; ver `docs/SELF_HOSTING.md`).

## 4. GitHub

*Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | Contenido de `cassandra-deploy` (la clave **privada**). |
| Secret | `DEPLOY_HOST` | Dominio o IP del servidor. |
| Secret | `DEPLOY_KNOWN_HOSTS` | Salida de `ssh-keyscan -p <puerto> <servidor>` (verifica la huella antes). |
| Variable | `DEPLOY_PORT` | Puerto SSH, solo si no es 22. |

Los environments `qa` y `production` se crean solos con el primer deploy; en
*Settings → Environments* puedes limitarlos a las ramas `qa` y `main`.

Después borra la clave privada de tu máquina (o guárdala en tu gestor de contraseñas).

## Operación

- Ver el último deploy: `journalctl -u cassandra@prod -n 50` / `cassandra@qa`.
- Volver a una versión anterior: Actions → Release Please → *Run workflow* → tag `vX.Y.Z`.
  Las migraciones no se revierten: si la versión nueva migró la base, restaura el
  respaldo de `/var/backups/cassandra` antes.
- Revocar el acceso de GitHub: borra la línea de `/home/cassandra-deploy/.ssh/authorized_keys`.
