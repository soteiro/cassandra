import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router'
import { proyectService } from '../../services/proyect.service'

@Component({
  selector: 'app-proyect-details',
  imports: [RouterLink],
  templateUrl: './proyect-details.html',
  styleUrl: './proyect-details.css',
})
export class ProyectDetails {
  private readonly route = inject(ActivatedRoute)
  private readonly ProyectService = inject(proyectService)
  private readonly  id = () => this.route.snapshot.paramMap.get('id')

  protected readonly projectResource = this.ProyectService.getProyectById(this.id)
}
