---
name: Cassandra
description: "Sistema visual existente para claridad, estructura y foco."
colors:
  primary: "oklch(68.1% 0.162 75.834)"
  background: "oklch(21% 0.006 285.885)"
  surface: "oklch(26% 0.008 285)"
  surface-border: "oklch(32% 0.01 285)"
  text-main: "oklch(96% 0.003 285)"
  text-muted: "oklch(72% 0.01 285)"
  accent: "oklch(70% 0.12 200)"
  on-primary: "oklch(21% 0.006 285.885)"
  success: "oklch(72% 0.17 142)"
  danger: "oklch(65% 0.20 25)"
  warning: "oklch(76.9% 0.188 70.08)"
  warning-text: "oklch(82.8% 0.189 84.429)"
  light-primary: "#8a5a00"
  light-background: "#f7f8fa"
  light-surface: "#fff"
  light-surface-border: "#cbd2db"
  light-text-main: "#20242b"
  light-text-muted: "#586174"
  light-accent: "#146c80"
  light-on-primary: "#fff"
  light-success: "#236b39"
  light-danger: "#b12836"
  light-warning: "#986000"
  light-warning-text: "#895600"
  ocean-dark-primary: "#78b8ff"
  ocean-dark-background: "#111c29"
  ocean-dark-surface: "#182737"
  ocean-dark-surface-border: "#36536f"
  ocean-dark-text-main: "#edf5ff"
  ocean-dark-text-muted: "#a9bbcf"
  ocean-dark-accent: "#66d5d1"
  ocean-dark-on-primary: "#0a1928"
  ocean-light-primary: "#245c9b"
  ocean-light-background: "#f2f7fc"
  ocean-light-surface-border: "#c5d5e5"
  ocean-light-text-main: "#1e3146"
  ocean-light-text-muted: "#51667b"
  ocean-light-accent: "#126e73"
  forest-dark-primary: "#8ed3a2"
  forest-dark-background: "#142019"
  forest-dark-surface: "#1e2e24"
  forest-dark-surface-border: "#3e6248"
  forest-dark-text-main: "#edf7ef"
  forest-dark-text-muted: "#aac7b2"
  forest-dark-accent: "#ddc56f"
  forest-dark-on-primary: "#102317"
  forest-light-primary: "#2c6b43"
  forest-light-background: "#f3f8f2"
  forest-light-surface-border: "#c6d8c7"
  forest-light-text-main: "#21382b"
  forest-light-text-muted: "#536b59"
  forest-light-accent: "#796000"
  violet-dark-primary: "#c4a1f5"
  violet-dark-background: "#1c1828"
  violet-dark-surface: "#292338"
  violet-dark-surface-border: "#57456f"
  violet-dark-text-main: "#f4efff"
  violet-dark-text-muted: "#bfb1d5"
  violet-dark-accent: "#76d4d0"
  violet-dark-on-primary: "#23132f"
  violet-light-primary: "#7544a2"
  violet-light-background: "#f8f4fc"
  violet-light-surface-border: "#d6cae5"
  violet-light-text-main: "#30223e"
  violet-light-text-muted: "#6b587d"
  violet-light-accent: "#166b75"
typography:
  headline:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
  title:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.5rem"
  label:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.875rem"
    lineHeight: "1.25rem"
rounded:
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
spacing:
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, var(--theme-primary) 90%, transparent)"
  button-secondary:
    textColor: "{colors.text-main}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-danger:
    textColor: "color-mix(in oklch, var(--theme-danger) 90%, var(--theme-text-main))"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  navigation-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 0.875rem"
  status-chip:
    textColor: "{colors.success}"
    rounded: "{rounded.lg}"
    padding: "0.125rem 0.625rem"
  settings-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  connection-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
---
# Design System: Cassandra

## Overview

**Creative North Star: "Minimal cognitive load, high clarity, structured focus mode"**

Cassandra conserva una interfaz de trabajo compacta y estructurada: fondos continuos, superficies delimitadas, tipografía legible y un acento reconocible para orientar la acción. La identidad vigente de PRODUCT.md exige claridad y poca distracción.

