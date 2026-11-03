import { Component, input, output } from '@angular/core';

/**
 * Presentational toast. Phase 1 has no timers and no global wiring: the parent decides the
 * message and visibility, and reacts to `dismissed`. The host element is the live region so it
 * exists before any message appears.
 */
@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  host: {
    role: 'status',
    'aria-live': 'polite',
    class:
      'pointer-events-none fixed z-50 max-md:inset-x-0 max-md:top-0 md:right-4 md:top-4 md:max-w-sm',
  },
})
export class Toast {
  readonly message = input.required<string>();
  readonly visible = input(false);

  readonly dismissed = output<void>();
}
