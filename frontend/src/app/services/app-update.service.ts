import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { isNewerVersion } from '../utils/version.util';
import { APP_PLATFORM } from './app-platform';
import { APK_UPDATER, ApkDownloadStatus } from './apk-updater';
import { ToastService } from './toast.service';

export { APP_PLATFORM, type AppPlatform } from './app-platform';

interface GithubRelease {
  tag_name: string;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

export type UpdateCheckResult =
  | { status: 'up-to-date'; current: string }
  | { status: 'available'; current: string; latest: string; downloadUrl: string }
  | { status: 'error' };

export const APK_ASSET_NAME = 'cassandra.apk';

@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private readonly platform = inject(APP_PLATFORM);
  private readonly document = inject(DOCUMENT);
  private readonly updater = inject(APK_UPDATER);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private pollTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  // HttpBackend directo: sin el interceptor de auth, que añade withCredentials
  // (no deben viajar cookies a GitHub y CORS lo rechazaría).
  private readonly http = new HttpClient(inject(HttpBackend));

  readonly isNative = this.platform.isNative();
  readonly currentVersion = signal<string | null>(null);
  readonly checking = signal(false);
  readonly download = signal<ApkDownloadStatus>({ status: 'idle' });
  readonly startingDownload = signal(false);
  readonly installing = signal(false);
  readonly downloading = computed(() => this.startingDownload() ||
    this.download().status === 'downloading' || this.download().status === 'paused');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.pollTimer);
    });
    if (this.isNative) void this.refreshDownload();
  }

  async loadCurrentVersion(): Promise<void> {
    if (!this.isNative || this.currentVersion()) return;
    try {
      this.currentVersion.set(await this.platform.getVersion());
    } catch {
      this.currentVersion.set(null);
    }
  }

  /** Compara la versión instalada con la última release de GitHub. */
  async checkForUpdate(): Promise<UpdateCheckResult> {
    this.checking.set(true);
    try {
      await this.loadCurrentVersion();
      const current = this.currentVersion();
      const release = await firstValueFrom(this.http.get<GithubRelease>(environment.releasesApiUrl));
      if (!current) return { status: 'error' };

      if (!isNewerVersion(release.tag_name, current)) {
        return { status: 'up-to-date', current };
      }
      const apk = release.assets.find((a) => a.name === APK_ASSET_NAME);
      return {
        status: 'available',
        current,
        latest: release.tag_name,
        // Si la release aún no tiene el APK, se abre la página de la release.
        downloadUrl: apk?.browser_download_url ?? release.html_url,
      };
    } catch {
      return { status: 'error' };
    } finally {
      this.checking.set(false);
    }
  }

  /** En Android el APK se descarga con DownloadManager; la web conserva la navegación. */
  openDownload(url: string): void {
    if (!this.isNative || !new URL(url).pathname.endsWith(`/${APK_ASSET_NAME}`)) {
      this.document.location.assign(url);
      return;
    }
    if (!this.downloading()) void this.startNativeDownload(url);
  }

  private async startNativeDownload(url: string): Promise<void> {
    this.startingDownload.set(true);
    clearTimeout(this.pollTimer);
    try {
      const status = await this.updater.startDownload({ url });
      if (this.destroyed) return;
      this.updateDownload(status);
      this.toast.info('Android está descargando la actualización. Puedes seguir usando Cassandra.');
    } catch {
      this.updateDownload({ status: 'failed', error: 'No se pudo iniciar la descarga. Revisa tu conexión y vuelve a intentarlo.' });
    } finally {
      this.startingDownload.set(false);
    }
  }

  private async refreshDownload(): Promise<void> {
    try {
      const status = await this.updater.getDownloadStatus();
      if (!this.destroyed && !this.startingDownload()) this.updateDownload(status);
    } catch {
      if (!this.destroyed && this.downloading()) {
        this.updateDownload({ status: 'failed', error: 'No se pudo consultar la descarga. Vuelve a buscar actualizaciones.' });
      }
    }
  }

  private updateDownload(status: ApkDownloadStatus): void {
    if (this.destroyed) return;
    const previous = this.download().status;
    this.download.set(status);
    clearTimeout(this.pollTimer);
    if (status.status === 'downloading' || status.status === 'paused') {
      this.pollTimer = setTimeout(() => void this.refreshDownload(), 1000);
    } else if (status.status === 'ready' && previous !== 'ready') {
      this.toast.success('El APK está listo. Confirma la instalación para actualizar Cassandra.', {
        duration: 0,
        action: { label: 'Instalar actualización', onClick: () => void this.installUpdate() },
      });
    } else if (status.status === 'failed' && previous !== 'failed') {
      this.toast.error(status.error ?? 'No se pudo descargar la actualización.', { duration: 0 });
    }
  }

  async installUpdate(): Promise<void> {
    if (this.installing() || this.download().status !== 'ready') return;
    this.installing.set(true);
    try {
      const result = await this.updater.install();
      if (result.permissionRequired) {
        this.toast.info('Activa “Permitir desde esta fuente” para Cassandra en Android. Al volver, pulsa “Instalar actualización”.', {
          duration: 0,
          action: { label: 'Instalar actualización', onClick: () => void this.installUpdate() },
        });
      }
    } catch {
      this.toast.error('No se pudo abrir el instalador. Comprueba que el APK siga disponible y vuelve a intentarlo.');
      await this.refreshDownload();
    } finally {
      this.installing.set(false);
    }
  }
}
