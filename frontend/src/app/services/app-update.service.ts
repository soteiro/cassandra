import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { isNewerVersion } from '../utils/version.util';
import { APP_PLATFORM } from './app-platform';

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
  // HttpBackend directo: sin el interceptor de auth, que añade withCredentials
  // (no deben viajar cookies a GitHub y CORS lo rechazaría).
  private readonly http = new HttpClient(inject(HttpBackend));

  readonly isNative = this.platform.isNative();
  readonly currentVersion = signal<string | null>(null);
  readonly checking = signal(false);

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

  /**
   * Abre la descarga. En Android, Capacitor deriva las URLs externas al navegador
   * del sistema, que descarga el APK y ofrece instalarlo.
   */
  openDownload(url: string): void {
    this.document.location.assign(url);
  }
}
