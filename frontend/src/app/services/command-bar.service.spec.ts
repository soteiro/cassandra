import { TestBed } from '@angular/core/testing';
import { CommandBarService } from './command-bar.service';

describe('CommandBarService', () => {
  it('should expose a closed toggle that can be opened, closed and toggled', () => {
    const { state } = TestBed.inject(CommandBarService);

    expect(state.isOpen()).toBe(false);
    state.open();
    expect(state.isOpen()).toBe(true);
    state.toggle();
    expect(state.isOpen()).toBe(false);
    state.toggle();
    state.close();
    expect(state.isOpen()).toBe(false);
  });
});
