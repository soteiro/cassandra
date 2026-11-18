import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APIKey, APIKeyScope, CreateAPIKeyRequest } from '../../data/api-key.model';
import { APIKeyService } from '../../data/api-key.service';
import { ProjectService } from '../../../proyectos/data/project.service';
import { CalendarioService } from '../../../calendario/data/calendario.service';
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
  protected readonly projects = computed(() =>
    this.projectsResource.error() ? [] : (this.projectsResource.value() ?? []),
  );
  /** Calendarios que la clave ve con su contenido; el resto solo cuenta como ocupado. */
  protected readonly selectedCalendars = signal<number[]>([]);
  protected readonly keys = signal<APIKey[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly createError = signal('');
  protected readonly selectedProjects = signal<number[]>([]);
  /** Alcance total: la clave cubre todos los proyectos, también los que se creen después. */
  protected readonly allProjects = signal(false);
  /** Alcance total del calendario: ve el detalle de todos, también los futuros. */
  protected readonly allCalendars = signal(false);
  protected readonly submitted = signal(false);
  /** Clave cargada en el formulario para editar sus permisos (sin cambiar el secreto). */
  protected readonly editing = signal<APIKey | null>(null);
  protected readonly issued = signal<{ id: number; nombre: string; token: string } | null>(null);
  protected readonly copyStatus = signal('');
  protected readonly copyFailed = signal(false);
  protected readonly copying = signal(false);
  protected readonly pendingRevoke = signal<APIKey | null>(null);
  protected readonly revoking = signal(false);
  protected readonly revokeError = signal('');
  protected readonly notice = signal('');
  private readonly restoreRevokeFocus = signal(false);
  /** Elemento que recibe el foco al cerrar el diálogo (quien lo abrió). */
  private readonly focusTarget = signal<HTMLElement | null>(null);
  private dialogTrigger?: HTMLElement;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    acceso: ['read'],
    tareas: ['none'],
    calendario: ['none'],
    dias: ['90'],
  });
  protected readonly calendarioValue = signal('none');
  /** Los calendarios se piden solo al elegir acceso al calendario. */
  protected readonly calendariosResource = inject(CalendarioService).calendariosResource(
    () => this.calendarioValue() === 'read',
  );
  protected readonly calendarios = computed(() =>
    this.calendariosResource.error() ? [] : (this.calendariosResource.value() ?? []),
  );

  private readonly secretInput = viewChild<ElementRef<HTMLInputElement>>('secretInput');
  private readonly formDialog = viewChild.required<ElementRef<HTMLDialogElement>>('formDialog');
  private readonly openButton = viewChild.required<ElementRef<HTMLButtonElement>>('openButton');
  private readonly noticeEl = viewChild<ElementRef<HTMLElement>>('noticeEl');
  /** Tras guardar una edición, el aviso puede quedar fuera de la pantalla en el celular. */
  private readonly showNotice = signal(false);
  private readonly revokeConfirm = viewChild<ElementRef<HTMLButtonElement>>('revokeConfirm');
  private revokeTrigger?: HTMLButtonElement;

  constructor() {
    this.loadKeys();
    afterRenderEffect(() => {
      const input = this.secretInput()?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
    afterRenderEffect(() => this.revokeConfirm()?.nativeElement.focus());
    afterRenderEffect(() => {
      const target = this.focusTarget();
      if (!target) return;
      target.focus();
      this.focusTarget.set(null);
    });
    afterRenderEffect(() => {
      if (!this.showNotice()) return;
      this.noticeEl()?.nativeElement.scrollIntoView?.({ block: 'center' });
      this.showNotice.set(false);
    });
    afterRenderEffect(() => {
      if (this.restoreRevokeFocus() && !this.pendingRevoke()) this.revokeTrigger?.focus();
    });
    this.destroyRef.onDestroy(() => this.issued.set(null));
    this.form.controls.calendario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.calendarioValue.set(v));
  }

  protected loadKeys(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (keys) => {
          this.keys.set(keys ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loadError.set(
            getErrorMessage(err, 'No se pudieron cargar las claves. Intenta de nuevo.'),
          );
          this.loading.set(false);
        },
      });
  }

  protected toggleCalendar(id: number): void {
    this.selectedCalendars.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  protected toggleProject(id: number): void {
    this.selectedProjects.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  protected openCreate(trigger: HTMLElement): void {
    this.notice.set('');
    this.openDialog(trigger);
  }

  private openDialog(trigger: HTMLElement): void {
    const dialog = this.formDialog().nativeElement;
    if (dialog.open) return;
    this.dialogTrigger = trigger;
    dialog.showModal();
  }

  protected closeDialog(): void {
    this.formDialog().nativeElement.close();
  }

  /** Esc no cierra mientras se guarda o mientras la clave nueva sigue sin confirmar. */
  protected onDialogCancel(event: Event): void {
    if (this.saving() || this.issued()) event.preventDefault();
  }

  protected onDialogClose(): void {
    // Un borrador de clave nueva se conserva; una edición a medias se descarta.
    if (this.editing()) this.cancelEdit();
    this.focusTarget.set(this.dialogTrigger ?? this.openButton().nativeElement);
    this.dialogTrigger = undefined;
  }

  protected startEdit(key: APIKey, trigger: HTMLElement): void {
    if (this.saving() || this.issued()) return;
    const has = (scope: APIKeyScope) => key.scopes.includes(scope);
    const vencida = this.keyStatus(key) === 'Vencida';
    this.form.reset({
      nombre: key.nombre,
      acceso: has('memory:write') ? 'write' : has('memory:read') ? 'read' : 'none',
      tareas: has('tasks:manage')
        ? 'manage'
        : has('tasks:create')
          ? 'create'
          : has('tasks:read')
            ? 'read'
            : 'none',
      calendario: has('calendar:read') ? 'read' : 'none',
      // Una clave vencida se reactiva con un vencimiento nuevo.
      dias: vencida ? '90' : 'keep',
    });
    this.selectedProjects.set([...key.proyecto_ids]);
    this.selectedCalendars.set([...(key.calendario_ids ?? [])]);
    this.allProjects.set(!!key.todos_proyectos);
    this.allCalendars.set(!!key.todos_calendarios);
    this.submitted.set(false);
    this.createError.set('');
    this.notice.set('');
    this.editing.set(key);
    this.openDialog(trigger);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({ nombre: '', acceso: 'read', tareas: 'none', calendario: 'none', dias: '90' });
    this.calendarioValue.set('none');
    this.selectedProjects.set([]);
    this.selectedCalendars.set([]);
    this.allProjects.set(false);
    this.allCalendars.set(false);
    this.submitted.set(false);
    this.createError.set('');
  }

  protected generate(): void {
    if (this.saving() || this.loading() || this.issued()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.createError.set('');
    const allProjects = this.allProjects();
    if (
      this.form.invalid ||
      (!allProjects &&
        (this.selectedProjects().length === 0 ||
          this.selectedProjects().length > 50 ||
          this.projectsResource.isLoading() ||
          this.projectsResource.error()))
    )
      return;
    const { nombre, acceso, tareas, calendario, dias } = this.form.getRawValue();
    const scopes: APIKeyScope[] = [];
    if (acceso === 'read' || acceso === 'write') scopes.push('memory:read');
    if (acceso === 'write') scopes.push('memory:write');
    if (tareas !== 'none') scopes.push('tasks:read');
    if (tareas === 'create' || tareas === 'manage') scopes.push('tasks:create');
    if (tareas === 'manage') scopes.push('tasks:manage');
    if (calendario === 'read') scopes.push('calendar:read');
    if (scopes.length === 0) {
      this.createError.set('Selecciona al menos un permiso de memoria, tareas o calendario.');
      return;
    }
    const request: CreateAPIKeyRequest = {
      nombre: nombre.trim(),
      scopes,
      proyecto_ids: allProjects ? [] : [...this.selectedProjects()],
    };
    if (allProjects) request.todos_proyectos = true;
    if (calendario === 'read') {
      if (this.allCalendars()) request.todos_calendarios = true;
      else request.calendario_ids = [...this.selectedCalendars()];
    }
    const editing = this.editing();
    if (dias === 'keep') {
      if (editing?.expira_en) request.expira_en = editing.expira_en;
    } else if (dias !== 'never') {
      request.expira_en = new Date(Date.now() + Number(dias) * 86_400_000).toISOString();
    }
    if (editing) {
      this.save(editing, request);
      return;
    }
    this.saving.set(true);
    this.service
      .create(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ token, ...key }) => {
          this.keys.update((keys) => [key, ...keys]);
          this.issued.set({ id: key.id, nombre: key.nombre, token });
          this.copyStatus.set('');
          this.copyFailed.set(false);
          this.notice.set('');
          this.saving.set(false);
          this.resetForm();
        },
        error: (err) => {
          this.createError.set(
            getErrorMessage(
              err,
              'No se pudo generar la clave. Conservamos los datos para reintentar.',
            ),
          );
          this.saving.set(false);
        },
      });
  }

  private save(key: APIKey, request: CreateAPIKeyRequest): void {
    this.saving.set(true);
    this.service
      .update(key.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.keys.update((keys) => keys.map((item) => (item.id === updated.id ? updated : item)));
          this.saving.set(false);
          this.editing.set(null);
          this.resetForm();
          this.closeDialog();
          this.notice.set(
            `Clave «${updated.nombre}» actualizada. El asistente usa los permisos nuevos desde su próxima petición, con la misma clave.`,
          );
          this.showNotice.set(true);
        },
        error: (err) => {
          this.createError.set(
            getErrorMessage(
              err,
              'No se pudo guardar la clave. Conservamos los cambios para reintentar.',
            ),
          );
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
      this.copyStatus.set(
        'No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.',
      );
      this.secretInput()?.nativeElement.focus();
      this.secretInput()?.nativeElement.select();
    } finally {
      if (!this.destroyRef.destroyed) this.copying.set(false);
    }
  }

  protected dismissSecret(): void {
    this.issued.set(null);
    this.copyStatus.set('');
    this.closeDialog();
  }

  protected projectNames(key: APIKey): string {
    if (key.todos_proyectos) return 'Todos, incluidos los futuros';
    return key.proyecto_ids
      .map(
        (id) => this.projects().find((project) => project.id === id)?.nombre ?? `Proyecto #${id}`,
      )
      .join(', ');
  }

  protected permissionNames(key: APIKey): string {
    const names: Record<APIKeyScope, string> = {
      'memory:read': 'Leer memoria',
      'memory:write': 'Guardar memoria',
      'tasks:read': 'Leer tareas',
      'tasks:create': 'Crear tareas',
      'tasks:manage': 'Cerrar y planificar tareas',
      'calendar:read': key.todos_calendarios ? 'Ver todo el calendario' : 'Ver calendario',
    };
    // Orden lógico (memoria, tareas, calendario), no el alfabético del servidor.
    return (Object.keys(names) as APIKeyScope[])
      .filter((scope) => key.scopes.includes(scope))
      .map((scope) => names[scope])
      .join(', ');
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
    this.service
      .revoke(key.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.keys.update((keys) =>
            keys.map((item) =>
              item.id === key.id ? { ...item, revocada_en: new Date().toISOString() } : item,
            ),
          );
          if (this.issued()?.id === key.id) this.issued.set(null);
          if (this.editing()?.id === key.id) this.cancelEdit();
          this.pendingRevoke.set(null);
          this.revoking.set(false);
          this.notice.set(`Clave «${key.nombre}» revocada.`);
          this.focusTarget.set(this.openButton().nativeElement);
        },
        error: (err) => {
          this.revokeError.set(
            getErrorMessage(err, 'No se pudo revocar la clave. Intenta de nuevo.'),
          );
          this.revoking.set(false);
        },
      });
  }
}
