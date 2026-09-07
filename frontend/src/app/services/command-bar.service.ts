import { Injectable } from '@angular/core';
import { useToggle } from '../utils/use-toggle';

@Injectable({
  providedIn: 'root',
})
export class CommandBarService {
  readonly state = useToggle(false);
}
