# TickTick: tareas de hoy en Home

Cada usuario conecta su cuenta en **Configuración → Conexiones → TickTick**.
Cassandra solicita únicamente `tasks:read` y muestra pendientes con vencimiento
de hoy, incluidas las de Inbox. Las tareas se administran desde TickTick.
No se importan a los proyectos ni se crean, completan o editan desde Cassandra.

## Habilitar la integración en un servidor

1. Crea una aplicación en el [portal oficial de TickTick](https://developer.ticktick.com/manage).
2. Registra como callback exactamente
   `https://TU-DOMINIO/api/connections/ticktick/callback`.
   Para desarrollo se permite HTTP solo en `localhost`, `127.0.0.1` o `::1`.
3. Genera una clave de cifrado independiente del secreto JWT:

   ```sh
   openssl rand -base64 32
   ```

4. Configura estas cuatro variables en el entorno del backend y reinícialo:

   | Variable | Valor |
   |---|---|
   | `TICKTICK_CLIENT_ID` | ID de la aplicación OAuth. |
   | `TICKTICK_CLIENT_SECRET` | Secreto de esa aplicación. |
   | `TICKTICK_REDIRECT_URI` | Callback exacto registrado en TickTick. |
   | `INTEGRATIONS_ENCRYPTION_KEY` | Clave aleatoria de 32 bytes, codificada en base64. |

Sin configurar ninguna de las variables, la integración queda deshabilitada. Una configuración
parcial o inválida impide el arranque para evitar una activación defectuosa.
No se requiere un token global `TICKTICK_ACCESS_TOKEN` ni se usa el de Aurora.
La migración 32 crea las conexiones por usuario y los estados OAuth temporales.

Conserva la clave de cifrado en los despliegues y en el respaldo seguro del
servidor. Si se cambia o pierde, los usuarios deberán reconectar TickTick.
El token se guarda con AES-256-GCM, ligado al ID del usuario; no se devuelve al
navegador, al almacenamiento local ni al MCP. Usa una aplicación OAuth y un
callback adecuados para cada entorno.

La web y la API deben ser accesibles bajo el origen del callback registrado.
En desarrollo configura el proxy de Angular para `/api` y usa como callback
el origen de la web. En Android, conecta primero desde la web con el mismo
usuario de Cassandra; después la app consume esa conexión del servidor.
El retorno OAuth directo a la APK queda fuera de esta versión.

## Registros del proxy

El backend elimina la query del callback de sus registros de acceso; conserva
los parámetros para validarlos. Configura también el proxy inverso para que
no registre los parámetros `code` y `state`. Por ejemplo, en Nginx añade una
ubicación exacta antes de la ubicación general, adaptando el upstream al existente:

```nginx
location = /api/connections/ticktick/callback {
    access_log off;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

El callback usa estado aleatorio de un solo uso, almacenado como hash y válido
diez minutos. Una desconexión o autorización posterior invalida las anteriores.
El retorno redirige a una ruta fija de Configuración sin exponer código ni token.

## Consulta y errores

- «Hoy» usa la fecha y zona IANA del navegador. Las tareas con hora se convierten
  a esa zona; las de día completo conservan su fecha civil en la zona de la tarea.
- Se selecciona `status: 0` y `dueDate` de hoy. Se excluyen completadas, abandonadas,
  notas, tareas sin vencimiento y otros días. Para rangos se usa su vencimiento
  final; las recurrencias se muestran tal como las devuelve TickTick.
- La caché completa dura cinco minutos por usuario, conexión, fecha y zona.
  Actualizar respeta un mínimo de treinta segundos entre consultas.
- Se consultan hasta cincuenta listas abiertas, con tres lecturas simultáneas;
  se muestran hasta doscientas tareas, por prioridad. Los límites producen
  una advertencia de lectura parcial. Inbox se lee explícitamente incluso si
  no aparece entre las listas.
- Una lectura incompleta nunca afirma que no hay tareas. Ante un fallo temporal
  puede conservar la última consulta del mismo día con advertencia y hora.
- Si TickTick rechaza el token, pide reconectar sin cerrar la sesión Cassandra.
  No se presupone renovación automática porque el flujo documentado no garantiza
  un refresh token.
- Desconectar borra el token local, invalida la caché e intenta revocarlo en
  TickTick. Si la revocación remota falla, la pantalla lo informa; la desconexión
  local se mantiene.
- No hay webhooks ni sincronización en segundo plano. La consulta es al abrir
  Home, cambiar el día o pulsar Actualizar.

Contrato y prueba de Inbox: [alcance y evidencia](TICKTICK_SCOPE.md).
Referencia: [documentación oficial de la Open API](https://developer.ticktick.com/docs/openapi.md).

## Verificación de esta entrega

Se ejecutaron `go test ./...`, `go vet ./...`, pruebas con `-race` del servicio y
la API TickTick, las 930 pruebas del frontend y la compilación de producción.
El flujo OAuth se probó con router real, PostgreSQL desechable y proveedor
simulado, incluyendo estado vencido/reutilizado, separación entre usuarios,
rechazo del proveedor y desconexión concurrente con un callback.

En Chrome se comprobaron Home y Configuración a 1440, 390 y 320 px, estados de
consulta y foco de teclado. Axe no encontró infracciones en los componentes
nuevos. La revisión independiente de interfaz dio `ship` y confirmó el sistema
visual existente. Las capturas locales usan datos de demostración.

El 2026-10-29 el servicio implementado leyó la cuenta real con estado `ready`,
Inbox confirmado y dos pendientes de hoy, sin advertencias. Esa prueba no
conectó la cuenta a Cassandra: la aplicación OAuth y las variables de entorno
deben configurarse en el servidor destino antes de la autorización real.
