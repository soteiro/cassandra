# Autoalojar Cassandra

Cassandra es autoalojado: cada persona corre su propio servidor y la app Android se
conecta a él. No hay un servidor público ni registro abierto: **las cuentas las crea
quien administra el servidor**, desde su terminal.

Una instalación son tres piezas:

| Pieza | Qué es |
|---|---|
| `cassandra-app-linux-amd64` | Un solo binario: API + web (el frontend va embebido). Aplica las migraciones de la base de datos al arrancar. |
| PostgreSQL | La base de datos (probado con PostgreSQL 18). |
| Proxy inverso con HTTPS | nginx, Caddy u otro. La app Android **exige https**. |

## 1. Requisitos

- Servidor Linux **x86_64 (amd64)** con systemd.
- PostgreSQL accesible desde el servidor (puede ser el mismo).
- Un dominio apuntando al servidor y un certificado TLS (p. ej. Let's Encrypt).

## 2. Descargar el binario

Desde la [última release](https://github.com/soteiro/cassandra/releases/latest):

```bash
VERSION=v0.3.0   # la versión que quieras instalar
curl -LO https://github.com/soteiro/cassandra/releases/download/$VERSION/cassandra-app-linux-amd64
curl -LO https://github.com/soteiro/cassandra/releases/download/$VERSION/SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS

sudo useradd --system --home /opt/cassandra --shell /usr/sbin/nologin cassandra
sudo install -d -o cassandra -g cassandra /opt/cassandra
sudo install -m 0755 -o cassandra -g cassandra cassandra-app-linux-amd64 /opt/cassandra/cassandra-app
/opt/cassandra/cassandra-app version
```

## 3. Base de datos

```bash
sudo -u postgres psql -c "CREATE ROLE cassandra LOGIN PASSWORD 'cambia-esta-contraseña';"
sudo -u postgres psql -c "CREATE DATABASE cassandra OWNER cassandra;"
```

Las tablas las crea el propio binario al arrancar (migraciones automáticas).

## 4. Configuración

Crea `/etc/cassandra/cassandra.env`, legible solo por root y el usuario `cassandra`:

```bash
sudo install -d -m 0750 -g cassandra /etc/cassandra
sudo install -m 0640 -g cassandra /dev/null /etc/cassandra/cassandra.env
sudoedit /etc/cassandra/cassandra.env
```

Con este contenido (genera el secreto con `openssl rand -base64 48` y pégalo):

```ini
DATABASE_URL_LOCAL=postgres://cassandra:cambia-esta-contraseña@localhost:5432/cassandra?sslmode=disable
JWT_SECRET=pega-aquí-el-resultado-de-openssl-rand
PORT=8080
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL_LOCAL` | Sí | URL de conexión a PostgreSQL. |
| `JWT_SECRET` | **Sí** | Firma las sesiones. Mínimo 32 caracteres, aleatorio y privado (`openssl rand -base64 48`). Sin él, o si es corto, el servidor no arranca. |
| `PORT` | No (8080) | Puerto HTTP local; el proxy inverso apunta aquí. |
| `RATE_LIMIT_PER_MIN` | No (100) | Peticiones por minuto y por IP. |
| `ALLOWED_ORIGINS` | No | Orígenes CORS extra, separados por comas. La web y la app Android no los necesitan; solo si sirves otro frontend desde otro dominio. |

## 5. Servicio systemd

`/etc/systemd/system/cassandra.service`:

```ini
[Unit]
Description=Cassandra
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=cassandra
Group=cassandra
WorkingDirectory=/opt/cassandra
EnvironmentFile=/etc/cassandra/cassandra.env
ExecStart=/opt/cassandra/cassandra-app
Restart=always
RestartSec=5s
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cassandra
curl -s localhost:8080/api/version   # {"version":"v0.3.0"}
```

## 6. Proxy inverso (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name cassandra.midominio.com;

    ssl_certificate     /etc/letsencrypt/live/cassandra.midominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cassandra.midominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- `X-Forwarded-Proto` hace que las cookies de sesión se marquen `Secure`.
- `X-Real-IP` hace que el límite de peticiones se aplique por IP real y no a todo el tráfico del proxy.

## 7. Crear tu cuenta

La API no permite registrarse. Las cuentas se crean desde el servidor; la contraseña
se pide sin mostrarla:

```bash
sudo -u cassandra bash -c 'set -a; . /etc/cassandra/cassandra.env; set +a;
  /opt/cassandra/cassandra-app create-user --email tu@correo.com --nombre "Tu nombre"'
```

- Contraseña olvidada: mismo comando con `reset-password --email tu@correo.com`.
- En scripts la contraseña puede llegar por stdin: `echo "$PASS" | cassandra-app create-user ...`.

Ya puedes entrar en `https://cassandra.midominio.com`.

## 8. App Android

1. En el teléfono, descarga `cassandra.apk` desde la [última release](https://github.com/soteiro/cassandra/releases/latest) e instálala (Android pedirá permitir instalar apps de esa fuente).
2. Al abrirla, escribe la dirección de tu servidor (`cassandra.midominio.com`) y entra con tu cuenta.
3. Para actualizar: menú → **Buscar actualizaciones**.

La app no trae ningún servidor de fábrica; puedes cambiarlo desde el login o el menú.

## 9. Actualizar el servidor

1. Respaldo antes de migrar: `sudo -u postgres pg_dump cassandra > cassandra-$(date +%F).sql`
2. Descarga y verifica el binario nuevo como en el paso 2.
3. Reemplázalo y reinicia:

```bash
sudo install -m 0755 -o cassandra -g cassandra cassandra-app-linux-amd64 /opt/cassandra/cassandra-app
sudo systemctl restart cassandra
curl -s localhost:8080/api/version
```

Las migraciones se aplican solas al arrancar y **no se revierten** al volver a una versión
anterior; por eso conviene el respaldo. Los cambios de cada versión están en el
[CHANGELOG](../CHANGELOG.md).

## Seguridad, en resumen

- `JWT_SECRET` largo, aleatorio y privado.
- PostgreSQL no expuesto a internet.
- Solo HTTPS hacia afuera; el binario escucha en local detrás del proxy.
- Las cuentas solo se crean desde la terminal del servidor.
