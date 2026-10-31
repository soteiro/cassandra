import { Injectable } from '@angular/core';
import { useToggle } from '../../../shared/utils/use-toggle';

@Injectable({
  providedIn: 'root',
})
export class CommandBarService {
  readonly state = useToggle(false);
}