Las cuatro paletas cambian los roles cromáticos y mantienen la misma jerarquía, geometría y navegación. Ámbar oscuro es la apariencia original y predeterminada; Océano, Bosque y Violeta amplían esa misma identidad. No se establece una nueva dirección artística.

**Key Characteristics:**

- Jerarquía mediante contraste tonal, bordes y peso tipográfico.
- Un rol primario estable por paleta; estados funcionales separados del tema.
- Controles con etiquetas visibles y foco explícito en Configuración.
- La misma estructura en las ocho combinaciones de paleta y modo resuelto.

La fuente normativa de ejecución es `frontend/public/theme.css`; `frontend/src/styles.css` publica sus roles como utilidades Tailwind. Este documento registra el sistema implementado. El frontmatter contiene colores concretos reutilizados y sus diferencias por variante, sin sustituir la cascada CSS.

## Colors

### Primary

Ámbar, Océano, Bosque y Violeta son los nombres visibles definidos en `appearance.model.ts`. Cada una tiene un primario y un acento para modo oscuro y claro. `primary` señala acciones y navegación activa; `accent` distingue actividad en curso y prioridad normal. El acento es un rol secundario funcional del sistema existente.

Los nombres sin prefijo representan Ámbar oscuro. `light-<rol>` registra la sobrescritura de modo claro; `<paleta>-<modo>-<rol>` registra las sobrescrituras de Océano (`ocean`), Bosque (`forest`) y Violeta (`violet`). Solo se enumeran diferencias reales: no se crean valores nuevos para roles heredados.

| Tema | Oscuro | Claro |
| --- | --- | --- |
| Ámbar (`amber`) | Roles sin prefijo | Roles `light-*` sobre la base |
| Océano (`ocean`) | Base + `ocean-dark-*` | Base + `light-*` + `ocean-light-*` |
| Bosque (`forest`) | Base + `forest-dark-*` | Base + `light-*` + `forest-light-*` |
| Violeta (`violet`) | Base + `violet-dark-*` | Base + `light-*` + `violet-light-*` |

### Neutral

`background` es el lienzo y el interior de los campos; `surface` es la capa de tarjetas, navegación y diálogos. `surface-border` separa contenedores y listas. `text-main` comunica títulos y contenido; `text-muted` acompaña instrucciones y metadatos. Las tres paletas adicionales heredan la superficie blanca del modo claro.

Los controles especiales mantienen roles propios `control-background`, `control-border`, `control-label`, `control-muted` y `control-text` en la fuente CSS. No deben sustituirse por colores fijos. Los colores de Mermaid y de la documentación API también se mantienen allí; Mermaid recibe valores hexadecimales resueltos porque no interpreta OKLCH ni `var()`.

### Functional States

`success` identifica terminado y confirmaciones; `danger` identifica bloqueos y errores; `warning` y `warning-text` identifican avisos y prioridad alta. Estos roles cambian con el modo y se comparten entre paletas. Los roles existentes para categorías, información y reflexiones siguen definidos en `theme.css`; cambiar la paleta no redefine su significado.

**The Semantic Roles Rule.** El componente elige un rol, no una paleta. Los valores y alias pertenecen a theme.css; styles.css expone los mismos roles a Tailwind.

**The Paired Foregrounds Rule.** Un fondo sólido primario usa on-primary; un fondo accent o success usa su correspondiente on-accent u on-success. La elección de tema no cambia este contrato.

`on-accent` y `on-success` siguen a `on-primary`. `on-selected` sigue a `on-primary` en claro y en las paletas oscuras adicionales; Ámbar oscuro conserva su valor original. Los alias `text-default`, colores de controles, diagramas y documentación siguen las reglas de cascada de la fuente. El frontmatter conserva OKLCH, hex y `color-mix()` donde esos formatos son canónicos; no normalizarlos a una tabla hexadecimal paralela.

## Typography

**Body / Headline Font:** `'Inter', system-ui, -apple-system, sans-serif`.
**Mono Font:** `'JetBrains Mono', monospace`.

Son stacks declarados en `styles.css`; no hay carga de archivos de estas fuentes en `index.html` ni `@font-face` en la fuente revisada. Mantener sus fallbacks y no introducir dependencias tipográficas como parte de un cambio de tema.

