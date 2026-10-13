import { Injectable } from '@angular/core';
import type { Mermaid } from 'mermaid';

// Paleta de la app (equivalente hex de los tokens de styles.css; mermaid no entiende oklch).
const THEME_VARIABLES = {
  darkMode: true,
  background: '#18181b',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  primaryColor: '#232428',
  primaryBorderColor: '#d08700',
  primaryTextColor: '#f1f1f4',
  secondaryColor: '#232428',
  tertiaryColor: '#18181b',
  lineColor: '#a4a4ab',
  textColor: '#f1f1f4',
  mainBkg: '#232428',
  nodeBorder: '#d08700',
  clusterBkg: '#18181b',
  clusterBorder: '#323238',
  edgeLabelBackground: '#18181b',
  noteBkgColor: '#323238',
  noteTextColor: '#f1f1f4',
  noteBorderColor: '#323238',
  actorBkg: '#232428',
  actorBorder: '#d08700',
  actorTextColor: '#f1f1f4',
  signalColor: '#a4a4ab',
  signalTextColor: '#f1f1f4',
};

/**
 * Renderiza diagramas Mermaid a SVG.
 * La librería es pesada, así que se carga con `import()` la primera vez que un documento
 * incluye un bloque ```mermaid y queda fuera del bundle inicial.
 */
@Injectable({ providedIn: 'root' })
export class MermaidService {
  private mermaid?: Promise<Mermaid>;
  private queue: Promise<unknown> = Promise.resolve();
  private counter = 0;
  private readonly cache = new Map<string, string>();

  /** SVG ya renderizado para este código, si existe (permite pintar sin parpadeo). */
  cached(source: string): string | undefined {
    return this.cache.get(source);
  }

  /** Devuelve el SVG del diagrama o rechaza con el error de sintaxis de Mermaid. */
  render(source: string): Promise<string> {
    const hit = this.cache.get(source);
    if (hit) return Promise.resolve(hit);

    // Mermaid no admite renders concurrentes sobre el mismo documento: se encolan.
    const result = this.queue.then(() => this.renderNow(source));
    this.queue = result.catch(() => undefined);
    return result;
  }

  protected loadMermaid(): Promise<Mermaid> {
    return import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: THEME_VARIABLES,
      });
      return mermaid;
    });
  }

  private async renderNow(source: string): Promise<string> {
    this.mermaid ??= this.loadMermaid();
    const mermaid = await this.mermaid;
    const id = `mermaid-diagram-${++this.counter}`;
    try {
      const { svg } = await mermaid.render(id, source);
      this.cache.set(source, svg);
      return svg;
    } finally {
      // Ante un error, mermaid deja un nodo temporal huérfano en el <body>.
      document.getElementById(`d${id}`)?.remove();
    }
  }
}
