/**
 * Datos ficticios de la demo. Todas las fechas son relativas a hoy, así la demo siempre se ve
 * viva: tareas atrasadas, deadlines de la semana, bloques planificados y revisiones recientes.
 */
import type { DocumentoTipo } from '../../app/features/proyectos/data/documento.model';
import type { DemoDB, EventoRow, ProyectoRow, TareaRow } from './db';
import { DB_VERSION } from './db';
import { diaRelativo, haceDias, medianocheUTC } from './fechas';

const USER = 1;

interface ProyectoSeed {
  nombre: string;
  descripcion: string;
  estado: string;
  prioridad: string;
  por_que?: string;
  para_que?: string;
  criterio?: string;
  premortem?: string;
  comentario?: string;
  creado: number;
  inicio?: number;
  limite?: number;
  terminado?: number;
  padre?: number;
}

interface TareaSeed {
  nombre: string;
  estado?: string;
  prioridad?: string;
  descripcion?: string;
  creado?: number;
  /** Días desde la última modificación (para la revisión de estancadas). */
  tocado?: number;
  terminado?: number;
  inicio?: number;
  limite?: number;
  estimacion?: number;
  sub?: TareaSeed[];
  /** La creó el asistente por MCP. */
  mcp?: boolean;
}

/** 0–20 días, estable para cada nombre. */
function dispersion(nombre: string): number {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 21;
}

