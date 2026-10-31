import { computed, DestroyRef, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import {
  APPEARANCE_STORAGE_KEY, COLOR_MODES, DEFAULT_APPEARANCE, PALETTES,
  parseAppearance, ResolvedColorMode,
} from '../models/appearance.model';

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly destroyRef = inject(DestroyRef);
  private readonly media = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly preference = signal(this.readStored());
  private readonly systemDark = signal(this.media?.matches ?? true);

  readonly palette = computed(() => this.preference().palette);
  readonly mode = computed(() => this.preference().mode);
  readonly resolvedMode = computed<ResolvedColorMode>(() => {
    const mode = this.mode();
    return mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
  });
  readonly themeKey = computed(() => `${this.palette()}:${this.resolvedMode()}`);
  readonly stored = signal(true);

  constructor() {
    const onMediaChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY || event.key === null) {
        this.preference.set(event.key === null ? DEFAULT_APPEARANCE : parseAppearance(event.newValue));
      }
    };
    this.media?.addEventListener('change', onMediaChange);
    this.window?.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => {
      this.media?.removeEventListener('change', onMediaChange);
      this.window?.removeEventListener('storage', onStorage);
    });
    effect(() => {
      const root = this.document.documentElement;
      root.dataset['palette'] = this.palette();
      root.dataset['mode'] = this.resolvedMode();
      root.style.colorScheme = this.resolvedMode();
      this.document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', this.resolvedMode());
      const browserColor = this.window?.getComputedStyle(root).getPropertyValue('--theme-browser-background').trim();
      if (browserColor) this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', browserColor);
    });
  }

  setPalette(value: string): void {
    const palette = PALETTES.find(palette => palette.value === value)?.value;
    if (!palette) return;
    this.preference.update(current => ({ ...current, palette }));
    this.save();
  }

  setMode(value: string): void {
    const mode = COLOR_MODES.find(mode => mode.value === value)?.value;
    if (!mode) return;
    this.preference.update(current => ({ ...current, mode }));
    this.save();
  }

  private readStored() {
    try {
      return parseAppearance(this.window?.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? null);
    } catch {
      return DEFAULT_APPEARANCE;
    }
  }

  private save(): void {
    try {
      this.window?.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(this.preference()));
      this.stored.set(true);
    } catch {
      this.stored.set(false);
    }
  }
}
