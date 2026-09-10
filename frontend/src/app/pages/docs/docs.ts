import { Component, ElementRef, effect, viewChild } from '@angular/core';

@Component({
  selector: 'app-docs',
  imports: [],
  templateUrl: './docs.html',
  styleUrl: './docs.css',
})
export class Docs {
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('iframeRef');

  constructor() {
    effect(() => {
      const iframe = this.iframeRef()?.nativeElement;
      if (iframe) {
        iframe.srcdoc = `<!doctype html>
<html lang="es">
  <head>
    <title>Cassandra API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="/" />
    <style>
      body {
        margin: 0;
        padding: 0;
        height: 100vh;
        overflow: hidden;
        background-color: #0b0f19;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-url="/docs/openapi.json"
      data-configuration='{
        "theme": "purple",
        "darkMode": true,
        "showSidebar": true,
        "layout": "modern"
      }'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
      }
    });
  }
}
