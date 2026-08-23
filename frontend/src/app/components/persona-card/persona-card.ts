import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PersonaResponse } from '../../models/persona.model';
import { LucideArrowRight } from '@lucide/angular';

@Component({
  selector: 'app-persona-card',
  imports: [CommonModule, RouterLink, LucideArrowRight],
  templateUrl: './persona-card.html',
})
export class PersonaCard {
  persona = input.required<PersonaResponse>();

  get avatarUrl(): string {
    return `https://robohash.org/${this.persona().id}?size=140x140`;
  }
}
