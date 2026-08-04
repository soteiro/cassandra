import { Component, signal, inject, computed, Inject } from '@angular/core';
import { proyectService } from '../../services/proyect.service'
import { RouterLink } from "@angular/router";
 @Component({
  selector: 'app-test1',
  imports: [RouterLink],
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class Proyectos {
  protected readonly proyectService = inject(proyectService)
  protected readonly proyectsResource = this.proyectService.proyectResource;
  reload(){
    this.proyectService.reload()
  }
}
