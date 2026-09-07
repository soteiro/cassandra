import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LucideFolder, LucideSearch } from '@lucide/angular';
import { CommandBarService } from '../../services/command-bar.service';
import { ProjectSearchService } from '../../services/project-search.service';

@Component({
  selector: 'app-command-bar',
  imports: [LucideFolder, LucideSearch],
  templateUrl: './command-bar.html',
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
  },
})
export class CommandBar {
  protected readonly commandBarService = inject(CommandBarService);
  private readonly projectSearch = inject(ProjectSearchService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly selectedIndex = signal(0);
  protected readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');

  protected readonly matches = computed(() => this.projectSearch.search(this.query()));

  constructor() {
    effect(() => {
      this.query();
      this.selectedIndex.set(0);
    });

    effect(() => {
      if (this.commandBarService.state.isOpen()) {
        this.inputRef()?.nativeElement.focus();
      }
    });
  }

  onGlobalKeydown(event: KeyboardEvent) {
    const isToggleShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p';
    if (isToggleShortcut) {
      event.preventDefault();
      this.commandBarService.state.toggle();
      return;
    }

    if (this.commandBarService.state.isOpen() && event.key === 'Escape') {
      this.close();
    }
  }

  onInputKeydown(event: KeyboardEvent) {
    const total = this.matches().length;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (total > 0) this.selectedIndex.update((i) => (i + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (total > 0) this.selectedIndex.update((i) => (i - 1 + total) % total);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const match = this.matches()[this.selectedIndex()];
      if (match) this.select(match.project.id);
    }
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('backdrop-layer')) {
      this.close();
    }
  }

  select(projectId: number) {
    this.router.navigate(['/proyectos', projectId]);
    this.close();
  }

  private close() {
    this.commandBarService.state.close();
    this.query.set('');
  }
}
