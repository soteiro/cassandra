import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_PLATFORM } from './app-platform';

export const SERVER_STORAGE_KEY = 'cassandra.server';

export type ConnectResult = { ok: true; version: string } | { ok: false; error: string };

/**
 * Normaliza lo que escribe el usuario a la URL base del servidor:
 * "mi.dominio.com/api/" → "https://mi.dominio.com". Devuelve null si no es válida.
 */
export function normalizeServerUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${url.protocol}//${url.host}${path}`;
}

/**
 * URL de la API. La web usa la del entorno (mismo origen que el backend). La app
 * Android no trae ningún servidor de fábrica: cada persona conecta el suyo y se
 * guarda en el dispositivo.
 */
@Injectable({
  providedIn: 'root',
})
export class ServerConfigService {
  private readonly platform = inject(APP_PLATFORM);
  // Sin interceptores: la verificación no debe enviar cookies ni disparar el refresh.
  private readonly http = new HttpClient(inject(HttpBackend));

  readonly isNative = this.platform.isNative();
  private readonly server = signal<string | null>(this.isNative ? readStored() : null);

  /** URL base del servidor configurado en la app (null en la web o sin configurar). */
  readonly serverUrl = this.server.asReadonly();
  readonly isConfigured = computed(() => !this.isNative || this.server() !== null);
  readonly apiUrl = computed(() => {
    if (!this.isNative) return environment.apiUrl;
    const server = this.server();
    return server ? `${server}/api` : '';
  });

  /** Verifica que la URL sea un servidor Cassandra (GET /api/version) y la guarda. */
  async connect(input: string): Promise<ConnectResult> {
    const server = normalizeServerUrl(input);
    if (!server) {
      return { ok: false, error: 'Escribe una dirección válida, p. ej. cassandra.midominio.com' };
    }
    if (server.startsWith('http://')) {
      return { ok: false, error: 'El servidor debe usar https://' };
    }

    let version: unknown;
    try {
      const body = await firstValueFrom(
        this.http.get<{ version?: unknown }>(`${server}/api/version`).pipe(timeout(10_000)),
      );
      version = body?.version;
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor. Revisa la dirección y tu conexión.' };
    }
    if (typeof version !== 'string' || !version) {
      return { ok: false, error: 'La dirección responde, pero no es un servidor Cassandra.' };
    }

    try {
      localStorage.setItem(SERVER_STORAGE_KEY, server);
    } catch {
      // Sin almacenamiento la conexión dura solo esta sesión.
    }
    this.server.set(server);
    return { ok: true, version };
  }

  /** Olvida el servidor configurado (la app volverá a pedirlo). */
  disconnect(): void {
    try {
      localStorage.removeItem(SERVER_STORAGE_KEY);
    } catch {
      // ignorar
    }
    this.server.set(null);
  }
}

function readStored(): string | null {
  try {
    return normalizeServerUrl(localStorage.getItem(SERVER_STORAGE_KEY) ?? '');
  } catch {
    return null;
  }
}