export function crearSeed(): DemoDB {
  let seq = 0;
  const id = () => ++seq;

  const db: DemoDB = {
    version: DB_VERSION,
    seq: 0,
    proyectos: [],
    tareas: [],
    notas: [],
    documentos: [],
    logs: [],
    eventos: [],
    revisiones: [],
    preferencias: { dia_revision: 0, limite_en_curso: 3, ocultar_deadlines: false },
    calendarios: [],
    actividades: [],
    bloques: [],
    operaciones: {},
    horarioBase: [],
    apiKeys: [],
    ticktick: { connected: true, tasks: [] },
  };

  const evento = (e: Omit<EventoRow, 'id'>) => db.eventos.push({ id: id(), ...e });

  // ---------------------------------------------------------------- proyectos y tareas

  const proyecto = (s: ProyectoSeed): number => {
    const pid = id();
    const row: ProyectoRow = {
      id: pid,
      nombre: s.nombre,
      descripcion: s.descripcion,
      comentario: s.comentario ?? '',
      estado: s.estado,
      prioridad: s.prioridad,
      por_que: s.por_que ?? '',
      para_que: s.para_que ?? '',
      criterio_finalizacion: s.criterio ?? '',
      premortem: s.premortem ?? '',
      fecha_creacion: haceDias(s.creado, 9),
      fecha_actualizacion: haceDias(Math.max(0, (s.terminado ?? Math.min(s.creado, 3)) - 0), 18),
      fecha_inicio: s.inicio !== undefined ? medianocheUTC(diaRelativo(s.inicio)) : undefined,
      fecha_limite: s.limite !== undefined ? medianocheUTC(diaRelativo(s.limite)) : undefined,
      fecha_terminado: s.terminado !== undefined ? haceDias(s.terminado, 19) : null,
      proyecto_padre_id: s.padre ?? null,
      eliminado: false,
    };
    db.proyectos.push(row);
    evento({
      entidad: 'proyecto',
      entidad_id: pid,
      proyecto_id: pid,
      accion: 'creado',
      cambios: {},
      origen: 'app',
      ocurrido_en: row.fecha_creacion,
    });
    if (s.estado !== 'No Listado' && s.estado !== 'Idea') {
      evento({
        entidad: 'proyecto',
        entidad_id: pid,
        proyecto_id: pid,
        accion: 'modificado',
        cambios: {
          estado: {
            antes: 'No Listado',
            despues: s.terminado !== undefined ? 'Completado' : s.estado,
          },
        },
        origen: 'app',
        ocurrido_en:
          s.terminado !== undefined
            ? haceDias(s.terminado, 19)
            : haceDias(Math.max(0, s.creado - 1), 11),
      });
    }
    return pid;
  };

  const tarea = (pid: number, s: TareaSeed, padre: number | null = null): number => {
    const tid = id();
    const estado = s.estado ?? (s.terminado !== undefined ? 'Terminado' : 'Abierto');
    // Sin fecha explícita: unos días antes de su último cambio, repartidos por el nombre.
    const creado =
      s.creado ?? Math.max((s.terminado ?? 0) + 4, (s.tocado ?? 0) + 1, 6) + dispersion(s.nombre);
    const tocado = s.terminado ?? s.tocado ?? Math.min(creado, 2);
    const row: TareaRow = {
      id: tid,
      nombre: s.nombre,
      descripcion: s.descripcion ?? '',
      comentario: '',
      estado,
      prioridad: s.prioridad ?? 'normal',
      eliminado: false,
      user_id: USER,
      proyect_id: pid,
      fecha_creacion: haceDias(creado, 10, 15),
      fecha_actualizacion: haceDias(tocado, 17, 40),
      fecha_terminado: estado === 'Terminado' ? haceDias(s.terminado ?? tocado, 17, 40) : null,
      tarea_padre_id: padre,
      fecha_inicio: s.inicio !== undefined ? medianocheUTC(diaRelativo(s.inicio)) : null,
      fecha_limite: s.limite !== undefined ? medianocheUTC(diaRelativo(s.limite)) : null,
      estimacion_min: s.estimacion ?? null,
    };
    db.tareas.push(row);
    evento({
      entidad: 'tarea',
      entidad_id: tid,
      proyecto_id: pid,
      accion: 'creado',
      cambios: {},
      origen: s.mcp ? 'mcp' : 'app',
      ocurrido_en: row.fecha_creacion,
    });
    if (estado !== 'Abierto') {
      evento({
        entidad: 'tarea',
        entidad_id: tid,
        proyecto_id: pid,
        accion: 'modificado',
        cambios: {
          estado: { antes: estado === 'Terminado' ? 'En Curso' : 'Abierto', despues: estado },
        },
        origen: 'app',
        ocurrido_en: row.fecha_actualizacion ?? row.fecha_creacion,
      });
    }
    for (const sub of s.sub ?? []) tarea(pid, { creado, ...sub }, tid);
    return tid;
  };

  const tareas = (pid: number, ts: TareaSeed[]) => ts.map((t) => tarea(pid, t));

  // --- Asistente PM con MCP
  const pMcp = proyecto({
    nombre: 'Asistente PM con MCP',
    descripcion:
      'Exponer proyectos, tareas, memoria y calendario a asistentes (Claude Code, Codex, OpenCode) mediante un servidor MCP.',
    estado: 'En Proceso',
    prioridad: 'Critica',
    por_que:
      'Casi no uso las pantallas: trabajo desde la terminal con un LLM y quiero que lea y escriba mi contexto.',
    para_que:
      'Que el asistente sepa en qué quedé, planifique mis tareas en los huecos libres y avise si no alcanzo.',
    criterio:
      'El asistente crea, planifica y cierra tareas reales durante dos semanas sin que abra la web.',
    premortem:
      'Falló porque el asistente escribía memoria sin control y se llenó de ruido. Mitigación: límite de 400 palabras y fichas de 150.',
    creado: 45,
    inicio: -40,
    limite: 20,
  });
  const [, , , tChoques, tDocSetup, tE2e] = tareas(pMcp, [
    { nombre: 'Definir scopes de las API keys', terminado: 30, prioridad: 'alta', creado: 42 },
    {
      nombre: 'Tool planificar_tarea con bloques idempotentes',
      terminado: 12,
      prioridad: 'alta',
      estimacion: 240,
    },
    { nombre: 'Tool ver_disponibilidad por calendario', terminado: 8, estimacion: 180 },
    {
      nombre: 'Detectar choques de calendario por dueño',
      estado: 'En Curso',
      prioridad: 'alta',
      estimacion: 180,
      limite: 3,
      tocado: 1,
      descripcion:
        'Si un bloque cae sobre un turno o una terapia, el asistente debe avisar quién está ocupado.',
      sub: [
        { nombre: 'Detectar solapes con turnos de noche', terminado: 2 },
        { nombre: 'Mensaje de aviso al asistente', estado: 'Abierto' },
        { nombre: 'Tests de borde: medianoche', estado: 'Abierto', creado: 1, mcp: true },
      ],
    },
    { nombre: 'Documentar setup en Claude Code y Codex', estimacion: 90, limite: 6, mcp: true },
    { nombre: 'Pruebas e2e del servidor MCP', prioridad: 'alta', estimacion: 240, limite: 10 },
    { nombre: 'Límite de 400 palabras en la memoria', terminado: 20 },
    {
      nombre: 'Búsqueda full-text en notas',
      estado: 'Bloqueado',
      tocado: 18,
      descripcion: 'Esperando decidir entre tsvector y trigramas.',
    },
    { nombre: 'Registrar decisiones como fichas', terminado: 5, mcp: true },
  ]);

  // --- Portafolio
  const pPortafolio = proyecto({
    nombre: 'Portafolio web personal',
    descripcion: 'Sitio con casos de estudio de mis proyectos, empezando por Cassandra.',
    estado: 'En Proceso',
    prioridad: 'Alta',
    por_que: 'Mis proyectos viven en repos privados y nadie los ve.',
    para_que: 'Postular a roles de backend/plataforma con evidencia concreta.',
    criterio: 'Publicado con dominio propio y 3 casos de estudio.',
    creado: 28,
    inicio: -25,
    limite: 12,
  });
  const [, tAstro, tCaso, tDeploy] = tareas(pPortafolio, [
    { nombre: 'Diseño de la home en Figma', terminado: 15, estimacion: 180 },
    {
      nombre: 'Maquetar con Astro',
      estado: 'En Curso',
      prioridad: 'alta',
      estimacion: 240,
      limite: 2,
      tocado: 0,
    },
    {
      nombre: 'Escribir caso de estudio: Cassandra',
      prioridad: 'alta',
      estimacion: 120,
      limite: 5,
      mcp: true,
      sub: [
        { nombre: 'Diagrama de arquitectura', terminado: 3 },
        { nombre: 'Capturas de la demo', estado: 'Abierto' },
        { nombre: 'Texto final y revisión', estado: 'Abierto' },
      ],
    },
    { nombre: 'Demo pública en Cloudflare Pages', estimacion: 60, limite: 8, creado: 1 },
    { nombre: 'Optimizar imágenes (AVIF)', prioridad: 'baja' },
    { nombre: 'Configurar dominio y DNS', terminado: 5 },
    { nombre: 'Elegir tipografías', terminado: 18 },
  ]);
  const pBlog = proyecto({
    nombre: 'Blog técnico',
    descripcion: 'Sección de posts dentro del portafolio.',
    estado: 'Pendiente',
    prioridad: 'Media',
    creado: 20,
    limite: 40,
    padre: pPortafolio,
  });
  tareas(pBlog, [
    { nombre: 'Post: por qué un ERP personal', estimacion: 180, limite: 18 },
    { nombre: 'Post: MCP en la práctica', estimacion: 180 },
    { nombre: 'Configurar RSS', prioridad: 'baja', estimacion: 30 },
  ]);

  // --- Homelab
  const pHomelab = proyecto({
    nombre: 'Homelab con Podman',
    descripcion: 'Todos los servicios de la casa en contenedores rootless con quadlets y systemd.',
    estado: 'En Proceso',
    prioridad: 'Media',
    por_que: 'Docker Compose a mano se volvió frágil y cada reinicio era una sorpresa.',
    para_que: 'Servicios que arrancan solos, con logs en journald y actualizaciones automáticas.',
    criterio: 'Todos los servicios como quadlets, con monitoreo y backups probados.',
    creado: 65,
    inicio: -60,
    limite: -3,
  });
  const [, , tGrafana, tCerts] = tareas(pHomelab, [
    { nombre: 'Migrar servicios a quadlets', terminado: 35, estimacion: 300 },
    { nombre: 'Reverse proxy con Caddy', terminado: 28 },
    {
      nombre: 'Monitoreo con Grafana y Prometheus',
      estado: 'En Curso',
      estimacion: 180,
      tocado: 16,
    },
    {
      nombre: 'Renovar certificados automáticamente',
      prioridad: 'alta',
      limite: -2,
      estimacion: 60,
    },
    { nombre: 'Alertas por Telegram', tocado: 22 },
    { nombre: 'Auto-update de imágenes', terminado: 40 },
  ]);
  const pBackups = proyecto({
    nombre: 'Backups automáticos',
    descripcion: 'Respaldo diario cifrado de Postgres y volúmenes, con copia fuera de casa.',
    estado: 'En Proceso',
    prioridad: 'Alta',
    creado: 14,
    inicio: -10,
    limite: 7,
    padre: pHomelab,
  });
  const [, tRestore] = tareas(pBackups, [
    { nombre: 'Script diario con restic', terminado: 6, estimacion: 90 },
    {
      nombre: 'Probar restauración completa',
      prioridad: 'urgente',
      estimacion: 120,
      limite: 1,
      mcp: true,
    },
    { nombre: 'Copia offsite en Backblaze B2', estimacion: 60 },
    { nombre: 'pg_dump antes de cada backup', terminado: 4 },
  ]);

  // --- App Android
  const pKotlin = proyecto({
    nombre: 'App de hábitos en Kotlin',
    descripcion: 'Proyecto para aprender desarrollo Android nativo con Jetpack Compose.',
    estado: 'En Proceso',
    prioridad: 'Media',
    por_que: 'Quiero entender móvil desde lo básico, no solo envolver una web.',
    para_que: 'Tener una app propia en el teléfono y base para la app de notificaciones del banco.',
    criterio: 'APK instalada que uso a diario durante un mes.',
    creado: 22,
    inicio: -20,
    limite: 45,
  });
  const [, tHabitosUi] = tareas(pKotlin, [
    { nombre: 'Curso Jetpack Compose (módulos 1–4)', terminado: 10, estimacion: 600 },
    { nombre: 'Pantalla de lista de hábitos', estado: 'En Curso', estimacion: 150, tocado: 2 },
    { nombre: 'Persistencia con Room', estimacion: 120, limite: 14 },
    { nombre: 'Notificaciones diarias', prioridad: 'baja', estimacion: 90 },
    { nombre: 'Icono y splash screen', prioridad: 'baja', estimacion: 45 },
    { nombre: 'Configurar Android Studio y emulador', terminado: 19 },
  ]);

  // --- CKA
  const pCka = proyecto({
    nombre: 'Certificación Kubernetes (CKA)',
    descripcion: 'Preparar y rendir el examen CKA.',
    estado: 'Pendiente',
    prioridad: 'Alta',
    por_que: 'Uso Kubernetes en el trabajo, pero de oído.',
    para_que: 'Operar clusters con criterio y sumar una certificación al CV.',
    criterio: 'Examen aprobado.',
    creado: 9,
    inicio: 5,
    limite: 60,
  });
  tareas(pCka, [
    { nombre: 'Comprar voucher', terminado: 3 },
    { nombre: 'Plan de estudio semanal', estimacion: 45, limite: 4, creado: 2 },
    { nombre: 'Laboratorio: cluster con kubeadm', prioridad: 'alta', estimacion: 300 },
    { nombre: 'Simulacros en killer.sh', estimacion: 240 },
  ]);

  // --- Viaje
  const pViaje = proyecto({
    nombre: 'Viaje a la Patagonia',
    descripcion: 'Circuito W en Torres del Paine en familia.',
    estado: 'Pendiente',
    prioridad: 'Media',
    creado: 12,
    inicio: 60,
    limite: 75,
  });
  tareas(pViaje, [
    { nombre: 'Reservar vuelos a Punta Arenas', prioridad: 'alta', limite: 9, estimacion: 45 },
    {
      nombre: 'Ruta W en Torres del Paine',
      sub: [
        { nombre: 'Reservar refugios' },
        { nombre: 'Revisar equipo y carpas' },
        { nombre: 'Seguro de viaje', terminado: 1 },
      ],
    },
    { nombre: 'Presupuesto del viaje', terminado: 4 },
  ]);

  // --- Pausados, ideas y otros estados
  const pEscritorio = proyecto({
    nombre: 'Remodelar escritorio',
    descripcion: 'Escritorio elevable y orden de cables.',
    estado: 'Pausado',
    prioridad: 'Baja',
    comentario: 'Pausado hasta después del viaje.',
    creado: 50,
  });
  tareas(pEscritorio, [
    { nombre: 'Elegir escritorio elevable', tocado: 40 },
    { nombre: 'Organizar cables', tocado: 40 },
  ]);
  const pNewsletter = proyecto({
    nombre: 'Newsletter semanal',
    descripcion: 'Resumen semanal de lo que aprendo en plataforma y DevOps.',
    estado: 'Idea',
    prioridad: 'Media',
    creado: 6,
  });
  tareas(pNewsletter, [
    { nombre: 'Definir formato', creado: 3 },
    { nombre: 'Elegir plataforma', creado: 3 },
  ]);
  proyecto({
    nombre: 'Taller de fotografía',
    descripcion: 'Curso presencial de fotografía nocturna.',
    estado: 'No Listado',
    prioridad: 'Baja',
    creado: 3,
  });

  // --- Completados (alimentan el pronóstico de planificación) y cancelado
  const pAws = proyecto({
    nombre: 'Certificación AWS SAA',
    descripcion: 'Solutions Architect Associate.',
    estado: 'Completado',
    prioridad: 'Alta',
    creado: 155,
    inicio: -150,
    limite: -95,
    terminado: 100,
  });
  tareas(pAws, [
    { nombre: 'Curso completo', terminado: 120 },
    { nombre: 'Simulacros', terminado: 105 },
    { nombre: 'Rendir examen', terminado: 100 },
  ]);
  const pMudanza = proyecto({
    nombre: 'Mudanza',
    descripcion: 'Cambio de departamento.',
    estado: 'Completado',
    prioridad: 'Critica',
    creado: 135,
    inicio: -130,
    limite: -110,
    terminado: 104,
  });
  tareas(pMudanza, [
    { nombre: 'Cotizar camión', terminado: 125 },
    { nombre: 'Embalar', terminado: 112 },
    { nombre: 'Cambiar dirección en bancos', terminado: 104 },
  ]);
  const pRefactor = proyecto({
    nombre: 'Refactor del frontend por features',
    descripcion: 'Reorganizar Angular por features con reglas de dependencia.',
    estado: 'Completado',
    prioridad: 'Media',
    creado: 72,
    inicio: -70,
    limite: -50,
    terminado: 48,
  });
  tareas(pRefactor, [
    { nombre: 'Mover servicios a data/', terminado: 60 },
    { nombre: 'Reglas en AGENTS.md', terminado: 52 },
    { nombre: 'Eliminar carpetas por tipo', terminado: 48 },
  ]);
  const pCli = proyecto({
    nombre: 'CLI de administración',
    descripcion: 'Comandos para crear usuarios, migrar y sembrar datos.',
    estado: 'Completado',
    prioridad: 'Media',
    creado: 48,
    inicio: -45,
    limite: -30,
    terminado: 32,
  });
  tareas(pCli, [
    { nombre: 'Comando create-user', terminado: 40 },
    { nombre: 'Comando seed-demo', terminado: 33 },
  ]);
  const pHuerto = proyecto({
    nombre: 'Huerto en el balcón',
    descripcion: 'Tomates y hierbas en maceteros.',
    estado: 'Cancelado',
    prioridad: 'Baja',
    comentario: 'El balcón no recibe sol suficiente.',
    creado: 90,
  });
  tareas(pHuerto, [{ nombre: 'Comprar maceteros', terminado: 85 }]);

  // Una fecha límite que se movió dos veces (el pronóstico lo cuenta).
  for (const [dias, antes, despues] of [
    [30, -10, -5],
    [9, -5, -3],
  ] as const) {
    evento({
      entidad: 'proyecto',
      entidad_id: pHomelab,
      proyecto_id: pHomelab,
      accion: 'modificado',
      cambios: {
        fecha_limite: {
          antes: medianocheUTC(diaRelativo(antes)),
          despues: medianocheUTC(diaRelativo(despues)),
        },
      },
      origen: 'app',
      ocurrido_en: haceDias(dias, 21),
    });
  }

  // ---------------------------------------------------------------- notas

  const nota = (pid: number, texto: string, dias: number, tareaId: number | null = null) => {
    const nid = id();
    db.notas.push({
      id: nid,
      proyecto_id: pid,
      user_id: USER,
      tarea_id: tareaId,
      nota: texto,
      fecha_creacion: haceDias(dias, 20, 10),
      eliminado: false,
    });
    evento({
      entidad: 'nota',
      entidad_id: nid,
      proyecto_id: pid,
      accion: 'creado',
      cambios: {},
      origen: 'app',
      ocurrido_en: haceDias(dias, 20, 10),
    });
  };

  nota(
    pMcp,
    'Las API keys deben limitarse por proyecto **y** por calendario: el asistente del trabajo no tiene por qué ver las terapias.',
    31,
  );
  nota(
    pMcp,
    'Reintentar `planificar_tarea` con el mismo `operacion_id` no debe duplicar bloques. Probado con 3 reintentos seguidos.',
    11,
    tChoques,
  );
  nota(
    pMcp,
    'Un turno de **Noche** termina a las 08:00 del día siguiente: los choques hay que calcularlos en minutos absolutos, no por día.',
    2,
    tChoques,
  );
  nota(
    pMcp,
    'Codex ignora el campo `description` largo de las tools; conviene ponerlo al principio.',
    6,
    tDocSetup,
  );
  nota(pMcp, 'Idea: que la revisión semanal la pueda preparar el asistente y yo solo confirme.', 4);
  nota(
    pPortafolio,
    'Referencias de diseño: sitios sobrios, mucha tipografía, poco color. Nada de carruseles.',
    20,
  );
  nota(pPortafolio, 'Astro con islas solo donde haga falta; el resto HTML estático.', 9, tAstro);
  nota(
    pPortafolio,
    'El caso de estudio debe contar el **problema** antes que la tecnología.',
    3,
    tCaso,
  );
  nota(
    pPortafolio,
    'La demo no puede tocar el servidor real: backend simulado en el navegador.',
    1,
    tDeploy,
  );
  nota(
    pHomelab,
    'Quadlets: `podman generate systemd` está deprecado; usar archivos `.container` en `~/.config/containers/systemd/`.',
    36,
  );
  nota(
    pHomelab,
    'Caddy renueva solo, pero el wildcard necesita el plugin DNS de Cloudflare.',
    25,
    tCerts,
  );
  nota(
    pHomelab,
    'node_exporter rootless no ve los discos; montar `/proc` y `/sys` en solo lectura.',
    16,
    tGrafana,
  );
  nota(pBackups, 'restic: `forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`.', 6);
  nota(
    pBackups,
    'Nunca he probado restaurar. Un backup sin restauración probada no es un backup.',
    2,
    tRestore,
  );
  nota(pKotlin, 'Compose: el estado se eleva al ViewModel; la UI solo emite eventos.', 9);
  nota(pKotlin, 'LazyColumn necesita `key` estable o se pierden las animaciones.', 2, tHabitosUi);
  nota(
    pCka,
    'El examen es 2 h, 15–20 tareas prácticas. Practicar `kubectl` con alias y autocompletado.',
    3,
  );
  nota(pViaje, 'Refugios se agotan en enero: reservar apenas abran.', 5);
  nota(pEscritorio, 'Medidas máximas: 140 × 70 cm.', 41);
  nota(pNewsletter, 'Formato posible: 3 links + 1 cosa que aprendí + 1 herramienta.', 6);
  nota(pAws, 'Lo que más costó: networking (VPC, subnets, NAT).', 101);

  // ---------------------------------------------------------------- documentos

  const documento = (
    pid: number,
    titulo: string,
    tipo: DocumentoTipo,
    contenido: string,
    dias: number,
    tags = '',
    gestionado = false,
  ) => {
    const did = id();
    db.documentos.push({
      id: did,
      proyecto_id: pid,
      user_id: USER,
      titulo,
      contenido,
      tipo,
      tags,
      fecha_creacion: haceDias(dias + 3, 11),
      fecha_actualizacion: haceDias(dias, 16),
      eliminado: false,
      gestionado,
    });
    evento({
      entidad: 'documento',
      entidad_id: did,
      proyecto_id: pid,
      accion: 'creado',
      cambios: {},
      origen: gestionado ? 'mcp' : 'app',
      ocurrido_en: haceDias(dias + 3, 11),
    });
  };

  documento(
    pMcp,
    'Arquitectura del servidor MCP',
    'arquitectura',
    `# Arquitectura del servidor MCP

El asistente nunca habla directo con la base: pasa por la API con una **clave con alcance**.

\`\`\`mermaid
flowchart LR
  A[Claude Code / Codex] -->|stdio| M[cassandra-memory-mcp]
  M -->|HTTPS + API key| API[API Go]
  API --> DB[(PostgreSQL)]
  API --> CAL[Calendario y huecos libres]
\`\`\`

## Herramientas

| Tool | Scope | Qué hace |
|---|---|---|
| \`obtener_contexto\` | memory:read | Memoria del proyecto al retomar |
| \`guardar_avance\` | memory:write | Log de sesión del agente |
| \`crear_tarea\` | tasks:create | Crea tareas con \`operacion_id\` |
| \`ver_disponibilidad\` | calendar:read | Huecos libres por día |
| \`planificar_tarea\` | tasks:manage | Reserva bloques en el calendario |

## Decisiones

- Cada escritura lleva un \`operacion_id\` estable: reintentar no duplica.
- La memoria tiene un máximo de 400 palabras; las fichas, 150.
- Las notas son del usuario: el asistente las **lee**, nunca las escribe.
`,
    6,
    'mcp,arquitectura',
  );
  documento(
    pMcp,
    'Decisión: notas vs logs',
    'decision',
    `# Notas vs logs

**Contexto:** el asistente y yo escribíamos en el mismo lugar y se mezclaba todo.

**Decisión:**
- **Logs** = memoria automática del agente (lo que hizo en cada sesión).
- **Notas** = mías. Cómo resolví algo, notas de negocio.

**Consecuencia:** el MCP tiene \`buscar_notas\` pero no tiene herramienta para escribir notas.
`,
    15,
    'decision',
  );
  documento(
    pMcp,
    'Planificación en huecos libres',
    'guia',
    `# Cómo planifica el asistente

1. Lee la disponibilidad con \`ver_disponibilidad\` (horario base + lo que libera − lo que ocupa).
2. Estima cada tarea (\`estimacion_min\`).
3. Reparte la tarea en bloques antes de su deadline.
4. Si no alcanza el tiempo, **avisa** en vez de sobre-reservar.

\`\`\`mermaid
sequenceDiagram
  participant U as Usuario
  participant A as Asistente
  participant C as Cassandra
  U->>A: "Planifica mi semana"
  A->>C: ver_disponibilidad(lunes..domingo)
  C-->>A: huecos libres
  A->>C: planificar_tarea(tarea, bloques)
  C-->>A: bloques + avisos
  A-->>U: plan propuesto
\`\`\`
`,
    3,
    'mcp,calendario',
    true,
  );
  documento(
    pPortafolio,
    'Estructura del caso de estudio',
    'idea',
    `# Caso de estudio: Cassandra

1. **El problema**: demasiados proyectos personales y ninguna herramienta que entienda mi calendario real (turnos, colegio, terapias).
2. **La idea**: un ERP personal mínimo, con mini-apps a demanda.
3. **Lo interesante**: el uso principal es vía LLM (MCP), no la UI.
4. **Stack**: Go + PostgreSQL, Angular, Capacitor para Android, systemd + Podman.
5. **Resultados**: qué cambió en cómo trabajo.
`,
    4,
    'portafolio',
  );
  documento(
    pHomelab,
    'Inventario de servicios',
    'general',
    `# Servicios del homelab

| Servicio | Quadlet | Puerto | Backup |
|---|---|---|---|
| Cassandra | cassandra.container | 8080 | ✅ |
| PostgreSQL | postgres.container | 5432 | ✅ |
| Caddy | caddy.container | 443 | — |
| Grafana | grafana.container | 3000 | ⏳ |
| Prometheus | prometheus.container | 9090 | — |
`,
    10,
    'homelab',
  );
  documento(
    pHomelab,
    'Investigación: Prometheus rootless',
    'investigacion',
    `# Prometheus en Podman rootless

- **node_exporter** necesita \`--path.rootfs=/host\` y montar \`/\` en solo lectura.
- **cAdvisor** no funciona bien sin root; alternativa: \`podman-exporter\`.
- Retención: 15 días alcanzan para un homelab.
`,
    17,
    'monitoreo',
  );
  documento(
    pBackups,
    'Runbook: restaurar desde restic',
    'guia',
    `# Restaurar desde restic

\`\`\`bash
restic -r b2:homelab-backups snapshots
restic -r b2:homelab-backups restore latest --target /tmp/restore
pg_restore -d cassandra /tmp/restore/dumps/cassandra.dump
\`\`\`

> Pendiente: cronometrar una restauración completa.
`,
    5,
    'backups,runbook',
  );
  documento(
    pKotlin,
    'Pajas mentales: sincronizar con Cassandra',
    'pajas mentales',
    `¿Y si los hábitos fueran tareas recurrentes de Cassandra? Probablemente no: mezcla dos cosas. Dejarlo para después de terminar la app.`,
    8,
  );
  documento(
    pRefactor,
    'Retrospectiva del refactor',
    'retrospectiva',
    `# Retrospectiva

**Bien:** reglas de dependencia escritas en AGENTS.md; los PR fueron chicos (#103–#112).

**Mal:** subestimé los specs que importaban rutas relativas.

**Próxima vez:** mover primero los tests, después el código.
`,
    47,
    'retro',
  );
  documento(
    pMudanza,
    'Retrospectiva de la mudanza',
    'retrospectiva',
    `# Retrospectiva

Terminamos 6 días tarde. El cuello de botella fue el embalaje: lo empezamos una semana antes y necesitaba tres.
`,
    103,
    'retro',
  );

  // ---------------------------------------------------------------- logs del agente

  const log = (pid: number, titulo: string, contenido: string, dias: number, gestionado = true) => {
    const lid = id();
    db.logs.push({
      id: lid,
      proyecto_id: pid,
      user_id: USER,
      titulo,
      contenido_raw: contenido,
      fecha_creacion: haceDias(dias, 22, 5),
      fecha_actualizacion: haceDias(dias, 22, 5),
      eliminado: false,
      gestionado,
    });
    evento({
      entidad: 'log',
      entidad_id: lid,
      proyecto_id: pid,
      accion: 'creado',
      cambios: {},
      origen: gestionado ? 'mcp' : 'app',
      ocurrido_en: haceDias(dias, 22, 5),
    });
  };

  log(
    pMcp,
    'Sesión: choques por dueño',
    'Implementé la detección de solapes con turnos de noche. Falta el mensaje para el asistente y tests de medianoche. Decisión: calcular en minutos absolutos desde el inicio del rango.',
    1,
  );
  log(
    pMcp,
    'Sesión: registrar_decision',
    'Nueva tool para guardar decisiones como fichas separadas de las ideas. Probada desde Claude Code con operacion_id repetido: no duplica.',
    5,
  );
  log(
    pMcp,
    'Sesión: ver_disponibilidad',
    'La disponibilidad ahora respeta el alcance de la clave: calendarios fuera del alcance aparecen como "Ocupado" sin título.',
    8,
  );
  log(
    pMcp,
    'Sesión: planificar_tarea',
    'Bloques idempotentes por operacion_id. Los bloques que no caen enteros en un hueco se guardan igual, con aviso.',
    12,
  );
  log(
    pPortafolio,
    'Sesión: maquetación',
    'Hero y grilla de proyectos listos en Astro. Pendiente: modo oscuro y página de caso de estudio.',
    0,
  );
  log(
    pPortafolio,
    'Sesión: dominio',
    'DNS en Cloudflare, HTTPS activo. Redirección www → raíz configurada.',
    5,
  );
  log(
    pHomelab,
    'Sesión: Grafana',
    'Grafana levantado como quadlet. Prometheus scrapea node_exporter; falta el dashboard de contenedores.',
    16,
  );
  log(
    pBackups,
    'Sesión: restic',
    'Timer de systemd a las 03:00. Primer snapshot: 2,1 GB. Retención configurada.',
    6,
  );
  log(
    pKotlin,
    'Sesión: lista de hábitos',
    'LazyColumn con hábitos de ejemplo y checkbox. Siguiente: ViewModel y Room.',
    2,
  );
  log(
    pKotlin,
    'Apunte manual',
    'Recordar: el Nubia mata procesos en segundo plano, probar notificaciones en otro teléfono.',
    9,
    false,
  );

  // ---------------------------------------------------------------- revisiones semanales

  const revisiones: [number, string, number, number, number, number][] = [
    [28, 'Semana pesada en el trabajo. Pausé el escritorio hasta después del viaje.', 4, 6, 3, 1],
    [21, 'Avancé el MCP más de lo esperado. El homelab se está quedando atrás.', 6, 5, 2, 0],
    [14, 'Moví la fecha del homelab otra vez. Toca decidir si recortar alcance.', 5, 7, 4, 0],
    [7, 'Buen ritmo en portafolio. Backups pasa a prioridad: nunca probé restaurar.', 7, 6, 2, 1],
  ];
  for (const [dias, nota, terminadas, creadas, estancadas, pausados] of revisiones) {
    db.revisiones.push({
      id: id(),
      nota,
      resumen: {
        terminadas,
        creadas,
        estancadas,
        decisiones: { seguir: estancadas - 1, pausar: pausados, cerrar: 1 },
        proyectos_revisados: 8,
        proyectos_pausados: pausados,
      },
      fecha_creacion: haceDias(dias, 19, 30),
    });
  }

  // ---------------------------------------------------------------- calendario

  const cal = (
    nombre: string,
    color: string,
    tipo: 'turnos' | 'actividades',
    disponibilidad: 'ocupa' | 'libera' | 'contexto',
  ) => {
    const cid = id();
    db.calendarios.push({
      id: cid,
      nombre,
      color,
      tipo,
      oculto: false,
      disponibilidad,
      ciclos: [],
      excepciones: {},
    });
    return cid;
  };
  const actividad = (
    calendario_id: number,
    titulo: string,
    fecha: string,
    hora_inicio: string,
    hora_fin: string,
    dias_semana: number[] = [],
    cancelaciones: string[] = [],
  ) => {
    db.actividades.push({
      id: id(),
      calendario_id,
      titulo,
      fecha,
      hora_inicio,
      hora_fin,
      dias_semana,
      hasta: null,
      cancelaciones,
    });
  };

  const cTurnos = cal('Turnos de Camila', '#f778ba', 'turnos', 'contexto');
  const turnosCal = db.calendarios.find((c) => c.id === cTurnos)!;
  turnosCal.ciclos.push({ desde: diaRelativo(-120), ancla: diaRelativo(-120) });
  turnosCal.excepciones[diaRelativo(5)] = 'V';
  turnosCal.excepciones[diaRelativo(6)] = 'V';
  turnosCal.excepciones[diaRelativo(-4)] = 'F';

  const cColegio = cal('Colegio de Tomás', '#3fb9a0', 'actividades', 'libera');
  actividad(
    cColegio,
    'Colegio',
    diaRelativo(-200),
    '08:00',
    '13:30',
    [0, 1, 2, 3, 4],
    [diaRelativo(8)],
  );

  const cTerapias = cal('Terapias', '#c297ff', 'actividades', 'ocupa');
  actividad(cTerapias, 'Fonoaudiología', diaRelativo(-150), '16:00', '17:00', [1]);
  actividad(cTerapias, 'Terapia ocupacional', diaRelativo(-150), '15:30', '16:30', [3]);

  const cPersonal = cal('Personal', '#58a6ff', 'actividades', 'ocupa');
  actividad(cPersonal, 'Gimnasio', diaRelativo(-90), '07:00', '08:00', [0, 2, 4], [diaRelativo(2)]);
  actividad(cPersonal, 'Clase de guitarra', diaRelativo(-60), '10:00', '11:00', [5]);
  actividad(cPersonal, 'Dentista', diaRelativo(2), '11:00', '12:00');
  actividad(cPersonal, 'Almuerzo con Ignacio', diaRelativo(4), '13:00', '14:30');
  actividad(cPersonal, 'Reunión de apoderados', diaRelativo(9), '19:00', '20:30');

  db.horarioBase = [0, 1, 2, 3, 4].flatMap((dia) => [
    { dia_semana: dia, hora_inicio: '09:00', hora_fin: '13:00' },
    { dia_semana: dia, hora_inicio: '15:00', hora_fin: '18:00' },
  ]);
  db.horarioBase.push({ dia_semana: 5, hora_inicio: '11:00', hora_fin: '13:00' });

  // Bloques de trabajo: algunos los reservó el asistente por MCP.
  const bloque = (tid: number, dia: number, ini: string, fin: string, origen: 'app' | 'mcp') =>
    db.bloques.push({
      id: id(),
      tarea_id: tid,
      fecha: diaRelativo(dia),
      hora_inicio: ini,
      hora_fin: fin,
      origen,
      liberado: false,
    });
  bloque(tAstro, -1, '09:00', '11:00', 'app');
  bloque(tChoques, -2, '15:00', '17:00', 'mcp');
  bloque(tAstro, 0, '09:00', '11:00', 'app');
  bloque(tChoques, 0, '15:00', '16:30', 'mcp');
  bloque(tRestore, 1, '09:00', '11:00', 'mcp');
  bloque(tCaso, 1, '15:00', '17:00', 'mcp');
  bloque(tHabitosUi, 2, '09:00', '10:30', 'app');
  bloque(tE2e, 3, '09:00', '12:00', 'mcp');
  bloque(tDocSetup, 4, '15:00', '16:00', 'mcp');
  bloque(tCerts, 4, '16:00', '17:00', 'mcp');
  bloque(tDeploy, 6, '11:00', '12:00', 'app');

  // ---------------------------------------------------------------- claves API e integraciones

  db.apiKeys = [
    {
      id: id(),
      nombre: 'Claude Code — portátil',
      prefijo: 'csk_7f3a',
      scopes: [
        'memory:read',
        'memory:write',
        'tasks:read',
        'tasks:create',
        'tasks:manage',
        'calendar:read',
      ],
      proyecto_ids: [],
      todos_proyectos: true,
      todos_calendarios: true,
      fecha_creacion: haceDias(40, 12),
      expira_en: null,
      revocada_en: null,
      ultimo_uso: haceDias(0, 9, 12),
    },
    {
      id: id(),
      nombre: 'Codex — homelab',
      prefijo: 'csk_b21e',
      scopes: ['memory:read', 'memory:write', 'tasks:read'],
      proyecto_ids: [pHomelab, pBackups],
      calendario_ids: [],
      fecha_creacion: haceDias(25, 12),
      expira_en: medianocheUTC(diaRelativo(65)),
      revocada_en: null,
      ultimo_uso: haceDias(6, 22),
    },
    {
      id: id(),
      nombre: 'Prueba OpenCode',
      prefijo: 'csk_04c9',
      scopes: ['memory:read'],
      proyecto_ids: [pMcp],
      fecha_creacion: haceDias(35, 12),
      expira_en: null,
      revocada_en: haceDias(20, 12),
      ultimo_uso: haceDias(30, 12),
    },
  ];

  const hoy = diaRelativo(0);
  db.ticktick.tasks = [
    {
      id: 'tt1',
      project_id: 'inbox',
      list: 'Inbox',
      title: 'Pagar cuenta de la luz',
      priority: 5,
      due_date: hoy,
      time_zone: 'America/Santiago',
      is_all_day: true,
    },
    {
      id: 'tt2',
      project_id: 'casa',
      list: 'Casa',
      title: 'Comprar regalo para Tomás',
      priority: 3,
      due_date: hoy,
      time_zone: 'America/Santiago',
      is_all_day: true,
    },
    {
      id: 'tt3',
      project_id: 'casa',
      list: 'Casa',
      title: 'Llamar al mecánico',
      priority: 1,
      due_date: `${hoy}T15:00:00`,
      time_zone: 'America/Santiago',
      is_all_day: false,
    },
    {
      id: 'tt4',
      project_id: 'tramites',
      list: 'Trámites',
      title: 'Renovar licencia de conducir',
      priority: 0,
      due_date: hoy,
      time_zone: 'America/Santiago',
      is_all_day: true,
    },
  ];

  db.seq = seq;
  return db;
}
