import { Injectable } from '@angular/core';
import type { Mermaid } from 'mermaid';

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
  private cacheTheme = '';
  private activeTheme = '';

  /** SVG ya renderizado para este código, si existe (permite pintar sin parpadeo). */
  cached(source: string): string | undefined {
    this.prepareCache(JSON.stringify(this.themeVariables()));
    return this.cache.get(source);
  }

  /** Devuelve el SVG del diagrama o rechaza con el error de sintaxis de Mermaid. */
  render(source: string): Promise<string> {
    const hit = this.cached(source);
    if (hit) return Promise.resolve(hit);

    // Mermaid no admite renders concurrentes sobre el mismo documento: se encolan.
    const result = this.queue.then(() => this.renderNow(source));
    this.queue = result.catch(() => undefined);
    return result;
  }

  protected loadMermaid(): Promise<Mermaid> {
    return import('mermaid').then(({ default: mermaid }) => mermaid);
  }

  private themeVariables() {
    // Mermaid recibe los valores resueltos, ya que no admite variables CSS ni oklch.
    const styles = getComputedStyle(document.documentElement);
    const color = (role: string) => styles.getPropertyValue(`--theme-diagram-${role}`).trim();
    const background = color('background');
    const surface = color('surface');
    const primary = color('primary');
    const text = color('text');
    const muted = color('muted');
    const border = color('border');

    return {
      darkMode: styles.getPropertyValue('--theme-color-scheme').trim() === 'dark',
      fontFamily: styles.getPropertyValue('--font-sans').trim(),
      background,
      primaryColor: surface,
      primaryBorderColor: primary,
      primaryTextColor: text,
      secondaryColor: surface,
      tertiaryColor: background,
      lineColor: muted,
      textColor: text,
      mainBkg: surface,
      nodeBorder: primary,
      clusterBkg: background,
      clusterBorder: border,
      edgeLabelBackground: background,
      noteBkgColor: border,
      noteTextColor: text,
      noteBorderColor: border,
      actorBkg: surface,
      actorBorder: primary,
      actorTextColor: text,
      signalColor: muted,
      signalTextColor: text,
    };
  }

  private async renderNow(source: string): Promise<string> {
    this.mermaid ??= this.loadMermaid();
    const mermaid = await this.mermaid;
    const variables = this.themeVariables();
    const theme = JSON.stringify(variables);
    this.prepareCache(theme);
    if (theme !== this.activeTheme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: variables,
      });
      this.activeTheme = theme;
    }
    const id = `mermaid-diagram-${++this.counter}`;
    try {
      const { svg } = await mermaid.render(id, source);
      if (theme === JSON.stringify(this.themeVariables())) this.cache.set(source, svg);
      return svg;
    } finally {
      // Ante un error, mermaid deja un nodo temporal huérfano en el <body>.
      document.getElementById(`d${id}`)?.remove();
    }
  }

  private prepareCache(theme: string): void {
    if (theme === this.cacheTheme) return;
    this.cache.clear();
    this.cacheTheme = theme;
  }
}
