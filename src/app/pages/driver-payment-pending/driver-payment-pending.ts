import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { BookingResponse } from '../../models/booking.model';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';

type PageState = 'pending' | 'confirmed' | 'cancelled' | 'timed-out' | 'other' | 'not-found';

const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 5000;
const SLOW_AFTER_MS = 60_000;
const NO_DUE_DATE_LIMIT_MS = 5 * 60_000;
const RECHECK_WINDOW_MS = 60_000;
const BANNER_AFTER_FAILURES = 3;
const FALLBACK_SUMMARY = 'Your booking';

const STATUS_TEXT: Record<PageState, string> = {
  pending: 'Payment received. Confirming your booking.',
  confirmed: 'Booking confirmed.',
  cancelled: 'This booking was cancelled.',
  'timed-out': 'We could not confirm your booking yet.',
  other: 'This booking is no longer waiting for payment.',
  'not-found': "We couldn't find this booking.",
};

const TITLE: Record<PageState, string> = {
  pending: 'Payment successful — confirming your booking',
  confirmed: 'Booking confirmed',
  cancelled: 'This booking was cancelled',
  'timed-out': 'We could not confirm your booking yet',
  other: 'This booking is no longer waiting for payment',
  'not-found': "We couldn't find this booking",
};

/** 400 (malformed id), 401 (another driver's booking), 403 and 404 all mean "nothing to show". */
function isNotFoundError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && [400, 401, 403, 404].includes(err.status);
}

@Component({
  selector: 'app-driver-payment-pending',
  imports: [RouterLink],
  templateUrl: './driver-payment-pending.html',
  styleUrl: './driver-payment-pending.css',
})
export class DriverPaymentPending implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingService = inject(BookingService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly state = signal<PageState>('pending');
  protected readonly summary = signal(FALLBACK_SUMMARY);
  protected readonly slow = signal(false);
  protected readonly checking = signal(false);
  protected readonly failures = signal(0);

  protected readonly showBanner = computed(() => this.failures() >= BANNER_AFTER_FAILURES);
  protected readonly title = computed(() => TITLE[this.state()]);
  protected readonly statusText = computed(() => STATUS_TEXT[this.state()]);
  protected readonly hasIcon = computed(
    () => this.state() === 'pending' || this.state() === 'confirmed',
  );
  protected readonly showRow = computed(
    () =>
      this.state() === 'pending' || this.state() === 'confirmed' || this.state() === 'timed-out',
  );

  private bookingId = '';
  private startedAt = 0;
  private deadline: number | null = null;
  private lookupStarted = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAll());

    // Move focus to the new h1 whenever the page leaves the waiting state.
    afterRenderEffect(() => {
      if (this.state() !== 'pending') {
        this.heading()?.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';
    if (!this.bookingId) {
      this.state.set('not-found');
      return;
    }
    this.startedAt = Date.now();
    this.slowTimer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
    this.fetch();
  }

  protected checkAgain(): void {
    if (this.checking()) {
      return;
    }
    this.checking.set(true);
    this.fetch();
  }

  private fetch(): void {
    this.inflight?.unsubscribe();
    this.inflight = this.bookingService.getBookingById(this.bookingId).subscribe({
      next: (res) => (res.data ? this.onBooking(res.data) : this.onError(null)),
      error: (err: unknown) => this.onError(err),
    });
  }

  private onBooking(booking: BookingResponse): void {
    this.failures.set(0);
    this.loadLookups(booking);

    switch (booking.status) {
      case 'Pending':
        this.onPending(booking);
        return;
      case 'Confirmed':
        this.finish('confirmed');
        return;
      case 'Cancelled':
        this.finish('cancelled');
        return;
      default:
        this.finish('other');
    }
  }

  private onPending(booking: BookingResponse): void {
    const now = Date.now();
    if (this.checking()) {
      // "Check again" found it still pending: poll for one more minute.
      this.checking.set(false);
      this.deadline = now + RECHECK_WINDOW_MS;
      this.state.set('pending');
    } else if (this.deadline === null) {
      const due = booking.paymentDueAt ? Date.parse(booking.paymentDueAt) : NaN;
      this.deadline = Number.isNaN(due) ? this.startedAt + NO_DUE_DATE_LIMIT_MS : due;
    }

    if (now >= this.deadline) {
      // This response was the final fetch after the deadline.
      this.clearPollTimer();
      this.state.set('timed-out');
      return;
    }
    this.schedule();
  }

  private onError(err: unknown): void {
    if (isNotFoundError(err)) {
      this.finish('not-found');
      return;
    }
    // Network errors, 5xx and 429 never end the flow.
    this.failures.update((n) => n + 1);
    if (this.checking()) {
      this.checking.set(false);
      return;
    }
    this.schedule();
  }

  private schedule(): void {
    this.clearPollTimer();
    const delay = Date.now() - this.startedAt >= SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
    this.pollTimer = setTimeout(() => this.fetch(), delay);
  }

  private finish(state: PageState): void {
    this.checking.set(false);
    this.stopAll();
    this.state.set(state);
  }

  /** Lot name and spot label are cosmetic: a failed lookup keeps the fallback and never blocks polling. */
  private loadLookups(booking: BookingResponse): void {
    if (this.lookupStarted) {
      return;
    }
    this.lookupStarted = true;
    forkJoin([
      this.lotService.getLotById(booking.lotId).pipe(
        map((res) => res.data?.name ?? null),
        catchError(() => of(null)),
      ),
      this.spotService.getSpotById(booking.spotId).pipe(
        map((res) => res.data?.spotNumber ?? null),
        catchError(() => of(null)),
      ),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([lotName, spotLabel]) => {
        if (lotName && spotLabel) {
          this.summary.set(`${lotName} · ${spotLabel}`);
        }
      });
  }

  private clearPollTimer(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopAll(): void {
    this.clearPollTimer();
    if (this.slowTimer !== null) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
    this.inflight?.unsubscribe();
    this.inflight = null;
  }
}
