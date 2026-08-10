import { Component, Input } from '@angular/core';
import { useToggle } from '../../utils/use-toggle'
import { LucideMenu } from '@lucide/angular'
@Component({
  selector: 'app-header',
  imports: [LucideMenu],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Input() sidebar = useToggle(false)

}
