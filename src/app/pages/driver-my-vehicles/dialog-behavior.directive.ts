import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input, output } from '@angular/core';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for a dialog panel: moves focus in on open (to the element marked
 * `data-initial-focus`, else the first focusable), traps Tab inside, emits `dismiss`
 * on Escape, locks page scroll, and returns focus to the trigger on destroy.
 */
@Directive({
  selector: '[appDialogBehavior]',
  host: {
    '(keydown)': 'trapTab($event)',
    '(document:keydown.escape)': 'dismiss.emit()',
  },
})
export class DialogBehavior implements OnDestroy {
  readonly dismiss = output<void>();
  /** Element that triggered the overlay (from the click event); focus returns here on close. */
  readonly returnFocusTo = input<HTMLElement | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly activeAtOpen = this.document.activeElement as HTMLElement | null;
  private readonly previousOverflow = this.document.body.style.overflow;

  constructor() {
    this.document.body.style.overflow = 'hidden';
    afterNextRender(() => {
      const target =
        this.host.querySelector<HTMLElement>('[data-initial-focus]') ?? this.focusable()[0];
      (target ?? this.host).focus();
    });
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousOverflow;
    const target = this.returnFocusTo() ?? this.activeAtOpen;
    if (target?.isConnected) {
      target.focus();
    }
  }

  protected trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const items = this.focusable();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    const outside = !this.host.contains(active) || active === this.host;

    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }
}
