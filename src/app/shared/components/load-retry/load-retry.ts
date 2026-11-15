import { Component, input, output } from '@angular/core';

/**
 * Shown when a page could not load its data. With no message it is the calm block used for
 * a 429 ("Couldn't load this right now."); with a message it is the red alert for a real failure.
 * The parent sets spacing and alignment through the host class, for example class="mt-6".
 */
@Component({
  selector: 'app-load-retry',
  host: { class: 'block' },
  templateUrl: './load-retry.html',
  styleUrl: './load-retry.css',
})
export class LoadRetry {
  /** Null means the neutral rate-limit text. */
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
}
