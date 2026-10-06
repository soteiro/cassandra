# Informe de desbordes de pestañas y filtros en móvil

Fecha de revisión: 5 de octubre de 2026.

## Estado tras la corrección

Las cinco fallas descritas en este informe fueron corregidas. La descripción y las mediciones iniciales se conservan abajo como registro del diagnóstico.

- Finanzas: navegación en una columna y con ancho completo en móvil; distribución flexible con salto de línea desde `sm`. Las acciones superiores ya no imponen el ancho mínimo de la barra.
- Presupuesto, Proyectos y Reflexiones: filtros en dos columnas en móvil y filas que pueden envolver en pantallas mayores. Los botones de estas barras y de la navegación de Finanzas tienen al menos 44 px de altura antes de `sm`.
- Tareas: dos columnas en móvil, tres desde `sm` y fila flexible con salto de línea desde `lg`. Se elimina la fila única que fallaba a 768 px.

**Verificación posterior:** compilación de desarrollo correcta; `git diff --check` correcto; 88 comprobaciones de vistas y variantes en Chromium, sin exceso horizontal del área principal ni botones fuera de pantalla. Incluye ocho anchos (320, 360, 390, 412, 640, 768, 1024 y 1280 px), además de 100 proyectos y 100 deseos pendientes en 320, 768 y 1280 px. La variante de datos grandes valida los contadores de Proyectos y la insignia de Finanzas; no simula 100 tareas. Se revisaron visualmente las capturas móviles y la vista de Tareas a 768 px.

La evidencia posterior está en `/tmp/cassandra-tabs-fixed/results.json` y las capturas en `/tmp/cassandra-tabs-fixed/`. La verificación utiliza datos simulados y no incluye dispositivos Android físicos.

## Resultado

Se confirmaron **5 fallas**: dos barras con botones fuera de pantalla en móviles pequeños, dos desbordes leves de contenedor en 320 px y una regresión de los filtros de Tareas al activar el diseño de escritorio en 768 px.

El patrón común es una barra interior `flex` sin salto de línea ni desplazamiento horizontal propio. Poner `flex-wrap` solamente en el contenedor exterior permite mover la barra completa, pero no distribuir sus botones.

La auditoría inicial no modificó el código; las correcciones posteriores se detallan en el apartado de estado.

## Método y alcance

- Inspección de plantillas, estilos y controles que cambian pestañas, vistas o filtros en `frontend/src/app`.
- Ejecución del frontend actual con Angular y Chromium mediante Playwright.
- Anchos revisados: **320, 360, 390, 412, 768 y 1280 px**, con altura de 900 px.
- Vistas comprobadas: Finanzas/Presupuesto, Lista de Deseos, Proyectos, bitácora personal/Reflexiones, detalle de proyecto/Tareas, Notas, Documentos y editor de documentos.
- API y sesión simuladas localmente: un proyecto, una nota y un documento; sin tareas, movimientos ni deseos. No se utilizó ni alteró la base de datos.
- Mediciones de límites de barras y botones, `clientWidth`/`scrollWidth`, estilos calculados y capturas.

Los resultados prueban el comportamiento del frontend con esos datos y anchos; no equivalen a una prueba en un dispositivo Android físico ni cubren contadores grandes, aumento de texto o todas las variantes de datos. El alcance es responsive de pestañas y filtros; no se asigna una puntuación global de accesibilidad, rendimiento o theming.

## Hallazgos prioritarios

### 1. [P1] Filtros de estado del presupuesto fuera de pantalla

