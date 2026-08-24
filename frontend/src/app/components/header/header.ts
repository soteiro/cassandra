import { Component, Input } from '@angular/core';
import { RouterLink} from '@angular/router'
import { useToggle } from '../../utils/use-toggle'
import { LucideMenu } from '@lucide/angular'
@Component({
  selector: 'app-header',
  imports: [LucideMenu, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Input() sidebar = useToggle(false)

}
