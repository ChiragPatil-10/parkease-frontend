import { Injectable, OnDestroy, signal } from '@angular/core';

export const TOAST_DURATION_MS = 6000;

/** Holds the one toast that is currently shown. A new message replaces the old one and restarts the timer. */
@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly messageSignal = signal('');
  private readonly visibleSignal = signal(false);

  readonly message = this.messageSignal.asReadonly();
  readonly visible = this.visibleSignal.asReadonly();

  show(message: string): void {
    this.clearTimer();
    this.messageSignal.set(message);
    this.visibleSignal.set(true);
    this.timer = setTimeout(() => this.dismiss(), TOAST_DURATION_MS);
  }

  dismiss(): void {
    this.clearTimer();
    this.visibleSignal.set(false);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