La interfaz usa la escala de Tailwind con pesos medios, seminegrita y negrita para separar navegación, contenido y títulos. Los tokens `headline`, `title`, `body`, `label` y `mono` del frontmatter corresponden a usos observados; no existe un rol display adicional en Configuración.

- **Headline:** título de página, negrita.
- **Title:** títulos de Apariencia y Conexiones, seminegrita.
- **Body:** valores de los selectores y contenido principal.
- **Label:** etiquetas e instrucciones compactas; las instrucciones usan color atenuado y peso normal.
- **Mono:** secretos, prefijos de claves y datos técnicos. Los prefijos compactos también usan el tamaño de metadatos (0.75rem).

## Layout

El shell ocupa la altura de la pantalla y desplaza el contenido principal de forma independiente. La barra lateral mide (16rem). A partir de `md` (48rem) queda visible; por debajo se abre como panel superpuesto, con encabezado y navegación inferior móviles. El contenido tiene relleno (1rem), que aumenta a (1.5rem) en `md`; el margen inferior móvil (6rem) deja espacio a la navegación. Se respetan los safe-area insets en la navegación móvil y el panel lateral.

La escala de espaciado parte de (0.25rem). Configuración limita su ancho a (64rem), se centra y separa secciones con (2rem). La tarjeta de Apariencia usa una columna y pasa a dos en `sm` (40rem), con separación de (1.5rem). Las tarjetas usan (1.25rem) de relleno y aumentan a (1.5rem) en `md`. El enlace de conexión tiene altura mínima (5rem); los selectores, campos y botones de claves API tienen altura mínima (2.75rem).

La página de claves conserva una columna hasta `lg` (64rem); después distribuye formulario y lista en proporciones (0.85fr / 1.15fr). Los hijos usan ancho mínimo cero y ajustan textos largos para mantener la lectura en pantallas estrechas. Estas medidas documentan componentes existentes, no una plantilla obligatoria para todas las páginas.

## Elevation & Depth

La profundidad combina capas tonales, bordes y sombras puntuales. Las tarjetas de Configuración permanecen sin sombra; la elevación fuerte se reserva para paneles móviles y diálogos. Las tarjetas de proyectos existentes añaden sombra y un desplazamiento vertical corto al pasar el puntero.

La escala usada de Tailwind incluye sombra tenue `xs`, sombra de acción `md`, sombra `xl` en hover de proyectos y sombra `2xl` para superposiciones. Los valores exactos se conservan en el sidecar. El fondo de diálogo combina overlay negro al 70 % con desenfoque (4px); el del panel móvil usa overlay al 50 %. El encabezado y la navegación inferior móviles tienen superficies translúcidas y desenfoque.

Las transiciones de botones de claves API duran (150ms); la navegación lateral se desplaza en (300ms). Los cambios de color heredan las transiciones existentes de cada componente; no hay una animación global añadida al cambio de tema.

## Shapes

Los campos y botones de claves API usan esquinas suaves `lg`; la navegación y los detalles internos usan `xl`; las tarjetas principales y diálogos usan `2xl`. Las etiquetas pequeñas emplean `md` o `lg` según el componente existente. Sus valores aparecen en el frontmatter. Los bordes normales son de (1px), y los estados funcionales pueden combinar borde y fondo translúcido con texto explícito.

## Components

### Buttons

Acciones claras con texto visible. En claves API, primario, secundario y peligro comparten altura mínima (2.75rem), radio `lg`, relleno (0.5rem 1rem) y etiqueta seminegrita (0.875rem).

- **Primary:** `primary` con `on-primary`; hover al 90 % del fondo.
- **Secondary:** transparente, borde `surface-border`, texto `text-main`; hover con `surface-border` al 60 %.
- **Danger:** borde `danger`, texto mezclado con `text-main` para mayor contraste y fondo `danger` al 10 % en hover.
- **Focus / Disabled:** contorno primario (2px) separado (2px); deshabilitado con opacidad (60 %) y cursor de acción no disponible.

