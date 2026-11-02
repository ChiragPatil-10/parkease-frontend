import { Component, input, output } from '@angular/core';
import { DialogBehavior } from '../../driver-my-vehicles/dialog-behavior.directive';

@Component({
  selector: 'app-cancel-booking-dialog',
  imports: [DialogBehavior],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        appDialogBehavior
        [returnFocusTo]="opener()"
        (dismiss)="close()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        aria-describedby="cancel-booking-body"
        tabindex="-1"
        class="w-full max-w-110 rounded-2xl bg-card p-7 shadow-2xl outline-none"
      >
        <h2 id="cancel-booking-title" class="font-display text-xl font-bold text-ink">
          Cancel this booking?
        </h2>
        <div id="cancel-booking-body">
          <p class="mt-2 text-sm text-muted">{{ message() }}</p>
          @if (error(); as error) {
            <p
              role="alert"
              class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {{ error }}
            </p>
          }
        </div>
        <div class="mt-6 flex justify-end gap-2.5 max-sm:flex-col-reverse">
          <button
            type="button"
            data-initial-focus
            (click)="close()"
            class="min-h-11 cursor-pointer rounded-lg border border-border bg-card px-5 py-2.5 text-sm text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Keep booking
          </button>
          <button
            type="button"
            (click)="confirm()"
            [disabled]="busy()"
            [attr.aria-busy]="busy()"
            class="min-h-11 cursor-pointer rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ busy() ? 'Cancelling…' : 'Yes, cancel booking' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CancelBookingDialog {
  readonly message = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly opener = input<HTMLElement | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected confirm(): void {
    if (!this.busy()) {
      this.confirmed.emit();
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
