import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { useToggle } from '../../utils/use-toggle'
import { LucideHouse, LucideFolder } from '@lucide/angular'
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideFolder, LucideHouse],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly authservice = inject(AuthService);
  private readonly router = inject(Router);

  @Input() sidebar = useToggle(false)

  protected chau() :void  {
    this.authservice.logout().subscribe({
      next: () =>{
        this.router.navigate(["/login"])
      }, error : (err) => {
        console.log("error al destruir la sesion, redirigiendo a login por seguridad")
        this.router.navigate(["/login"])
      }
    })
  }



}
