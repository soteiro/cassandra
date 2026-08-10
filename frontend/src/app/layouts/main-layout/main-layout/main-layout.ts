import { Component } from '@angular/core';
import { Sidebar } from '../../../components/sidebar/sidebar';
import { Header } from '../../../components/header/header'
import { RouterOutlet } from '@angular/router';
import { useToggle } from '../../../utils/use-toggle';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Header],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  sidebar = useToggle(false)
}
