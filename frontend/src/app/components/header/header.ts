import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useToggle } from '../../utils/use-toggle';
import { LucideMenu, LucideSearch } from '@lucide/angular';
import { CommandBarService } from '../../services/command-bar.service';

@Component({
  selector: 'app-header',
  imports: [LucideMenu, LucideSearch, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly commandBarService = inject(CommandBarService);
  @Input() sidebar = useToggle(false);
}
