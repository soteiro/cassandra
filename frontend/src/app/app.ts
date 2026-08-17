
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './components/toast-container/toast-container';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [
    RouterOutlet,
    ToastContainer,
  ]
})
export class App {
  protected readonly title = signal('Home');
  // inyeccion del singleton StatusService
}