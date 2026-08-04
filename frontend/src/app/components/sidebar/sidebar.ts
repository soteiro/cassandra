import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly authservice = inject(AuthService);
  private readonly router = inject(Router);

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
