import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef,
  ElementRef, inject, signal, viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APIKey, APIKeyScope, CreateAPIKeyRequest } from '../../data/api-key.model';
import { APIKeyService } from '../../data/api-key.service';
import { ProjectService } from '../../../proyectos/data/project.service';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';

@Component({
  selector: 'app-api-keys',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './api-keys.html',
  styleUrl: './api-keys.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeys {
  private readonly service = inject(APIKeyService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly projectsResource = inject(ProjectService).projectsResource;
  protected readonly projects = computed(() => this.projectsResource.error() ? [] : this.projectsResource.value() ?? []);
  protected readonly keys = signal<APIKey[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly createError = signal('');
  protected readonly selectedProjects = signal<number[]>([]);
  protected readonly submitted = signal(false);
  protected readonly issued = signal<{ id: number; nombre: string; token: string } | null>(null);
  protected readonly copyStatus = signal('');
  protected readonly copyFailed = signal(false);
  protected readonly copying = signal(false);
  protected readonly pendingRevoke = signal<APIKey | null>(null);
  protected readonly revoking = signal(false);
  protected readonly revokeError = signal('');
  protected readonly notice = signal('');
  private readonly restoreRevokeFocus = signal(false);
  private readonly focusName = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    acceso: ['read'],
    tareas: ['none'],
    dias: ['90'],
  });
  private readonly secretInput = viewChild<ElementRef<HTMLInputElement>>('secretInput');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly revokeConfirm = viewChild<ElementRef<HTMLButtonElement>>('revokeConfirm');
  private revokeTrigger?: HTMLButtonElement;

  constructor() {
    this.loadKeys();
    afterRenderEffect(() => {
      const input = this.secretInput()?.nativeElement;
      if (input) { input.focus(); input.select(); }
    });
    afterRenderEffect(() => this.revokeConfirm()?.nativeElement.focus());
    afterRenderEffect(() => {
      if (this.focusName()) this.nameInput()?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      if (this.restoreRevokeFocus() && !this.pendingRevoke()) this.revokeTrigger?.focus();
    });
    this.destroyRef.onDestroy(() => this.issued.set(null));
  }

  protected loadKeys(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: keys => { this.keys.set(keys ?? []); this.loading.set(false); },
      error: err => {
        this.loadError.set(getErrorMessage(err, 'No se pudieron cargar las claves. Intenta de nuevo.'));
        this.loading.set(false);
      },
    });
  }

  protected toggleProject(id: number): void {
    this.selectedProjects.update(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  }

  protected generate(): void {
    if (this.saving() || this.loading() || this.issued()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.createError.set('');
    if (this.form.invalid || this.selectedProjects().length === 0 || this.selectedProjects().length > 50
      || this.projectsResource.isLoading() || this.projectsResource.error()) return;
    const { nombre, acceso, tareas, dias } = this.form.getRawValue();
    const scopes: APIKeyScope[] = [];
    if (acceso === 'read' || acceso === 'write') scopes.push('memory:read');
    if (acceso === 'write') scopes.push('memory:write');
    if (tareas === 'read' || tareas === 'create') scopes.push('tasks:read');
    if (tareas === 'create') scopes.push('tasks:create');
    if (scopes.length === 0) {
      this.createError.set('Selecciona al menos un permiso de memoria o tareas.');
      return;
    }
    const request: CreateAPIKeyRequest = {
      nombre: nombre.trim(),
      scopes,
      proyecto_ids: [...this.selectedProjects()],
    };
    if (dias !== 'never') request.expira_en = new Date(Date.now() + Number(dias) * 86_400_000).toISOString();
    this.focusName.set(false);
    this.saving.set(true);
    this.service.create(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ token, ...key }) => {
        this.keys.update(keys => [key, ...keys]);
        this.issued.set({ id: key.id, nombre: key.nombre, token });
        this.copyStatus.set('');
        this.copyFailed.set(false);
        this.notice.set('');
        this.saving.set(false);
        this.form.reset({ nombre: '', acceso: 'read', tareas: 'none', dias: '90' });
        this.selectedProjects.set([]);
        this.submitted.set(false);
      },
      error: err => {
        this.createError.set(getErrorMessage(err, 'No se pudo generar la clave. Conservamos los datos para reintentar.'));
        this.saving.set(false);
      },
    });
  }

  protected async copyKey(): Promise<void> {
    const key = this.issued();
    if (!key || this.copying()) return;
    this.copying.set(true);
    try {
      await navigator.clipboard.writeText(key.token);
      if (this.destroyRef.destroyed || this.issued() !== key) return;
      this.copyFailed.set(false);
      this.copyStatus.set('Clave copiada. Guárdala en la configuración de tu conector.');
    } catch {
      if (this.destroyRef.destroyed || this.issued() !== key) return;
      this.copyFailed.set(true);
      this.copyStatus.set('No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.');
      this.secretInput()?.nativeElement.focus();
      this.secretInput()?.nativeElement.select();
    } finally {
      if (!this.destroyRef.destroyed) this.copying.set(false);
    }
  }

  protected dismissSecret(): void {
    this.focusName.set(true);
    this.issued.set(null);
    this.copyStatus.set('');
  }

  protected projectNames(key: APIKey): string {
    return key.proyecto_ids.map(id => this.projects().find(project => project.id === id)?.nombre ?? `Proyecto #${id}`).join(', ');
  }

  protected permissionNames(key: APIKey): string {
    const names: Record<APIKeyScope, string> = {
      'memory:read': 'Leer memoria', 'memory:write': 'Guardar memoria',
      'tasks:read': 'Leer tareas', 'tasks:create': 'Crear tareas',
    };
    return key.scopes.map(scope => names[scope]).join(', ');
  }

  protected keyStatus(key: APIKey): 'Activa' | 'Revocada' | 'Vencida' {
    if (key.revocada_en) return 'Revocada';
    return key.expira_en && new Date(key.expira_en).getTime() <= Date.now() ? 'Vencida' : 'Activa';
  }

  protected askRevoke(key: APIKey, trigger: HTMLButtonElement): void {
    this.revokeTrigger = trigger;
    this.restoreRevokeFocus.set(false);
    this.revokeError.set('');
    this.pendingRevoke.set(key);
  }

  protected cancelRevoke(): void {
    if (this.revoking()) return;
    this.pendingRevoke.set(null);
    this.revokeError.set('');
    this.restoreRevokeFocus.set(true);
  }

  protected confirmRevoke(): void {
    const key = this.pendingRevoke();
    if (!key || this.revoking()) return;
    this.revoking.set(true);
    this.revokeError.set('');
    this.service.revoke(key.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.keys.update(keys => keys.map(item => item.id === key.id ? { ...item, revocada_en: new Date().toISOString() } : item));
        if (this.issued()?.id === key.id) this.issued.set(null);
        this.pendingRevoke.set(null);
        this.revoking.set(false);
        this.notice.set(`Clave «${key.nombre}» revocada.`);
        this.focusName.set(true);
        this.nameInput()?.nativeElement.focus();
      },
      error: err => {
        this.revokeError.set(getErrorMessage(err, 'No se pudo revocar la clave. Intenta de nuevo.'));
        this.revoking.set(false);
      },
    });
  }
}