- **Archivo:** `frontend/src/app/pages/finanzas/components/presupuesto-tab/presupuesto-tab.html:11`.
- **Controles:** Todos, Pendientes, En Proceso y Completados.
- **Prueba:** barra de aproximadamente 333 px dentro de un espacio útil de 254 px en viewport de 320 px y de 294 px en 360 px. Su borde derecho llega a x=366; el botón Completados queda parcialmente fuera de pantalla en ambos tamaños.
- **Impacto:** el usuario necesita desplazar horizontalmente el contenido para alcanzar y leer completamente el último filtro. En 390 px ya cabe en pantalla, pero la barra todavía rebasa el área interior de la tarjeta en unos 9 px.
- **Causa:** la barra interior mantiene `flex` sin `flex-wrap`; los iconos, textos y padding establecen un ancho mínimo que supera el disponible.
- **Recomendación:** usar una cuadrícula móvil de dos columnas y adaptar la fila según el espacio disponible; alternativamente, contener el scroll en la propia barra con una señal visible de continuidad. Evitar que desplace toda la página.
- **Acción sugerida:** `$impeccable adapt`.

### 2. [P1] Pestañas principales de Finanzas exceden el ancho en 320 px

- **Archivo:** `frontend/src/app/pages/finanzas/finanzas.html:36`.
- **Controles:** Presupuesto, Lista de Deseos y Cuentas & Categorías.
- **Prueba:** barra de aproximadamente 317 px frente a 288 px disponibles. En la vista inicial de Presupuesto su borde derecho llega a x=333 en una pantalla de 320 px; Cuentas & Categorías queda parcialmente fuera.
- **Impacto:** la navegación principal desborda y el último destino requiere desplazamiento horizontal. En 360–412 px cabe, pero las etiquetas se comprimen en varias líneas.
- **Causa:** el grupo interior no permite reorganizar los botones; su padre de acciones también conserva el tamaño mínimo del grupo. La insignia condicional de deseos añade ancho y constituye una variante pendiente de validar.
- **Recomendación:** dar a la navegación una fila propia con ancho limitado al contenedor y usar una distribución móvil que conserve las etiquetas; separar las acciones Recargar, Clonar y Nuevo Movimiento de esa distribución.
- **Acción sugerida:** `$impeccable adapt`.

### 3. [P1] Los filtros de Tareas vuelven a desbordar a 768 px

- **Archivo:** `frontend/src/app/pages/proyect-details/components/tasks-tab/tasks-tab.html:22`.
- **Controles:** Pendientes, En Curso, Bloqueadas, Abiertas, Completadas y Todas.
- **Prueba:** a 768 px, la barra tiene 420 px de ancho interior y 493 px de contenido. El área principal presenta 27 px de exceso horizontal y Todas queda parcialmente fuera de pantalla.
- **Impacto:** el cambio a tablet/escritorio empeora una barra que funciona en móvil. También afecta ventanas estrechas y orientación horizontal alrededor de ese breakpoint.
- **Causa:** `md:flex` reemplaza la cuadrícula móvil por una fila sin `flex-wrap`, al mismo tiempo que aparece la barra lateral de 256 px. El viewport crece, pero el espacio útil de la vista no alcanza para seis botones.
- **Recomendación:** conservar una cuadrícula en tamaños intermedios o permitir envolver la fila; activar la fila única cuando el ancho útil lo permita. Una container query puede basar la adaptación en el espacio real del componente.
- **Acción sugerida:** `$impeccable adapt`.

### 4. [P2] Filtros de Proyectos rebasan su tarjeta en 320 px

- **Archivo:** `frontend/src/app/pages/proyectos/proyectos.html:94`.
- **Controles:** Todos, Activos, Terminados y Alta Prioridad, con contadores.
- **Prueba:** barra de aproximadamente 295 px en una tarjeta de 288 px de ancho exterior. Comienza en x=29 y termina en x=324: invade el padding, sobresale de la tarjeta y genera 4 px de exceso horizontal en el área principal.
- **Impacto:** el borde de la barra queda recortado y se pierde la alineación. Con los contadores de prueba, los botones permanecen dentro de pantalla; el efecto es menor que en Finanzas.
- **Causa:** el grupo de filtros mantiene una sola fila. El `flex-wrap` de su padre no distribuye los botones interiores.
- **Recomendación:** cuadrícula de dos columnas en móvil o `flex-wrap` dentro de la barra, con ancho acotado al área interior de la tarjeta. Validar contadores de dos y tres dígitos.
- **Acción sugerida:** `$impeccable adapt`.

