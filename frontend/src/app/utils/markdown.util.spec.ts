import { parseMarkdown } from './markdown.util';

/** Parsea y devuelve un contenedor DOM para hacer aserciones estructurales. */
function render(markdown: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = parseMarkdown(markdown);
  return el;
}

describe('parseMarkdown', () => {
  describe('empty input', () => {
    it.each(['', '   ', '\n\n'])('should render a placeholder for %j', (input) => {
      expect(render(input).textContent).toBe('Sin contenido aún...');
    });
  });

  describe('sanitization', () => {
    it('should escape raw HTML in text', () => {
      const el = render('<script>alert(1)</script> <img src=x onerror=alert(1)>');
      expect(el.querySelector('script')).toBeNull();
      expect(el.querySelector('img')).toBeNull();
      expect(el.textContent).toContain('<script>alert(1)</script>');
    });

    it('should escape HTML inside inline code and code blocks', () => {
      const el = render('`<b>x</b>`\n\n```html\n<div onclick="x">hi</div>\n```');
      expect(el.querySelector('b')).toBeNull();
      expect(el.querySelector('div[onclick]')).toBeNull();
      expect(el.querySelector('pre code')?.textContent).toBe('<div onclick="x">hi</div>');
    });

    it('should not allow breaking out of a link href with quotes', () => {
      const el = render('[click](x" onmouseover="alert(1))');
      const a = el.querySelector('a');
      expect(a?.getAttribute('onmouseover')).toBeNull();
    });
  });

  describe('blocks', () => {
    it.each([1, 2, 3, 4, 5, 6])('should render h%i headings', (level) => {
      const el = render(`${'#'.repeat(level)} Título`);
      expect(el.querySelector(`h${level}`)?.textContent).toBe('Título');
    });

    it('should not treat #text without space as a heading', () => {
      expect(render('#hashtag').querySelector('h1')).toBeNull();
    });

    it('should join consecutive lines into one paragraph with <br>', () => {
      const el = render('línea 1\nlínea 2\n\notro párrafo');
      const paragraphs = el.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0].querySelectorAll('br').length).toBe(1);
    });

    it.each(['---', '***', '___'])('should render %s as a horizontal rule', (hr) => {
      expect(render(`a\n\n${hr}\n\nb`).querySelector('hr')).toBeTruthy();
    });

    it('should group consecutive quote lines into one blockquote', () => {
      const el = render('> uno\n> dos\n\nfuera');
      const quotes = el.querySelectorAll('blockquote');
      expect(quotes.length).toBe(1);
      expect(quotes[0].textContent).toContain('uno');
      expect(quotes[0].textContent).toContain('dos');
      expect(quotes[0].textContent).not.toContain('fuera');
    });

    it('should render unordered lists with -, * and +', () => {
      const items = render('- a\n* b\n+ c').querySelectorAll('ul > li');
      expect([...items].map((li) => li.textContent)).toEqual(['a', 'b', 'c']);
    });

    it('should render ordered lists', () => {
      const items = render('1. uno\n2. dos').querySelectorAll('ol > li');
      expect([...items].map((li) => li.textContent)).toEqual(['uno', 'dos']);
    });

    it('should render task list checkboxes', () => {
      const el = render('- [ ] pendiente\n- [x] hecha\n- [X] también');
      const boxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      expect(boxes.length).toBe(3);
      expect([...boxes].map((b) => b.checked)).toEqual([false, true, true]);
      expect([...boxes].every((b) => b.disabled)).toBe(true);
      expect(el.querySelector('.line-through')?.textContent).toBe('hecha');
    });

    it('should render tables with header and body', () => {
      const el = render('| Nombre | Monto |\n|---|:---:|\n| Luz | 100 |\n| Agua | 50 |');
      expect([...el.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Nombre', 'Monto']);
      expect(el.querySelectorAll('tbody tr').length).toBe(2);
      expect(el.querySelector('tbody td')?.textContent).toBe('Luz');
    });

    it('should not render a table without a separator row', () => {
      expect(render('| a | b |\n| c | d |').querySelector('table')).toBeNull();
    });

    it('should render fenced code blocks with language label', () => {
      const el = render('```go\nfunc main() {}\n```');
      expect(el.querySelector('pre code')?.textContent).toBe('func main() {}');
      expect(el.textContent).toContain('go');
    });

    it('should not apply inline formatting inside code blocks', () => {
      const el = render('```\n**no negrita**\n# no título\n```');
      expect(el.querySelector('strong')).toBeNull();
      expect(el.querySelector('h1')).toBeNull();
      expect(el.querySelector('pre code')?.textContent).toBe('**no negrita**\n# no título');
    });

    it('should keep block order', () => {
      const el = render('# T\n\ntexto\n\n- item');
      expect([...el.children].map((c) => c.tagName)).toEqual(['H1', 'P', 'UL']);
    });
  });

  describe('inline', () => {
    it('should render bold with ** and __', () => {
      const strongs = render('**a** y __b__').querySelectorAll('strong');
      expect([...strongs].map((s) => s.textContent)).toEqual(['a', 'b']);
    });

    it('should render italic with * and _', () => {
      const ems = render('*a* y _b_').querySelectorAll('em');
      expect([...ems].map((e) => e.textContent)).toEqual(['a', 'b']);
    });

    it('should render strikethrough', () => {
      expect(render('~~viejo~~').querySelector('del')?.textContent).toBe('viejo');
    });

    it('should render inline code without formatting its contents', () => {
      const el = render('usa `**x**` aquí');
      expect(el.querySelector('code')?.textContent).toBe('**x**');
      expect(el.querySelector('strong')).toBeNull();
    });

    it('should render links opening in a new tab safely', () => {
      const a = render('[Cassandra](https://example.com)').querySelector('a');
      expect(a?.getAttribute('href')).toBe('https://example.com');
      expect(a?.getAttribute('target')).toBe('_blank');
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a?.textContent).toBe('Cassandra');
    });

    it('should render images (not links) for ![alt](src)', () => {
      const el = render('![logo](/cassandra.svg)');
      const img = el.querySelector('img');
      expect(img?.getAttribute('src')).toBe('/cassandra.svg');
      expect(img?.getAttribute('alt')).toBe('logo');
      expect(el.querySelector('a')).toBeNull();
    });

    it('should apply inline formatting inside headings, lists and table cells', () => {
      const el = render('# **H**\n\n- *i*\n\n| ~~c~~ |\n|---|\n| x |');
      expect(el.querySelector('h1 strong')).toBeTruthy();
      expect(el.querySelector('li em')).toBeTruthy();
      expect(el.querySelector('th del')).toBeTruthy();
    });
  });
});
