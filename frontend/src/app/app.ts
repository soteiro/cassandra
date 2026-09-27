import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './components/toast-container/toast-container';
import { BackButtonService } from './services/back-button.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [
    RouterOutlet,
    ToastContainer,
  ]
})
export class App {
  private readonly backButtonService = inject(BackButtonService);
  protected readonly title = signal('Home');
}