import { Component, signal, computed, inject } from '@angular/core';
import { StatusService } from '../../services/status.service';
@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly title = signal('Home');
  
}