Otros botones existentes conservan sus radios y densidades. La definición anterior registra las primitivas de Configuración sin imponer una migración global.

### Chips

Los estados y prioridades combinan etiqueta textual, color semántico y fondo translúcido. El estado Terminado usa `success` al 15 % como fondo y al 30 % en borde; el texto usa el rol completo. Las etiquetas Activa de claves API usan borde neutro y texto de éxito. No intercambiar el significado de estos estados al cambiar de paleta.

### Cards / Containers

Tarjetas de Apariencia y Conexiones: `surface`, borde `surface-border`, radio `2xl` y relleno adaptable. La tarjeta de conexión es un enlace completo, con título, descripción, icono y flecha; hover con borde tonal al 40 % como fondo y foco de contorno primario. Es una entrada de navegación, con altura mínima (5rem).

### Inputs / Fields

Campos con fondo `background`, borde `surface-border`, texto `text-main` y radio `lg`. Los selectores conservan el comportamiento nativo y las etiquetas visibles. Configuración usa cuerpo de (1rem) y foco primario; el campo de secreto usa tipografía mono. Los mensajes de error y almacenamiento se expresan mediante texto y roles accesibles.

### Navigation

La entrada activa de la barra lateral usa fondo `primary` y texto `on-primary`; Configuración conserva ese estado dentro de Claves API. Las entradas inactivas usan `text-main`, con hover de borde tonal. La navegación inferior móvil usa una cápsula de primario al 20 % y texto primario para el destino activo.

La entrada general es `/configuracion`. Apariencia aloja selectores independientes de Tema y Modo; Conexiones enlaza a `/configuracion/claves-api`, con retorno a Configuración. `/claves-api` redirige a esa ruta. No replicar los selectores de apariencia en la barra lateral.

### Appearance Behavior

Los valores de paleta son `amber`, `ocean`, `forest` y `violet`. Los modos son `dark`, `light` y `system`; este último se presenta como «Según el sistema» y se resuelve en claro u oscuro mediante `prefers-color-scheme`. Hay ocho combinaciones visuales resueltas, no doce temas distintos.

La preferencia inicial es Ámbar oscuro. `cassandra.appearance` guarda `{ palette, mode }` en el almacenamiento local del dispositivo; los cambios se aplican al momento y se sincronizan entre pestañas del mismo origen. Si el almacenamiento no está disponible, la selección sigue aplicada en la sesión y la UI informa que no pudo guardarse. `theme-init.js` aplica la preferencia antes del primer render; `AppearanceService` mantiene `data-palette`, `data-mode`, `color-scheme` y las metas del navegador.

La misma fuente semántica alimenta la app y la documentación API. Las barras nativas Android conservan `R.color.app_background`; la actualización de metas del navegador no implica que esas barras estén tematizadas.

## Do's and Don'ts

### Do:

- **Do** usar los roles semánticos compartidos y sus pares de texto sobre color.
- **Do** conservar dimensiones, jerarquía, etiquetas y contenido al cambiar de tema.
- **Do** mantener el contorno de foco visible y las etiquetas nativas de los selectores.
- **Do** conservar la clave de apariencia por dispositivo y la aplicación previa al primer render.

### Don't:

- **Don't** fijar texto blanco sobre el primario: el color correcto depende de on-primary.
- **Don't** convertir los colores de error, éxito o advertencia en variantes de marca.
- **Don't** crear otra tabla de colores dentro de un componente o duplicar los tokens de theme.css.
- **Don't** afirmar que las barras nativas Android siguen la paleta: conservan R.color.app_background.

Evidencia: `PRODUCT.md`; `frontend/public/theme.css`; `frontend/src/styles.css`; `frontend/src/app/models/appearance.model.ts`; `frontend/src/app/services/appearance.service.ts`; `frontend/public/theme-init.js`; `frontend/src/app/pages/configuracion/`; componentes sidebar, header, bottom-nav, project-card y confirm-modal; `frontend/src/app/layouts/main-layout/main-layout/main-layout.html`; `frontend/src/app/utils/task-styles.util.ts`; `frontend/src/app/app.routes.ts`; valores de la escala instalada en `frontend/node_modules/tailwindcss/theme.css`.
