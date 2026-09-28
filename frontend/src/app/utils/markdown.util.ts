/**
 * Parser de Markdown ligero y seguro para Cassandra.
 * No requiere dependencias externas y sanitiza el contenido HTML.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseMarkdown(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '<p class="text-text-muted italic">Sin contenido aún...</p>';
  }

  // 1. Extraer y proteger bloques de código cercados (```lang ... ```)
  const codeBlocks: { lang: string; code: string }[] = [];
  let processed = markdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({
      lang: (lang || '').trim(),
      code: escapeHtml(code.replace(/\n$/, '')),
    });
    return `\n\n%%CODEBLOCK_${idx}%%\n\n`;
  });

  // 2. Extraer y proteger código inline (`code`)
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(escapeHtml(code));
    return `%%INLINECODE_${idx}%%`;
  });

  // 3. Sanitizar caracteres HTML en el resto del texto
  // Para evitar que tags escritos por el usuario se ejecuten
  processed = escapeHtml(processed);

  // 4. Procesar bloques línea por línea
  const lines = processed.split(/\r?\n/);
  const outputBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bloque de código guardado
    const codeMatch = trimmed.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (codeMatch) {
      const idx = parseInt(codeMatch[1], 10);
      const { lang, code } = codeBlocks[idx];
      outputBlocks.push(`
        <div class="my-4 rounded-xl border border-surface-border bg-background overflow-hidden text-xs">
          ${
            lang
              ? `<div class="px-3 py-1.5 bg-surface-border/40 text-text-muted font-mono font-medium border-b border-surface-border flex justify-between items-center">
                  <span>${lang}</span>
                </div>`
              : ''
          }
          <pre class="p-4 overflow-x-auto font-mono leading-relaxed text-text-main"><code>${code}</code></pre>
        </div>
      `);
      i++;
      continue;
    }

    // Líneas vacías
    if (!trimmed) {
      i++;
      continue;
    }

    // Regla horizontal (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      outputBlocks.push('<hr class="my-6 border-surface-border" />');
      i++;
      continue;
    }

    // Encabezados (# H1 a ###### H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = parseInline(headingMatch[2]);
      const classes: Record<number, string> = {
        1: 'text-2xl font-bold text-text-main mt-6 mb-3 pb-2 border-b border-surface-border flex items-center gap-2',
        2: 'text-xl font-bold text-text-main mt-5 mb-2.5 pb-1 border-b border-surface-border/60',
        3: 'text-lg font-semibold text-text-main mt-4 mb-2',
        4: 'text-base font-semibold text-text-main mt-3 mb-1.5',
        5: 'text-sm font-semibold text-text-main mt-2 mb-1',
        6: 'text-xs font-semibold text-text-muted uppercase tracking-wider mt-2 mb-1',
      };
      outputBlocks.push(`<h${level} class="${classes[level] || ''}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Blockquotes (> cita)
    if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('&gt;') || lines[i].trim().startsWith('>'))) {
        const cleaned = lines[i].trim().replace(/^(&gt;|>)\s?/, '');
        quoteLines.push(parseInline(cleaned));
        i++;
      }
      outputBlocks.push(`
        <blockquote class="my-3 pl-4 py-2 border-l-4 border-primary/70 bg-surface/60 rounded-r-lg text-text-muted text-sm italic space-y-1">
          ${quoteLines.join('<br />')}
        </blockquote>
      `);
      continue;
    }

    // Tablas Markdown (| col 1 | col 2 | ...)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Verificar si la segunda fila es un separador |---|---|
        const isHeaderSep = /^\|(\s*:?-+:?\s*\|)+$/.test(tableLines[1]);
        if (isHeaderSep) {
          const headerCells = tableLines[0]
            .slice(1, -1)
            .split('|')
            .map((c) => parseInline(c.trim()));
          const bodyRows = tableLines.slice(2).map((row) =>
            row
              .slice(1, -1)
              .split('|')
              .map((c) => parseInline(c.trim()))
          );

          let tableHtml = `
            <div class="my-4 overflow-x-auto rounded-xl border border-surface-border">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-surface-border/30 text-text-main font-semibold border-b border-surface-border">
                    ${headerCells.map((h) => `<th class="px-3 py-2.5">${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-border/50 text-text-muted">
                  ${bodyRows
                    .map(
                      (row) => `
                    <tr class="hover:bg-surface-border/10 transition-colors">
                      ${row.map((cell) => `<td class="px-3 py-2">${cell}</td>`).join('')}
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `;
          outputBlocks.push(tableHtml);
          continue;
        }
      }
    }

    // Listas desordenadas (- item, * item) y Listas de Tareas (- [ ] / - [x])
    if (/^\s*[-*+]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const itemLine = lines[i];
        let content = itemLine.replace(/^\s*[-*+]\s+/, '');

        // Soporte de checkboxes de tareas: - [ ] o - [x]
        if (/^\[ \]\s+/.test(content)) {
          content = `<input type="checkbox" disabled class="mr-2 accent-primary rounded align-middle" /> ${parseInline(
            content.replace(/^\[ \]\s+/, '')
          )}`;
          listItems.push(`<li class="flex items-center list-none -ml-4">${content}</li>`);
        } else if (/^\[x\]\s+/i.test(content)) {
          content = `<input type="checkbox" checked disabled class="mr-2 accent-primary rounded align-middle" /> <span class="line-through text-text-muted">${parseInline(
            content.replace(/^\[x\]\s+/i, '')
          )}</span>`;
          listItems.push(`<li class="flex items-center list-none -ml-4">${content}</li>`);
        } else {
          listItems.push(`<li>${parseInline(content)}</li>`);
        }
        i++;
      }
      outputBlocks.push(`
        <ul class="my-3 pl-6 list-disc space-y-1 text-sm text-text-main">
          ${listItems.join('')}
        </ul>
      `);
      continue;
    }

    // Listas ordenadas (1. item, 2. item)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, '');
        listItems.push(`<li>${parseInline(content)}</li>`);
        i++;
      }
      outputBlocks.push(`
        <ol class="my-3 pl-6 list-decimal space-y-1 text-sm text-text-main">
          ${listItems.join('')}
        </ol>
      `);
      continue;
    }

    // Párrafos normales
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().match(/^%%CODEBLOCK_\d+%%$/) &&
      !lines[i].trim().match(/^(\*{3,}|-{3,}|_{3,})$/) &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith('&gt;') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      paragraphLines.push(parseInline(lines[i].trim()));
      i++;
    }

    if (paragraphLines.length > 0) {
      outputBlocks.push(`
        <p class="my-2.5 text-sm text-text-main leading-relaxed">
          ${paragraphLines.join('<br />')}
        </p>
      `);
    }
  }

  let html = outputBlocks.join('\n');

  // 5. Reinsertar tokens de código inline
  html = html.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => {
    const code = inlineCodes[parseInt(idx, 10)] || '';
    return `<code class="px-1.5 py-0.5 rounded bg-surface-border/50 text-primary font-mono text-xs font-semibold">${code}</code>`;
  });

  return html;
}

/**
 * Parsea formato inline: negrita, cursiva, tachado, enlaces, imágenes.
 */
function parseInline(text: string): string {
  let result = text;

  // Imágenes: ![alt](url)
  result = result.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" class="my-3 max-w-full rounded-xl border border-surface-border shadow-md" loading="lazy" />'
  );

  // Enlaces: [texto](url)
  result = result.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline underline-offset-2 font-medium">$1</a>'
  );

  // Negrita: **texto** o __texto__
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-text-main">$1</strong>');
  result = result.replace(/__(.*?)__/g, '<strong class="font-bold text-text-main">$1</strong>');

  // Tachado: ~~texto~~
  result = result.replace(/~~(.*?)~~/g, '<del class="line-through text-text-muted/70">$1</del>');

  // Cursiva: *texto* o _texto_
  result = result.replace(/(^|[^\*])\*(?!\*)(.*?)\*(?!\*)/g, '$1<em class="italic">$2</em>');
  result = result.replace(/(^|[^_])_(?!_)(.*?)_(?!_)/g, '$1<em class="italic">$2</em>');

  return result;
}
