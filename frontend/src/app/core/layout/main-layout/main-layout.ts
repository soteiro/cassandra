import { Component, inject } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { CommandBar } from '../command-bar/command-bar';
import { RouterOutlet } from '@angular/router';
import { useToggle } from '../../../shared/utils/use-toggle';
import { BackButtonService } from '../../platform/back-button.service';

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
