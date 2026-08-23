import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaRequest, PersonaResponse, PersonaUpdateRequest } from '../../models/persona.model';
import {
  LucideUserPlus,
  LucidePencil,
  LucideX,
  LucideTag,
} from '@lucide/angular';

@Component({
  selector: 'app-persona-modal',
  imports: [
    CommonModule,
    FormsModule,
    LucideUserPlus,
    LucidePencil,
    LucideX,
    LucideTag,
  ],
  templateUrl: './persona-modal.html',
})
export class PersonaModal {
  isOpen = input<boolean>(false);
  mode = input<'create' | 'edit'>('create');
  initialData = input<PersonaResponse | null>(null);
  isSubmitting = input<boolean>(false);

  save = output<PersonaRequest | PersonaUpdateRequest>();
  close = output<void>();

  // Internal form signals
  nombre = signal('');
  alias = signal('');
  entorno = signal('');
  informacion = signal('');

  errorMessage = signal('');

  // Suggested environments
  entornoSuggestions = [
    'Trabajo',
    'Cliente',
    'Familia',
    'Amigos',
    'Inversión',
    'Networking',
    'Mentor',
    'Proveedor',
  ];

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.errorMessage.set('');
        const data = this.initialData();
        const m = this.mode();

        if (m === 'edit' && data) {
          this.nombre.set(data.nombre || '');
          this.alias.set(data.alias || '');
          this.entorno.set(data.entorno || '');
          this.informacion.set(data.informacion || '');
        } else {
          // create mode
          this.nombre.set('');
          this.alias.set('');
          this.entorno.set('');
          this.informacion.set('');
        }
      }
    });
  }

  get previewAvatarUrl(): string {
    if (this.mode() === 'edit' && this.initialData()) {
      return `https://robohash.org/${this.initialData()!.id}?size=160x160`;
    }
    const name = this.nombre().trim();
    if (name) {
      return `https://robohash.org/${encodeURIComponent(name)}?size=160x160`;
    }
    return `https://robohash.org/new-persona?size=160x160`;
  }

  selectEntorno(value: string) {
    this.entorno.set(value);
  }

  onSubmit() {
    const nom = this.nombre().trim();
    if (!nom) {
      this.errorMessage.set('El nombre de la persona es obligatorio');
      return;
    }

    const payload: any = {
      nombre: nom,
      alias: this.alias().trim(),
      entorno: this.entorno().trim(),
      informacion: this.informacion().trim(),
    };

    this.save.emit(payload);
  }

  onClose() {
    this.close.emit();
  }
}
