import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

let nextId = 0;

/**
 * Shared header for DriverNav, ManagerNav and AdminNav. The nav items are projected in;
 * at md and wider they sit in a row, below md they collapse behind a menu button.
 */
@Component({
  selector: 'app-nav-shell',
  host: { class: 'block' },
  template: `
    <header
      class="flex items-center justify-between border-b border-border bg-card px-4 py-5 max-md:flex-wrap md:px-8"
      (keydown.escape)="onEscape()"
    >
      <span class="text-xl font-bold text-ink">ParkEase</span>

      <button
        #menuButton
        type="button"
        aria-label="Menu"
        class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-ink md:hidden"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="menuId"
        (click)="toggle()"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <nav
        [id]="menuId"
        class="items-center gap-8 text-sm max-md:mt-3 max-md:basis-full max-md:flex-col max-md:items-stretch max-md:gap-0 md:flex"
        [class.hidden]="!open()"
        [class.flex]="open()"
        (click)="onNavClick($event)"
      >
        <ng-content />
      </nav>
    </header>
  `,
})
export class NavShell {
  private readonly router = inject(Router);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly menuId = `app-nav-menu-${nextId++}`;
  protected readonly open = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.open.set(false));
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.menuButton().nativeElement.focus();
  }

  protected onNavClick(event: Event): void {
    if ((event.target as HTMLElement).closest('a, button')) {
      this.open.set(false);
    }
  }
}
