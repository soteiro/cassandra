import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';
import { LoadingDirective } from '../directives/loading.directive';

@Component({
  imports: [LoadingDirective],
  template: '<section [appLoading]="busy()" loadingLabel="Cargando proyectos…"></section>',
})
class LoadingHost {
  readonly busy = signal(true);
}

describe('LoadingService', () => {
  it('keeps the indicator active until navigation and every visible view finish', () => {
    const loading = TestBed.inject(LoadingService);
    loading.startNavigation(1);
    const finishProject = loading.startView('Cargando proyecto…');
    const finishTasks = loading.startView('Cargando tareas…');
    expect(loading.label()).toBe('Abriendo pantalla…');
    loading.finishNavigation(1);
    expect(loading.label()).toBe('Cargando tareas…');
    finishTasks();
    expect(loading.isLoading()).toBe(true);
    expect(loading.label()).toBe('Cargando proyecto…');
    finishProject();
    expect(loading.isLoading()).toBe(false);
    expect(loading.label()).toBe('');
  });

  it('does not clear a newer navigation when an older one is cancelled', () => {
    const loading = TestBed.inject(LoadingService);
    loading.startNavigation(1);
    loading.startNavigation(2);
    loading.finishNavigation(1);
    expect(loading.isLoading()).toBe(true);
    loading.finishNavigation(2);
    expect(loading.isLoading()).toBe(false);
  });

  it('releases view loading when data settles or the view is destroyed', async () => {
    const fixture = TestBed.createComponent(LoadingHost);
    const loading = TestBed.inject(LoadingService);
    await fixture.whenStable();
    expect(loading.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('section').getAttribute('aria-busy')).toBe('true');
    fixture.componentInstance.busy.set(false);
    await fixture.whenStable();
    expect(loading.isLoading()).toBe(false);
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();
    expect(loading.isLoading()).toBe(true);
    fixture.destroy();
    expect(loading.isLoading()).toBe(false);
  });
});
