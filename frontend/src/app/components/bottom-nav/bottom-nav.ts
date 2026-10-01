import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideHouse,
  LucideFolder,
  LucideUser,
  LucideWalletMinimal,
  LucideMenu,
  LucideX
} from '@lucide/angular';
import { useToggle } from '../../utils/use-toggle';

@Component({
  selector: 'app-bottom-nav',
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideHouse,
    LucideFolder,
    LucideUser,
    LucideWalletMinimal,
    LucideMenu,
    LucideX
  ],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  @Input({ required: true }) sidebar = useToggle(false);
}