### 5. [P2] Historial de Reflexiones invade el margen derecho en 320 px

- **Archivo:** `frontend/src/app/components/reflexiones-view/reflexiones-view.html:168`.
- **Controles:** Todas, Reflexiones, Memorias y Eventos.
- **Prueba:** barra de aproximadamente 305 px frente a 288 px disponibles; termina en x=321. Produce aproximadamente 1 px de exceso horizontal en el área principal y consume el margen derecho.
- **Impacto:** el contorno queda recortado y la barra pierde su margen. Los textos de los botones permanecen visibles en el caso probado; no se observó un bloqueo de navegación.
- **Causa:** barra interior sin adaptación, aunque la fila de título y filtros exterior sí tiene `flex-wrap`.
- **Recomendación:** envolver los botones dentro del ancho disponible o distribuirlos en dos columnas para pantallas pequeñas.
- **Acción sugerida:** `$impeccable adapt`.

## Controles que se ajustaron correctamente

- **Pestañas principales de detalle de proyecto**, `proyect-details.html:19`: usan una columna en móvil y filas que pueden envolver desde `md`.
- **Filtros de Tareas en 320–412 px**: la cuadrícula de dos columnas evita el desborde. El problema aparece al cambiar a `md:flex`.
- **Filtros de Notas**, `notes-tab.html:45`: `flex-wrap` distribuye los botones dentro del espacio disponible.
- **Categorías de Documentos**, `documents-tab.html:62`: los botones saltan de línea.
- **Editor Escribir/Vista Previa**, `documents-tab.html:400`: cabe en los anchos revisados; Dividido se oculta antes de `md`.
- **Gastos/Egresos e Ingresos** y **filtros de Lista de Deseos**: no se confirmó desborde de estas barras con contadores en cero. El exceso horizontal de 11 px registrado en la vista Deseos de 320 px pertenece a la navegación principal compartida de Finanzas.

## Observaciones transversales

El layout principal (`frontend/src/app/layouts/main-layout/main-layout/main-layout.html:12`) tiene `overflow-y-auto`. El navegador calcula también el eje horizontal como desplazable cuando su contenido lo excede; las barras no tienen un scroll local propio. Esto permite recuperar parte del contenido con desplazamiento horizontal de toda la vista, pero no resuelve su adaptación.

Las alturas de botones medidas varían entre 24 y 56 px por el ajuste de textos. Algunas son pequeñas para interacción táctil; conviene revisar el tamaño de toque junto con el layout. La altura por sí sola no permite concluir una infracción de WCAG sin evaluar también dimensiones, separación y excepciones.

El detector mecánico de Impeccable emitió un aviso de imagen sin `src` en Reflexiones. Es un falso positivo del análisis estático: la plantilla sí declara `[src]="avatarUrl"`. Las capturas bloquean solicitudes externas y, por tanto, el avatar roto que aparece en ellas no demuestra un defecto del producto.

## Orden recomendado de corrección y verificación

1. Corregir los filtros del presupuesto y la navegación principal de Finanzas.
2. Corregir el cambio de layout de Tareas a 768 px, teniendo en cuenta el ancho ocupado por la barra lateral.
3. Ajustar las barras de Proyectos y Reflexiones en 320 px.
4. Comprobar los mismos anchos con contadores grandes, insignia de deseos visible, todas las opciones activas y texto ampliado. Verificar que no haya scroll horizontal de la página por estas barras.
5. Aplicar `$impeccable polish` al cierre para confirmar alineación y legibilidad.

## Evidencia de esta sesión

Mediciones: `/tmp/cassandra-tabs-audit/results.json`.

Capturas: `/tmp/cassandra-tabs-audit/`, con archivos por vista y ancho. Por ejemplo: `finanzas-320.png`, `proyectos-320.png`, `reflexiones-320.png` y `detalle-768.png`. El script de comprobación está en `/tmp/cassandra-tabs-audit.cjs`. Los archivos en `/tmp` son temporales.
