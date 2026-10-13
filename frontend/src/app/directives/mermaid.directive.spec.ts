import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MermaidDirective } from './mermaid.directive';
import { MermaidService } from '../services/mermaid.service';
import { parseMarkdown } from '../utils/markdown.util';

@Component({
  imports: [MermaidDirective],
  template: `<div [innerHTML]="html()" [appMermaid]="html()" [appMermaidDebounce]="debounce()"></div>`,
})
class Host {
  readonly html = signal('');
  readonly debounce = signal(0);
}

const doc = (source: string) => parseMarkdown('```mermaid\n' + source + '\n```');

describe('MermaidDirective', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;
  let mermaid: { cached: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn> };

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  beforeEach(() => {
    mermaid = { cached: vi.fn().mockReturnValue(undefined), render: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: MermaidService, useValue: mermaid }],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should replace the source with the rendered diagram', async () => {
    mermaid.render.mockResolvedValue('<svg id="diagrama"></svg>');
    host.html.set(doc('graph TD\n  A --> B'));
    fixture.detectChanges();
    await settle();

    expect(mermaid.render).toHaveBeenCalledWith('graph TD\n  A --> B');
    expect(el.querySelector('[role="img"] svg#diagrama')).toBeTruthy();
    expect(el.querySelector('.mermaid-block pre')).toBeNull();
  });

  it('should keep the source and show the error when the diagram is invalid', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error on line 1'));
    host.html.set(doc('graph ???'));
    fixture.detectChanges();
    await settle();

    expect(el.querySelector('.mermaid-error')?.textContent).toContain('Parse error on line 1');
    expect(el.querySelector('.mermaid-block pre code')?.textContent).toBe('graph ???');
  });

  it('should paint cached diagrams synchronously without rendering again', async () => {
    mermaid.cached.mockReturnValue('<svg id="cacheado"></svg>');
    host.html.set(doc('graph TD'));
    fixture.detectChanges();

    expect(el.querySelector('svg#cacheado')).toBeTruthy();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it('should ignore non-mermaid code blocks', async () => {
    host.html.set(parseMarkdown('```go\nfunc main() {}\n```'));
    fixture.detectChanges();
    await settle();

    expect(mermaid.render).not.toHaveBeenCalled();
    expect(el.querySelector('pre code')?.textContent).toBe('func main() {}');
  });

  it('should debounce renders and drop the stale one when the content changes', async () => {
    vi.useFakeTimers();
    try {
      mermaid.render.mockImplementation(async (src: string) => `<svg id="${src}"></svg>`);
      host.debounce.set(300);
      host.html.set(doc('a'));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(100);
      host.html.set(doc('b'));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(300);

      expect(mermaid.render).toHaveBeenCalledTimes(1);
      expect(mermaid.render).toHaveBeenCalledWith('b');
    } finally {
      vi.useRealTimers();
    }
  });
});
