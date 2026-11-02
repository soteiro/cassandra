# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.1.

## Estructura

`src/app` se organiza por área funcional, no por tipo de archivo:

- `core/`: lo que existe una sola vez en la app (auth, servidor, plataforma y layout).
- `shared/`: código reutilizable sin lógica de dominio (UI genérica, directivas, utilidades).
- `features/<área>/`: cada área con sus `pages/`, `components/`, `data/` y `utils/`, y su `<área>.routes.ts` cargado con `loadChildren`.

Las reglas (dónde va el código nuevo, qué puede importar a qué y cómo se nombran las cosas) están en [`AGENTS.md`](AGENTS.md#project-structure).

### Migración futura: alias de imports

Hoy todos los imports son relativos (`../../../../shared/...`). Está decidido posponer los alias hasta que valga la pena; si se hace, el plan es:

1. En `tsconfig.json`, dentro de `compilerOptions`, agregar `"paths"`: `@core/*` → `src/app/core/*`, `@shared/*` → `src/app/shared/*` y `@features/*` → `src/app/features/*`.
2. Reescribir con un script solo los imports que **cruzan** entre `core/`, `shared/` y `features/<x>/`. Los imports dentro de una misma feature siguen siendo relativos, para que una feature se pueda mover sin tocar su interior.
3. Hacerlo en un solo PR mecánico, sin otros cambios, verificado con `ng build`, `ng test --watch=false` y `pnpm run e2e`.
4. Actualizar la sección *Project Structure* de `AGENTS.md` (y sus copias en `.claude/`, `.gemini/`, `.github/` y `.cursor/`) para que el código nuevo use los alias.

## Colores de la interfaz

La paleta actual está centralizada en [`public/theme.css`](public/theme.css).
`src/styles.css` expone estos roles como utilidades Tailwind: usa `text-warning-text`,
`bg-control-background` o `border-info` en lugar de colores concretos como
`text-amber-400`, `bg-slate-950` o `border-blue-500`. Las opacidades siguen usando
la sintaxis habitual (`bg-warning/15`).

- `primary`, `accent`, `surface`, `text-main` y `text-muted`: estructura general.
- `on-primary`, `on-accent`, `on-success`, `on-solid` y `on-selected`: texto sobre
  superficies coloreadas, independiente del fondo de la página.
- `control-*`: campos de acceso y conexión al servidor.
- `warning`, `info`, `positive` e `insight`: estados y categorías. `*-text` es el
  texto habitual, `*-emphasis` el texto destacado y `*-surface` / `*-border`
  los fondos y bordes de las insignias de proyectos.
- `personal`, `learning`, `idea`, `creative`, `retrospective` y `neutral`:
  categorías de contactos y documentos.
- `overlay` e `interaction-shade`: fondos de modales y estados de interacción.
- `diagram-*`: valores hexadecimales que Mermaid lee de CSS al inicializarse.
- `docs-*`: fondo y scrollbars de la documentación API. Su hoja compartida
  `public/docs/styles.css` carga la misma paleta dentro del iframe y en `/docs/`.

En `/configuracion` se elige entre Neutro (shadcn/ui), GitHub, VS Code, Catppuccin,
Synthwave ’84, Nord, Rosé Pine y Solarized, con modo
claro, oscuro o según el sistema. La preferencia se guarda en `localStorage`
con la clave `cassandra.appearance`, por dispositivo, y se comparte entre pestañas.
`public/theme-init.js` aplica la elección antes del primer render; `AppearanceService`
gestiona los cambios y escucha el modo del sistema. Al agregar una paleta, actualiza
`PALETTES` en `appearance.model.ts`, la validación de arranque y `public/theme.css`.
Son adaptaciones a los componentes de Cassandra. Referencias publicadas:
[shadcn/ui](https://ui.shadcn.com/docs/theming),
[GitHub Primer](https://primer.style/product/primitives/color/),
[VS Code Modern](https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes),
[Catppuccin Latte/Mocha](https://github.com/catppuccin/palette),
[Synthwave ’84](https://github.com/robb0wen/synthwave-vscode),
[Nord](https://www.nordtheme.com/docs/colors-and-palettes/),
[Rosé Pine Main/Dawn](https://rosepinetheme.com/palette/)
y [Solarized](https://ethanschoonover.com/solarized/).
Synthwave ’84 toma el violeta, rosa y cian de su versión oscura publicada; su modo
claro es una adaptación propia de Cassandra. Los textos, acciones y estados se
ajustan cuando hace falta para conservar contraste AA.
Los identificadores `amber`, `ocean`, `forest` y `violet` se conservan para no
invalidar preferencias guardadas. `primary` es el fondo de acción y
`primary-text` es el color de enlaces e iconos; cada uno tiene su propio contraste.
`primary-hover` define un fondo de interacción explícito para cada preset.
Los diagramas se vuelven a dibujar al cambiar de apariencia y su caché se invalida.
Las claves API están en `/configuracion/claves-api`, enlazadas desde Configuración;
la ruta anterior `/claves-api` redirige a su nueva dirección.

Los colores de arranque de Android y del navegador y el logo son recursos separados;
el navegador actualiza su color al cargar la paleta y las barras nativas de Android
todavía reutilizan `R.color.app_background`.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
