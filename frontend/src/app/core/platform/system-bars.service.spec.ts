import { TestBed } from '@angular/core/testing';
import { SystemBarsStyle } from '@capacitor/core';
import { AppearanceService } from '../../shared/services/appearance.service';
import { APP_PLATFORM } from './app-platform';
import { SYSTEM_BARS, SystemBarsService } from './system-bars.service';

describe('SystemBarsService', () => {
  let setStyle: ReturnType<typeof vi.fn>;
  let setBackgroundColor: ReturnType<typeof vi.fn>;

  function setup(isNative: boolean) {
    setStyle = vi.fn().mockResolvedValue(undefined);
    setBackgroundColor = vi.fn().mockResolvedValue(undefined);
    document.documentElement.style.setProperty('--theme-browser-background', '#123456');
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_PLATFORM, useValue: { isNative: () => isNative, getVersion: vi.fn() } },
        { provide: SYSTEM_BARS, useValue: { setStyle, setBackgroundColor } },
      ],
    });
    const appearance = TestBed.inject(AppearanceService);
    TestBed.inject(SystemBarsService);
    TestBed.tick();
    return appearance;
  }

  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--theme-browser-background');
  });

  it('usa iconos claros en modo oscuro', () => {
    const appearance = setup(true);
    appearance.setMode('dark');
    TestBed.tick();

    expect(setStyle).toHaveBeenLastCalledWith({ style: SystemBarsStyle.Dark });
  });

  it('usa iconos oscuros en modo claro', () => {
    const appearance = setup(true);
    appearance.setMode('light');
    TestBed.tick();

    expect(setStyle).toHaveBeenLastCalledWith({ style: SystemBarsStyle.Light });
  });

  it('pinta las barras con el fondo de la paleta', () => {
    setup(true);

    expect(setBackgroundColor).toHaveBeenLastCalledWith({ color: '#123456' });
  });

  it('no hace nada fuera de la app nativa', () => {
    const appearance = setup(false);
    appearance.setMode('light');
    TestBed.tick();

    expect(setStyle).not.toHaveBeenCalled();
    expect(setBackgroundColor).not.toHaveBeenCalled();
  });
});
