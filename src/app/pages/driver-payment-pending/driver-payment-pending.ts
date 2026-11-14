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
import { PaymentService } from '../../services/payment.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';
import { formatCountdown, paymentDeadlineMs } from '../driver-booking-detail/booking-detail-format';

type PageState =
  | 'loading'
  | 'pending'
  | 'waiting'
  | 'confirmed'
  | 'cancelled'
  | 'timed-out'
  | 'other'
  | 'not-found';

const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 5000;
const SLOW_AFTER_MS = 60_000;
const NO_DUE_DATE_LIMIT_MS = 5 * 60_000;
const RECHECK_WINDOW_MS = 60_000;
const BANNER_AFTER_FAILURES = 3;
const FALLBACK_SUMMARY = 'Your booking';
const COUNTDOWN_TICK_MS = 1000;

const STATUS_TEXT: Record<PageState, string> = {
  loading: 'Checking your booking.',
  pending: 'Payment received. Confirming your booking.',
  waiting: 'Waiting for payment.',
  confirmed: 'Booking confirmed.',
  cancelled: 'This booking was cancelled.',
  'timed-out': 'We could not confirm your booking yet.',
  other: 'This booking is no longer waiting for payment.',
  'not-found': "We couldn't find this booking.",
};

const TITLE: Record<PageState, string> = {
  loading: 'Checking your booking',
  pending: 'Payment successful - confirming your booking',
  waiting: 'Waiting for payment',
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
  private readonly paymentService = inject(PaymentService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly state = signal<PageState>('loading');
  protected readonly summary = signal(FALLBACK_SUMMARY);
  protected readonly slow = signal(false);
  protected readonly checking = signal(false);
  protected readonly failures = signal(0);
  private readonly nowMs = signal(Date.now());
  private readonly dueMs = signal<number | null>(null);

  /** "Time left to pay: 12:30", or "Payment time is up"; null when no deadline is known. */
  protected readonly countdownText = computed(() => {
    const due = this.dueMs();
    if (due === null) {
      return null;
    }
    const left = due - this.nowMs();
    return left <= 0 ? 'Payment time is up' : `Time left to pay: ${formatCountdown(left)}`;
  });

  protected readonly showBanner = computed(() => this.failures() >= BANNER_AFTER_FAILURES);
  protected readonly title = computed(() => TITLE[this.state()]);
  protected readonly statusText = computed(() => STATUS_TEXT[this.state()]);
  protected readonly hasIcon = computed(
    () =>
      this.state() === 'loading' || this.state() === 'pending' || this.state() === 'confirmed',
  );
  protected readonly showRow = computed(
    () =>
      this.state() === 'pending' ||
      this.state() === 'waiting' ||
      this.state() === 'confirmed' ||
      this.state() === 'timed-out',
  );

  protected bookingId = '';
  private startedAt = 0;
  private deadline: number | null = null;
  private lookupStarted = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private paymentSub: Subscription | null = null;
  /** Set once the payment is really Captured; from then on a Pending booking means "confirming". */
  private paymentCaptured = false;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAll());

    // Move focus to the new h1 whenever the page leaves the waiting state.
    afterRenderEffect(() => {
      if (this.state() !== 'pending' && this.state() !== 'loading') {
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

  /**
   * A Pending booking is "confirming" only when its payment is really Captured. Otherwise nobody
   * has paid yet, so the page says so and never claims a success. A failed payment lookup counts
   * as not paid and is checked again on the next poll.
   */
  private onPending(booking: BookingResponse): void {
    if (this.paymentCaptured) {
      this.applyPending(booking);
      return;
    }
    this.paymentSub?.unsubscribe();
    this.paymentSub = this.paymentService.getPaymentByBooking(this.bookingId).subscribe({
      next: (res) => {
        const status = res.data?.status;
        this.paymentCaptured = status === 'Captured' || status === 'Held';
        this.applyPending(booking);
      },
      error: () => this.applyPending(booking),
    });
  }

  private applyPending(booking: BookingResponse): void {
    if (!this.paymentCaptured) {
      this.applyWaiting(booking);
      return;
    }
    this.stopCountdown();
    this.state.set('pending');
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

  /** Unpaid: keep polling (it may get paid or cancelled elsewhere) and count down to the timeout. */
  private applyWaiting(booking: BookingResponse): void {
    this.checking.set(false);
    this.state.set('waiting');
    this.dueMs.set(paymentDeadlineMs(booking.paymentDueAt, booking.createdAt));
    if (this.countdownTimer === null) {
      this.nowMs.set(Date.now());
      this.countdownTimer = setInterval(() => this.nowMs.set(Date.now()), COUNTDOWN_TICK_MS);
    }
    this.schedule();
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private onError(err: unknown): void {
    if (isNotFoundError(err)) {
      this.finish('not-found');
      return;
    }
    // Network errors, 5xx and 429 never end the flow. A 429 is explained by the global toast, so it
    // does not count toward the "having trouble" banner; polling just carries on.
    if (!(err instanceof HttpErrorResponse && err.status === 429)) {
      this.failures.update((n) => n + 1);
    }
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

  /** Lot name and spot label come from the booking snapshot; a lookup runs only for a null value. A failed lookup keeps the fallback and never blocks polling. */
  private loadLookups(booking: BookingResponse): void {
    if (this.lookupStarted) {
      return;
    }
    this.lookupStarted = true;
    forkJoin([
      booking.lotName
        ? of(booking.lotName)
        : this.lotService.getLotById(booking.lotId).pipe(
            map((res) => res.data?.name ?? null),
            catchError(() => of(null)),
          ),
      booking.spotNumber
        ? of(booking.spotNumber)
        : this.spotService.getSpotById(booking.spotId).pipe(
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
    this.stopCountdown();
    this.paymentSub?.unsubscribe();
    this.paymentSub = null;
    if (this.slowTimer !== null) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
    this.inflight?.unsubscribe();
    this.inflight = null;
  }
}
