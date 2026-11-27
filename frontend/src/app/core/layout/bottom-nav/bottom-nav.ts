import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideHouse,
  LucideFolder,
  LucideCalendarDays,
  LucideUser,
  LucideWalletMinimal,
  LucideMenu,
  LucideX,
} from '@lucide/angular';
import { useToggle } from '../../../shared/utils/use-toggle';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-bottom-nav',
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideHouse,
    LucideFolder,
    LucideCalendarDays,
    LucideUser,
    LucideWalletMinimal,
    LucideMenu,
    LucideX,
  ],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  /** La demo de portafolio no muestra CRM ni finanzas. */
  protected readonly demo = environment.demo;
  @Input({ required: true }) sidebar = useToggle(false);
}
