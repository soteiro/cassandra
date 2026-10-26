import { TestBed } from '@angular/core/testing';
import { APPEARANCE_STORAGE_KEY } from '../models/appearance.model';
import { AppearanceService } from './appearance.service';

describe('AppearanceService', () => {
  let mediaChange: (event: { matches: boolean }) => void;
  let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    media = {
      matches: true,
      addEventListener: vi.fn((_event, listener) => { mediaChange = listener; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('preserves the original appearance when there is no saved choice', () => {
    const service = TestBed.inject(AppearanceService);
    TestBed.tick();

    expect(service.palette()).toBe('amber');
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.dataset['palette']).toBe('amber');
    expect(document.documentElement.dataset['mode']).toBe('dark');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
  });

  it('restores a saved palette and mode', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ palette: 'forest', mode: 'light' }));
    const service = TestBed.inject(AppearanceService);
    TestBed.tick();

    expect(service.palette()).toBe('forest');
    expect(service.resolvedMode()).toBe('light');
    expect(document.documentElement.dataset['mode']).toBe('light');
  });

  it.each(['{invalid', 'null', '42', '{"palette":"unknown","mode":"unknown"}'])('ignores invalid saved settings: %s', value => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
    const service = TestBed.inject(AppearanceService);

    expect(service.palette()).toBe('amber');
    expect(service.mode()).toBe('dark');
  });

  it('applies and saves palette and mode independently', () => {
    const service = TestBed.inject(AppearanceService);
    service.setPalette('violet');
    service.setMode('light');
    TestBed.tick();

    expect(document.documentElement.dataset['palette']).toBe('violet');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({ palette: 'violet', mode: 'light' });
    service.setPalette('unknown');
    service.setMode('unknown');
    expect(service.palette()).toBe('violet');
    expect(service.mode()).toBe('light');
  });

  it('reacts to system changes only in system mode', () => {
    const service = TestBed.inject(AppearanceService);
    service.setMode('system');
    mediaChange({ matches: false });
    TestBed.tick();
    expect(service.mode()).toBe('system');
    expect(document.documentElement.dataset['mode']).toBe('light');

    service.setMode('dark');
    mediaChange({ matches: false });
    TestBed.tick();
    expect(document.documentElement.dataset['mode']).toBe('dark');
  });

  it('keeps working when reading or writing local storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const service = TestBed.inject(AppearanceService);
    service.setPalette('ocean');
    TestBed.tick();

    expect(service.palette()).toBe('ocean');
    expect(document.documentElement.dataset['palette']).toBe('ocean');
    expect(service.stored()).toBe(false);
  });

  it('syncs a preference changed or cleared in another tab', () => {
    const service = TestBed.inject(AppearanceService);
    window.dispatchEvent(new StorageEvent('storage', {
      key: APPEARANCE_STORAGE_KEY,
      newValue: JSON.stringify({ palette: 'forest', mode: 'system' }),
    }));
    TestBed.tick();
    expect(service.palette()).toBe('forest');
    expect(service.mode()).toBe('system');

    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(service.palette()).toBe('amber');
    expect(service.mode()).toBe('dark');
  });

  it('removes the system listener when destroyed', () => {
    TestBed.inject(AppearanceService);
    TestBed.resetTestingModule();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', mediaChange);
  });
});
