import { Component, inject } from '@angular/core';
import { Sidebar } from '../../../components/sidebar/sidebar';
import { Header } from '../../../components/header/header';
import { BottomNav } from '../../../components/bottom-nav/bottom-nav';
import { CommandBar } from '../../../components/command-bar/command-bar';
import { RouterOutlet } from '@angular/router';
import { useToggle } from '../../../utils/use-toggle';
import { BackButtonService } from '../../../services/back-button.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Header, BottomNav, CommandBar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  private readonly backButtonService = inject(BackButtonService);

  sidebar = useToggle(false);

  private readonly _sidebarBackBtn = this.backButtonService.registerEffect(
    () => this.sidebar.isOpen(),
    () => this.sidebar.close(),
    70
  );
}
