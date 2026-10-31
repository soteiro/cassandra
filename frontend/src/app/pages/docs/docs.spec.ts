import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Docs } from './docs';
import { AppearanceService } from '../../shared/services/appearance.service';

describe('Docs', () => {
  let component: Docs;
  let fixture: ComponentFixture<Docs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Docs],
    }).compileComponents();

    fixture = TestBed.createComponent(Docs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('injects the Scalar API reference into the iframe srcdoc', () => {
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.title).toBe('Cassandra API Reference');
    expect(iframe.srcdoc).toContain('data-url="/docs/openapi.json"');
    expect(iframe.srcdoc).toContain('@scalar/api-reference');
  });

  it('passes the current palette and color mode to the API reference', async () => {
    const appearance = TestBed.inject(AppearanceService);
    appearance.setPalette('forest');
    appearance.setMode('light');
    await fixture.whenStable();
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;

    expect(iframe.srcdoc).toContain('data-palette="forest" data-mode="light"');
    expect(iframe.srcdoc).toContain('"darkMode": false');
    localStorage.removeItem('cassandra.appearance');
  });
});
