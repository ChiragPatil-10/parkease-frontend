import { Component, input, output } from '@angular/core';
import { DialogBehavior } from '../../../pages/driver-my-vehicles/dialog-behavior.directive';

let nextId = 0;

/** Confirm dialog in the style of the Booking Detail cancel dialog, with configurable text. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogBehavior],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        appDialogBehavior
        [returnFocusTo]="opener()"
        (dismiss)="closed.emit()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="bodyId"
        tabindex="-1"
        class="w-full max-w-110 rounded-2xl bg-card p-7 shadow-2xl outline-none"
      >
        <h2 [id]="titleId" class="font-display text-xl font-bold text-ink">{{ title() }}</h2>
        @if (message()) {
          <p [id]="bodyId" class="mt-2 text-sm text-muted">{{ message() }}</p>
        }
        <div class="mt-6 flex justify-end gap-2.5 max-sm:flex-col-reverse">
          <button
            type="button"
            data-initial-focus
            (click)="closed.emit()"
            class="min-h-11 cursor-pointer rounded-lg border border-border bg-card px-5 py-2.5 text-sm text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="confirmed.emit()"
            [class]="
              destructive()
                ? 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700'
                : 'bg-accent text-ink hover:bg-accent-hover focus-visible:outline-ink'
            "
            class="min-h-11 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input.required<string>();
  readonly destructive = input(false);
  readonly opener = input<HTMLElement | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  private readonly id = nextId++;
  protected readonly titleId = `confirm-dialog-title-${this.id}`;
  protected readonly bodyId = `confirm-dialog-body-${this.id}`;

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
