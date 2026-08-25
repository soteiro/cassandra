import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReflexionResponse,
  ReflexionTipo,
  ReflexionUpdateRequest,
} from '../../models/reflexion.model';
import {
  LucidePencil,
  LucideX,
  LucideBrain,
  LucideCalendar,
  LucideSparkles,
} from '@lucide/angular';

@Component({
  selector: 'app-reflexion-modal',
  imports: [
    CommonModule,
    FormsModule,
    LucidePencil,
    LucideX,
    LucideBrain,
    LucideCalendar,
    LucideSparkles,
  ],
  templateUrl: './reflexion-modal.html',
})
export class ReflexionModal {
  isOpen = input<boolean>(false);
  initialData = input<ReflexionResponse | null>(null);
  isSubmitting = input<boolean>(false);

  save = output<ReflexionUpdateRequest>();
  close = output<void>();

  // Internal form signals
  texto = signal('');
  tipo = signal<ReflexionTipo>('reflexion');
  errorMessage = signal('');

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.errorMessage.set('');
        const data = this.initialData();
        if (data) {
          this.texto.set(data.reflexion || '');
          this.tipo.set(data.tipo || 'reflexion');
        } else {
          this.texto.set('');
          this.tipo.set('reflexion');
        }
      }
    });
  }

  setTipo(t: ReflexionTipo) {
    this.tipo.set(t);
  }

  onSubmit() {
    const txt = this.texto().trim();
    if (!txt) {
      this.errorMessage.set('El contenido no puede estar vacío');
      return;
    }

    this.save.emit({
      reflexion: txt,
      tipo: this.tipo(),
    });
  }

  onClose() {
    this.close.emit();
  }
}
