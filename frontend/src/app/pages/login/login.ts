import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly errorMessage = signal<string | null>('');

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorMessage.set(null);

    this.authService
      .login({
        email: this.email(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.toastService.success('Bienvenido a Cassandra');
          this.router.navigate(['/home']);
        },
        error: (err) => {
          console.error('error en el login: ', err);
          this.errorMessage.set('credenciales invalidas');
          this.toastService.error('Credenciales inválidas. Verifica tu correo y contraseña.');
        },
      });
  }
}
