import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { MermaidService } from '../services/mermaid.service';

/**
 * Convierte en diagramas los bloques ```mermaid de un contenedor cuyo HTML sale de `parseMarkdown`
 * (los marca con la clase `mermaid-block`). Se enlaza al mismo HTML que `[innerHTML]` para
 * re-ejecutarse cada vez que el contenido cambia.
 *
 * Mientras el diagrama se carga, o si su sintaxis es inválida, el bloque conserva el código fuente.
 */
@Directive({ selector: '[appMermaid]' })
export class MermaidDirective {
  /** HTML renderizado; solo se usa para detectar cambios de contenido. */
  readonly appMermaid = input.required<string>();
  /** Espera antes de renderizar diagramas nuevos (para no renderizar a cada tecla en el editor). */
  readonly appMermaidDebounce = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly mermaid = inject(MermaidService);

  constructor() {
    afterRenderEffect((onCleanup) => {
      this.appMermaid();
      const debounce = this.appMermaidDebounce();

      const pending: { block: HTMLElement; source: string }[] = [];
      for (const block of this.host.querySelectorAll<HTMLElement>('.mermaid-block')) {
        const source = block.querySelector('pre code')?.textContent;
        if (!source) continue;
        const svg = this.mermaid.cached(source);
        if (svg) showDiagram(block, svg);
        else pending.push({ block, source });
      }
      if (!pending.length) return;

      let cancelled = false;
      const timer = setTimeout(() => {
        for (const { block, source } of pending) {
          this.mermaid.render(source).then(
            (svg) => !cancelled && showDiagram(block, svg),
            (err: unknown) => !cancelled && showError(block, err),
          );
        }
      }, debounce);
      onCleanup(() => {
        cancelled = true;
        clearTimeout(timer);
      });
    });
  }
}

function showDiagram(block: HTMLElement, svg: string) {
  const figure = document.createElement('div');
  figure.className = 'p-4 overflow-x-auto flex justify-center';
  figure.setAttribute('role', 'img');
  figure.setAttribute('aria-label', 'Diagrama Mermaid');
  // El SVG lo genera mermaid con securityLevel 'strict' (saneado con DOMPurify).
  figure.innerHTML = svg;
  block.querySelector('pre')?.replaceWith(figure);
}

function showError(block: HTMLElement, err: unknown) {
  if (block.querySelector('.mermaid-error')) return;
  const message = document.createElement('div');
  message.className =
    'mermaid-error px-4 py-2 border-b border-surface-border text-danger font-mono whitespace-pre-wrap';
  message.textContent = `Diagrama inválido: ${err instanceof Error ? err.message : String(err)}`;
  block.querySelector('pre')?.before(message);
}
