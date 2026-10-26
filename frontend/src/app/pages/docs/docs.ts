import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';

@Component({
  selector: 'app-docs',
  imports: [],
  templateUrl: './docs.html',
  styleUrl: './docs.css',
})
export class Docs {
  private readonly appearance = inject(AppearanceService);
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('iframeRef');

  constructor() {
    effect(() => {
      const iframe = this.iframeRef()?.nativeElement;
      if (iframe) {
        iframe.srcdoc = `<!doctype html>
<html lang="es" data-palette="${this.appearance.palette()}" data-mode="${this.appearance.resolvedMode()}">
  <head>
    <title>Cassandra API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="/" />
    <link rel="stylesheet" href="/docs/styles.css" />
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-url="/docs/openapi.json"
      data-configuration='{
        "theme": "purple",
        "darkMode": ${this.appearance.resolvedMode() === 'dark'},
        "showSidebar": true,
        "layout": "modern",
        "customCss": "@media (min-width: 768px) { aside, .sidebar, .scalar-sidebar, [data-scalar-sidebar], .t-doc__sidebar { position: -webkit-sticky !important; position: sticky !important; top: 0 !important; height: 100vh !important; max-height: 100vh !important; align-self: flex-start !important; overflow-y: auto !important; z-index: 10 !important; } }"
      }'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
      }
    });
  }
}
