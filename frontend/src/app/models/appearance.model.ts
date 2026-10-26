export const PALETTES = [
  { value: 'amber', label: 'Ámbar' },
  { value: 'ocean', label: 'Océano' },
  { value: 'forest', label: 'Bosque' },
  { value: 'violet', label: 'Violeta' },
] as const;

export const COLOR_MODES = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Según el sistema' },
] as const;

export type Palette = typeof PALETTES[number]['value'];
export type ColorMode = typeof COLOR_MODES[number]['value'];
export type ResolvedColorMode = Exclude<ColorMode, 'system'>;

export interface Appearance {
  palette: Palette;
  mode: ColorMode;
}

export const APPEARANCE_STORAGE_KEY = 'cassandra.appearance';
export const DEFAULT_APPEARANCE: Appearance = { palette: 'amber', mode: 'dark' };

export function parseAppearance(value: string | null): Appearance {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_APPEARANCE;
    const candidate = parsed as Record<string, unknown>;
    return {
      palette: PALETTES.find(palette => palette.value === candidate['palette'])?.value ?? DEFAULT_APPEARANCE.palette,
      mode: COLOR_MODES.find(mode => mode.value === candidate['mode'])?.value ?? DEFAULT_APPEARANCE.mode,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
