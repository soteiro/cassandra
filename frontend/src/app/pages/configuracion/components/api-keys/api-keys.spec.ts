import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { APIKey, IssuedAPIKey } from '../../../../models/api-key.model';
import { APIKeyService } from '../../../../services/api-key.service';
import { proyectService } from '../../../../services/proyect.service';
import { ApiKeys } from './api-keys';

const key: APIKey = {
  id: 1, nombre: 'Asistente', prefijo: 'cass_mem_prefijo', scopes: ['memory:read'], proyecto_ids: [12],
  fecha_creacion: '2026-10-18T12:00:00Z', expira_en: null, revocada_en: null, ultimo_uso: null,
};
const issued: IssuedAPIKey = { ...key, token: 'cass_mem_fake_secret_only_for_testing' };

describe('ApiKeys', () => {
  let fixture: ComponentFixture<ApiKeys>;
  let el: HTMLElement;
  let api: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; revoke: ReturnType<typeof vi.fn> };
  const resource = {
    value: signal<{ id: number; nombre: string }[]>([]),
    isLoading: signal(false), error: signal<unknown>(undefined), reload: vi.fn(),
  };
  const render = async () => { await fixture.whenStable(); fixture.detectChanges(); };
  const button = (text: string) => Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === text)!;
  const fill = async () => {
    const name = el.querySelector<HTMLInputElement>('#key-name')!;
    name.value = '  Mi asistente  ';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await render();
  };
  const select = (id: string, value: string) => {
    const input = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('change'));
  };

  beforeEach(async () => {
    api = { list: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of(issued)), revoke: vi.fn().mockReturnValue(of(undefined)) };
    resource.value.set([{ id: 12, nombre: 'Cassandra' }]);
    resource.isLoading.set(false);
    resource.error.set(undefined);
    resource.reload.mockClear();
    await TestBed.configureTestingModule({
      imports: [ApiKeys], providers: [provideRouter([]),
        { provide: APIKeyService, useValue: api }, { provide: proyectService, useValue: { proyectResource: resource } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('requires a name and a project before making a request', async () => {
    expect(el.querySelector('#name-error')).toBeNull();
    button('Generar clave').click();
    await render();
    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Escribe un nombre');
    expect(el.textContent).toContain('Selecciona al menos un proyecto');
  });

  it('generates a bounded, read-only key by default and shows its secret once', async () => {
    await fill();
    const before = Date.now();
    button('Generar clave').click();
    await render();
    const request = api.create.mock.calls[0][0];
    expect(request).toMatchObject({ nombre: 'Mi asistente', scopes: ['memory:read'], proyecto_ids: [12] });
    expect(new Date(request.expira_en).getTime()).toBeGreaterThanOrEqual(before + 90 * 86_400_000);
    const input = el.querySelector<HTMLInputElement>('#issued-key')!;
    expect(input.value).toBe(issued.token);
    expect(document.activeElement).toBe(input);
    expect(el.textContent).toContain('cass_mem_prefijo…');
    button('Ya la guardé').click();
    await render();
    expect(el.querySelector('#issued-key')).toBeNull();
    expect(el.innerHTML).not.toContain(issued.token);
    expect(document.activeElement).toBe(el.querySelector('#key-name'));
  });

  it('supports write permission and no expiration, without submitting twice', async () => {
    const response = new Subject<IssuedAPIKey>();
    api.create.mockReturnValue(response);
    await fill();
    select('key-access', 'write');
    select('key-expiry', 'never');
    button('Generar clave').click();
    await render();
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(api.create).toHaveBeenCalledExactlyOnceWith({ nombre: 'Mi asistente', scopes: ['memory:read', 'memory:write'], proyecto_ids: [12] });
    expect(button('Generando…').disabled).toBe(true);
    response.next(issued);
    response.complete();
    await render();
    expect(el.querySelector('#issued-key')).not.toBeNull();
  });

  it('preserves the form after an API error so the user can retry', async () => {
    api.create.mockReturnValue(throwError(() => ({ error: 'Proyecto no autorizado' })));
    await fill();
    button('Generar clave').click();
    await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Proyecto no autorizado');
    expect(el.querySelector<HTMLInputElement>('#key-name')?.value).toBe('  Mi asistente  ');
    expect(el.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    api.create.mockReturnValue(of(issued));
    button('Generar clave').click();
    await render();
    expect(el.querySelector<HTMLInputElement>('#issued-key')?.value).toBe(issued.token);
  });

  it('can issue a tasks-only key without granting access to memory', async () => {
    await fill();
    select('key-access', 'none');
    select('key-tasks', 'create');
    select('key-expiry', 'never');
    button('Generar clave').click();
    await render();
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Mi asistente', scopes: ['tasks:read', 'tasks:create'], proyecto_ids: [12],
    });
  });

  it('keeps task access read-only when combining it with memory permissions', async () => {
    await fill();
    select('key-access', 'write');
    select('key-tasks', 'read');
    button('Generar clave').click();
    await render();
    expect(api.create.mock.calls[0][0].scopes).toEqual(['memory:read', 'memory:write', 'tasks:read']);
  });

  it('requires at least one permission and preserves the selected projects', async () => {
    await fill();
    select('key-access', 'none');
    button('Generar clave').click();
    await render();
    expect(api.create).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Selecciona al menos un permiso');
    expect(el.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  });

  it('shows the actual permissions for tasks-only and combined keys', async () => {
    fixture.destroy();
    api.list.mockReturnValue(of([
      { ...key, scopes: ['tasks:create'] },
      { ...key, id: 2, scopes: ['memory:read', 'memory:write', 'tasks:read', 'tasks:create'] },
    ]));
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
    const permissions = Array.from(el.querySelectorAll('li dl')).map(node => node.textContent);
    expect(permissions[0]).toContain('Crear tareas');
    expect(permissions[0]).not.toContain('Leer memoria');
    expect(permissions[0]).not.toContain('Leer tareas');
    expect(permissions[1]).toContain('Leer memoria, Guardar memoria, Leer tareas, Crear tareas');
  });

  it('copies the complete secret and confirms only after clipboard succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await fill();
    button('Generar clave').click();
    await render();
    button('Copiar clave').click();
    await render();
    expect(writeText).toHaveBeenCalledWith(issued.token);
    expect(el.textContent).toContain('Clave copiada.');
  });

  it.each([false, true])('offers manual selection when clipboard is unavailable or denied (%s)', async denied => {
    vi.stubGlobal('navigator', denied ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } } : {});
    await fill();
    button('Generar clave').click();
    await render();
    button('Copiar clave').click();
    await render();
    expect(el.textContent).toContain('cópiala manualmente');
    expect(el.textContent).not.toContain('Clave copiada.');
    const input = el.querySelector<HTMLInputElement>('#issued-key')!;
    expect(document.activeElement).toBe(input);
    expect(input.selectionEnd).toBe(issued.token.length);
  });

  it('never restores a secret from the metadata list on a new visit', async () => {
    fixture.destroy();
    api.list.mockReturnValue(of([key, { ...key, id: 2, revocada_en: '2026-10-18T12:00:00Z' }, { ...key, id: 3, expira_en: '2020-01-01T00:00:00Z' }]));
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
    expect(el.textContent).toContain('Activa');
    expect(el.textContent).toContain('Revocada');
    expect(el.textContent).toContain('Vencida');
    expect(el.textContent).toContain('Cassandra');
    expect(el.querySelector('#issued-key')).toBeNull();
    expect(el.innerHTML).not.toContain(issued.token);
  });

  it('requires confirmation to revoke and restores focus on cancel', async () => {
    fixture.destroy();
    api.list.mockReturnValue(of([key]));
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
    const trigger = button('Revocar');
    trigger.click();
    await render();
    expect(api.revoke).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button('Sí, revocar'));
    button('Cancelar').click();
    await render();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await render();
    button('Sí, revocar').click();
    await render();
    expect(api.revoke).toHaveBeenCalledWith(1);
    expect(el.textContent).toContain('Revocada');
    expect(el.querySelector('[aria-label="Revocar clave Asistente"]')).toBeNull();
    expect(el.textContent).toContain('Clave «Asistente» revocada.');
  });

  it('keeps the key active and offers retry if revocation fails', async () => {
    fixture.destroy();
    api.list.mockReturnValue(of([key]));
    api.revoke.mockReturnValue(throwError(() => ({ error: 'Sin conexión' })));
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
    button('Revocar').click();
    await render();
    button('Sí, revocar').click();
    await render();
    expect(el.textContent).toContain('Sin conexión');
    expect(el.textContent).toContain('Activa');
    expect(button('Sí, revocar').disabled).toBe(false);
  });

  it('handles project load failures and an empty project list', async () => {
    resource.error.set(new Error('offline'));
    await render();
    expect(button('Generar clave').disabled).toBe(true);
    button('Reintentar proyectos').click();
    expect(resource.reload).toHaveBeenCalledOnce();
    resource.error.set(undefined);
    resource.value.set([]);
    await render();
    expect(el.querySelector('a[href="/proyectos"]')).not.toBeNull();
    expect(button('Generar clave').disabled).toBe(true);
  });

  it('lets the user retry a failed metadata load', async () => {
    fixture.destroy();
    api.list.mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValue(of([key]));
    fixture = TestBed.createComponent(ApiKeys);
    el = fixture.nativeElement;
    await render();
    button('Reintentar claves').click();
    await render();
    expect(el.textContent).toContain('Asistente');
    expect(el.textContent).not.toContain('No se pudieron cargar las claves');
  });
});
