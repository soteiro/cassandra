import type { Mermaid } from 'mermaid';
import { TestBed } from '@angular/core/testing';
import { MermaidService } from './mermaid.service';

const mermaidModule = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({ svg: '<svg></svg>' })),
}));

vi.mock('mermaid', () => ({ default: mermaidModule }));

/** Sustituye la carga de mermaid (pesada y dependiente del layout real del navegador). */
class TestMermaidService extends MermaidService {
  loads = 0;
  readonly mermaidMock = { initialize: vi.fn(), render: vi.fn() };

  protected override loadMermaid(): Promise<Mermaid> {
    this.loads++;
    return Promise.resolve(this.mermaidMock as unknown as Mermaid);
  }
}

describe('MermaidService', () => {
  let service: TestMermaidService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MermaidService, useClass: TestMermaidService }],
    });
    service = TestBed.inject(MermaidService) as TestMermaidService;
    service.mermaidMock.render.mockImplementation(async (_id: string, src: string) => ({
      svg: `<svg>${src}</svg>`,
    }));
  });

  it('should render a diagram and expose it from the cache', async () => {
    expect(service.cached('graph TD')).toBeUndefined();
    expect(await service.render('graph TD')).toBe('<svg>graph TD</svg>');
    expect(service.cached('graph TD')).toBe('<svg>graph TD</svg>');
  });

  it('should not re-render a source that is already cached', async () => {
    await service.render('graph TD');
    await service.render('graph TD');
    expect(service.mermaidMock.render).toHaveBeenCalledTimes(1);
  });

  it('should load mermaid only once', async () => {
    await Promise.all([service.render('a'), service.render('b')]);
    expect(service.loads).toBe(1);
  });

  it('should reject with the mermaid error, keep working and clean up the leftover node', async () => {
    service.mermaidMock.render.mockImplementationOnce(async (id: string) => {
      const leftover = document.createElement('div');
      leftover.id = `d${id}`;
      document.body.appendChild(leftover);
      throw new Error('Parse error on line 1');
    });

    await expect(service.render('roto')).rejects.toThrow('Parse error on line 1');
    expect(document.querySelector('[id^="dmermaid-diagram-"]')).toBeNull();
    expect(service.cached('roto')).toBeUndefined();
    expect(await service.render('ok')).toBe('<svg>ok</svg>');
  });

  it('should use a distinct id for each render', async () => {
    await service.render('a');
    await service.render('b');
    const ids = service.mermaidMock.render.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('MermaidService CSS palette', () => {
  let palette: HTMLStyleElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    mermaidModule.initialize.mockClear();
    mermaidModule.render.mockClear();
    palette = document.createElement('style');
    palette.textContent = `:root {
      --theme-color-scheme: dark;
      --font-sans: Test Font;
      --theme-diagram-background: #101112;
      --theme-diagram-surface: #202122;
      --theme-diagram-primary: #aabbcc;
      --theme-diagram-text: #eeeeee;
      --theme-diagram-muted: #999999;
      --theme-diagram-border: #303132;
    }`;
    document.head.append(palette);
  });

  afterEach(() => palette.remove());

  it('initializes Mermaid with resolved CSS colors rather than a fixed palette', async () => {
    await TestBed.inject(MermaidService).render('graph TD; A-->B');

    expect(mermaidModule.initialize).toHaveBeenCalledWith(expect.objectContaining({
      themeVariables: expect.objectContaining({
        darkMode: true,
        fontFamily: 'Test Font',
        background: '#101112',
        primaryColor: '#202122',
        primaryBorderColor: '#aabbcc',
        primaryTextColor: '#eeeeee',
        lineColor: '#999999',
        clusterBorder: '#303132',
      }),
    }));
  });

  it('reads the color scheme from CSS when the library is first loaded', async () => {
    palette.textContent = palette.textContent.replace('scheme: dark', 'scheme: light');
    await TestBed.inject(MermaidService).render('graph TD; A-->B');

    expect(mermaidModule.initialize).toHaveBeenCalledWith(expect.objectContaining({
      themeVariables: expect.objectContaining({ darkMode: false }),
    }));
  });

  it('does not reuse diagrams or the previous Mermaid configuration after the palette changes', async () => {
    const service = TestBed.inject(MermaidService);
    await service.render('graph TD; A-->B');
    expect(service.cached('graph TD; A-->B')).toBeDefined();

    palette.textContent = palette.textContent.replace('#aabbcc', '#bbaa77');
    expect(service.cached('graph TD; A-->B')).toBeUndefined();
    await service.render('graph TD; A-->B');

    expect(mermaidModule.render).toHaveBeenCalledTimes(2);
    expect(mermaidModule.initialize).toHaveBeenLastCalledWith(expect.objectContaining({
      themeVariables: expect.objectContaining({ primaryBorderColor: '#bbaa77' }),
    }));
  });
});
