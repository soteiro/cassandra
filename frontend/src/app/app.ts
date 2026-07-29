
import { Component, computed, inject, signal } from '@angular/core';
import { StatusService } from '../services/status.service';
import { readonly } from '@angular/forms/signals';
import { Login } from './pages/login/login';
import { routes } from './app.routes';
import { appConfig } from './app.config';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [
    RouterOutlet
  ]
})
export class App {
  protected readonly title = signal('Home');
  // inyeccion del singleton StatusService
}