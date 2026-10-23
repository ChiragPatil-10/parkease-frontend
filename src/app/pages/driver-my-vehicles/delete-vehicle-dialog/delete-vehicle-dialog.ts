import { Component, input, output } from '@angular/core';
import { DialogBehavior } from '../dialog-behavior.directive';

export interface DeleteWarning {
  lead: string;
  detail: string;
}

@Component({
  selector: 'app-delete-vehicle-dialog',
  imports: [DialogBehavior],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        appDialogBehavior
        (dismiss)="closed.emit()"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-vehicle-title"
        aria-describedby="delete-vehicle-body"
        tabindex="-1"
        class="w-full max-w-110 rounded-2xl bg-card p-7 shadow-2xl outline-none"
      >
        <div
          aria-hidden="true"
          class="flex size-11 items-center justify-center rounded-full bg-red-50 text-lg font-semibold text-red-600"
        >
          !
        </div>
        <h2 id="delete-vehicle-title" class="mt-4 text-xl font-bold text-ink">
          Delete this vehicle?
        </h2>
        <div id="delete-vehicle-body">
          <p class="mt-2 text-sm text-muted">
            <span class="font-medium text-ink">{{ plate() }}</span>
            ({{ name() }}) will be removed from your account.
          </p>
          @if (warning(); as warning) {
            <p
              class="mt-4 rounded-lg border border-accent bg-amber-50 px-4 py-3 text-sm text-muted"
            >
              <span class="font-medium text-ink">{{ warning.lead }}</span>
              {{ warning.detail }}
            </p>
          }
        </div>
        <div class="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            data-initial-focus
            (click)="closed.emit()"
            class="rounded-lg border border-border bg-card px-5 py-2.5 text-sm text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DeleteVehicleDialog {
  readonly plate = input.required<string>();
  readonly name = input.required<string>();
  readonly warning = input<DeleteWarning | null>(null);
  readonly confirmLabel = input('Delete');

  readonly closed = output<void>();

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
