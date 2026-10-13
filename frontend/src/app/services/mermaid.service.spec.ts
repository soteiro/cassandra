import type { Mermaid } from 'mermaid';
import { TestBed } from '@angular/core/testing';
import { MermaidService } from './mermaid.service';

/** Sustituye la carga de mermaid (pesada y dependiente del layout real del navegador). */
class TestMermaidService extends MermaidService {
  loads = 0;
  readonly mermaidMock = { render: vi.fn() };

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
