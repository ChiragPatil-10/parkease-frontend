import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { BookingResponse } from '../../models/booking.model';
import { PaymentResponse } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { PaymentService } from '../../services/payment.service';
import { SpotService } from '../../services/spot.service';
import { VehicleService } from '../../services/vehicle.service';
import { NETWORK_ERROR_MESSAGE, isNetworkError } from '../../shared/network-error';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import {
  PillTone,
  bookingStatusLabel,
  cancelledLabel,
  formatAmount,
  formatBookingTime,
  paymentCardView,
} from './booking-detail-format';
import { CancelBookingDialog } from './cancel-booking-dialog/cancel-booking-dialog';

type LoadState = 'loading' | 'ready' | 'not-found' | 'load-error';
type Phase = 'idle' | 'checking-out' | 'cancelling';
type PaymentState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; payment: PaymentResponse };

interface SpotInfo {
  spotNumber: string;
  spotType: string;
}

interface VehicleInfo {
  plateNumber: string;
}

interface Row {
  label: string;
  /** null while the lookup is still running. */
  value: string | null;
  mono?: boolean;
  tone?: 'red';
}

const POLL_INTERVAL_MS = 2000;
const POLL_LIMIT_MS = 60_000;
const REFUND_POLL_INTERVAL_MS = 3000;
const REFUND_POLL_MAX = 10;
const CANCEL_REASON = 'Cancelled by driver';
const FALLBACK_TITLE = 'Your booking';
const NOT_AVAILABLE = 'Not available';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

function isHttpStatus(err: unknown, ...statuses: number[]): boolean {
  return err instanceof HttpErrorResponse && statuses.includes(err.status);
}

function serverMessage(err: unknown): string {
  return err instanceof HttpErrorResponse ? (err.error?.message ?? '') : '';
}

function holdsMoney(payment: PaymentResponse): boolean {
  return payment.status === 'Captured' || payment.status === 'Held';
}

@Component({
  selector: 'app-driver-booking-detail',
  imports: [DriverNav, RouterLink, CancelBookingDialog],
  templateUrl: './driver-booking-detail.html',
  styleUrl: './driver-booking-detail.css',
})
export class DriverBookingDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly vehicleService = inject(VehicleService);
  private readonly paymentService = inject(PaymentService);
  private readonly injector = inject(Injector);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadErrorText = signal(GENERIC_ERROR);
  protected readonly booking = signal<BookingResponse | null>(null);
  protected readonly lookupsDone = signal(false);
  protected readonly lotName = signal<string | null>(null);
  protected readonly spot = signal<SpotInfo | null>(null);
  protected readonly vehicle = signal<VehicleInfo | null>(null);
  protected readonly paymentState = signal<PaymentState>({ kind: 'loading' });

  protected readonly phase = signal<Phase>('idle');
  protected readonly slow = signal(false);
  protected readonly acting = signal(false);
  protected readonly banner = signal<string | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly dialogOpener = signal<HTMLElement | null>(null);
  protected readonly announcement = signal('');

  protected bookingId = '';

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollStartedAt = 0;
  private refundTimer: ReturnType<typeof setTimeout> | null = null;
  private refundAttempts = 0;
  private inflight: Subscription | null = null;
  private readonly background = new Set<Subscription>();

  protected readonly title = computed(() => this.lotName() ?? FALLBACK_TITLE);
  protected readonly status = computed(() => this.booking()?.status ?? null);

  /** Which action buttons the current status allows; none while an action is being processed. */
  protected readonly actions = computed(() => {
    if (this.phase() !== 'idle') return 'none';
    switch (this.status()) {
      case 'Confirmed':
        return 'confirmed';
      case 'CheckedIn':
        return 'checked-in';
      case 'Completed':
      case 'Cancelled':
      case 'NoShow':
        return 'book-again';
      default:
        return 'none';
    }
  });

  protected readonly bookingRows = computed<Row[]>(() => {
    const booking = this.booking();
    if (!booking) return [];
    const done = this.lookupsDone();
    const spot = this.spot();
    const vehicle = this.vehicle();
    return [
      {
        label: 'Spot',
        value: spot ? `${spot.spotNumber} · ${spot.spotType}` : done ? NOT_AVAILABLE : null,
        mono: !!spot,
      },
      {
        label: 'Vehicle',
        value: vehicle ? formatPlate(vehicle.plateNumber) : done ? NOT_AVAILABLE : null,
        mono: !!vehicle,
      },
      { label: 'Start time', value: formatBookingTime(booking.startTime) },
      {
        label: 'Status',
        value:
          booking.status === 'Cancelled'
            ? cancelledLabel(booking.cancelReason)
            : bookingStatusLabel(booking.status),
      },
    ];
  });

  protected readonly paymentView = computed(() => {
    const booking = this.booking();
    const state = this.paymentState();
    if (!booking || state.kind === 'loading' || state.kind === 'unavailable') return null;
    return paymentCardView(state.kind === 'ready' ? state.payment : null, booking.totalAmount);
  });

  protected readonly paymentRows = computed<Row[]>(() => {
    const view = this.paymentView();
    if (!view) return [];
    const rows: Row[] = [{ label: 'Amount', value: view.amount, mono: true }];
    if (view.orderId) rows.push({ label: 'Razorpay order', value: view.orderId, mono: true });
    if (view.paidAt) rows.push({ label: 'Paid at', value: view.paidAt });
    if (view.reason) rows.push({ label: 'Reason', value: view.reason, tone: 'red' });
    return rows;
  });

  protected readonly cancelMessage = computed(() => {
    const state = this.paymentState();
    if (state.kind === 'ready' && holdsMoney(state.payment)) {
      return `Your payment of ${formatAmount(state.payment.amount)} will be refunded to your original payment method.`;
    }
    return 'This booking will be cancelled.';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopAll());
  }

  ngOnInit(): void {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';
    if (!this.bookingId) {
      this.loadState.set('not-found');
      return;
    }
    this.load();
  }

  protected load(): void {
    this.loadState.set('loading');
    this.inflight?.unsubscribe();
    this.inflight = this.bookingService.getBookingById(this.bookingId).subscribe({
      next: (res) => (res.data ? this.onLoaded(res.data) : this.onLoadError(null)),
      error: (err: unknown) => this.onLoadError(err),
    });
  }

  protected pillClasses(tone: PillTone): string {
    switch (tone) {
      case 'blue':
        return 'bg-link/10 text-link';
      case 'red':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-surface text-muted';
    }
  }

  protected dotClasses(tone: PillTone): string {
    switch (tone) {
      case 'blue':
        return 'bg-link';
      case 'red':
        return 'bg-red-700';
      default:
        return 'bg-muted';
    }
  }

  protected checkIn(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.banner.set(null);
    this.track(
      this.bookingService.checkIn(this.bookingId).subscribe({
        next: (res) => {
          this.acting.set(false);
          if (res.data) this.booking.set(res.data);
          this.announcement.set('Checked in.');
        },
        error: (err: unknown) => {
          this.acting.set(false);
          this.banner.set(this.actionError(err));
        },
      }),
    );
  }

  protected checkOut(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.banner.set(null);
    this.track(
      this.bookingService.checkOut(this.bookingId).subscribe({
        next: () => {
          this.acting.set(false);
          this.phase.set('checking-out');
          this.announcement.set('Checking out.');
          this.startPolling('CheckedIn');
        },
        error: (err: unknown) => {
          this.acting.set(false);
          this.banner.set(this.actionError(err));
        },
      }),
    );
  }

  protected openCancel(event: Event): void {
    this.dialogOpener.set(event.currentTarget as HTMLElement);
    this.dialogError.set(null);
    this.dialogOpen.set(true);
  }

  protected closeCancel(): void {
    this.dialogOpen.set(false);
  }

  protected confirmCancel(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.dialogError.set(null);
    this.track(
      this.bookingService.cancelBooking(this.bookingId, CANCEL_REASON).subscribe({
        next: () => {
          this.acting.set(false);
          this.dialogOpen.set(false);
          this.phase.set('cancelling');
          this.announcement.set('Cancellation in progress.');
          this.startPolling('Confirmed');
        },
        error: (err: unknown) => {
          this.acting.set(false);
          this.dialogError.set(this.actionError(err));
        },
      }),
    );
  }

  private onLoaded(booking: BookingResponse): void {
    if (booking.status === 'Pending') {
      // Page 16 owns the waiting screen and never redirects back here.
      void this.router.navigate(['/bookings', this.bookingId, 'payment'], { replaceUrl: true });
      return;
    }
    this.booking.set(booking);
    this.loadState.set('ready');
    this.loadLookups(booking);
  }

  /** 400, 401 (not the owner), 403 and 404 all mean "nothing to show"; the session stays intact. */
  private onLoadError(err: unknown): void {
    if (err === null || isHttpStatus(err, 400, 401, 403, 404)) {
      this.loadState.set('not-found');
      return;
    }
    this.loadErrorText.set(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR);
    this.loadState.set('load-error');
  }

  /**
   * Lot, spot and vehicle come from the booking's snapshot; a lookup runs only for a value that is null.
   * Every one of them, and the payment, can fail on its own without breaking the page.
   */
  private loadLookups(booking: BookingResponse): void {
    this.lookupsDone.set(false);
    this.paymentState.set({ kind: 'loading' });
    this.track(
      forkJoin({
        lot: booking.lotName
          ? of(booking.lotName)
          : this.lotService.getLotById(booking.lotId).pipe(
              map((res) => res.data?.name ?? null),
              catchError(() => of(null)),
            ),
        spot:
          booking.spotNumber && booking.spotType
            ? of<SpotInfo | null>({ spotNumber: booking.spotNumber, spotType: booking.spotType })
            : this.spotService.getSpotById(booking.spotId).pipe(
                map((res): SpotInfo | null => res.data ?? null),
                catchError(() => of(null)),
              ),
        vehicle: booking.plateNumber
          ? of<VehicleInfo | null>({ plateNumber: booking.plateNumber })
          : this.vehicleService.getVehicleById(booking.vehicleId).pipe(
              map((res): VehicleInfo | null => res.data ?? null),
              catchError(() => of(null)),
            ),
        payment: this.paymentService.getPaymentByBooking(booking.bookingId).pipe(
          map((res): PaymentState => (res.data ? { kind: 'ready', payment: res.data } : { kind: 'none' })),
          catchError((err: unknown): [PaymentState] => [
            isHttpStatus(err, 404) ? { kind: 'none' } : { kind: 'unavailable' },
          ]),
        ),
      }).subscribe(({ lot, spot, vehicle, payment }) => {
        this.lotName.set(lot);
        this.spot.set(spot);
        this.vehicle.set(vehicle);
        this.paymentState.set(payment);
        this.lookupsDone.set(true);
        this.maybeCatchUpRefund();
      }),
    );
  }

  /** Text for a failed action POST. A 401 here means the session expired (the booking is ours). */
  private actionError(err: unknown): string | null {
    if (isHttpStatus(err, 401)) {
      this.authService.clearSession();
      void this.router.navigateByUrl('/login');
      return null;
    }
    if (isHttpStatus(err, 409)) {
      this.reloadBooking();
      return serverMessage(err) || GENERIC_ERROR;
    }
    return GENERIC_ERROR;
  }

  /** Quietly refresh after a 409 so the page matches the server; failures are ignored. */
  private reloadBooking(): void {
    this.track(
      this.bookingService.getBookingById(this.bookingId).subscribe({
        next: (res) => {
          if (res.data && res.data.status !== 'Pending') {
            this.booking.set(res.data);
            this.maybeCatchUpRefund();
          }
        },
        error: () => undefined,
      }),
    );
  }

  /** Polls the booking every 2 seconds until its status moves on from `from`, for at most 60 seconds. */
  private startPolling(from: BookingResponse['status']): void {
    this.clearPollTimer();
    this.slow.set(false);
    this.pollStartedAt = Date.now();
    this.schedulePoll(from);
  }

  private schedulePoll(from: BookingResponse['status']): void {
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      this.track(
        this.bookingService.getBookingById(this.bookingId).subscribe({
          next: (res) => this.afterPoll(from, res.data),
          error: () => this.afterPoll(from, null),
        }),
      );
    }, POLL_INTERVAL_MS);
  }

  private afterPoll(from: BookingResponse['status'], booking: BookingResponse | null): void {
    if (booking && booking.status !== from) {
      this.onPollSettled(booking);
    } else if (Date.now() - this.pollStartedAt >= POLL_LIMIT_MS) {
      this.slow.set(true);
    } else {
      this.schedulePoll(from);
    }
  }

  private onPollSettled(booking: BookingResponse): void {
    this.booking.set(booking);
    this.phase.set('idle');
    if (booking.status === 'Completed') {
      this.announcement.set('Booking completed.');
    } else if (booking.status === 'Cancelled') {
      this.announcement.set('Booking cancelled.');
    }
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
    this.maybeCatchUpRefund();
  }

  /** A cancelled booking whose payment still says Captured is being refunded: re-check every 3 s, at most 10 times. */
  private maybeCatchUpRefund(): void {
    const state = this.paymentState();
    if (
      this.status() !== 'Cancelled' ||
      state.kind !== 'ready' ||
      !holdsMoney(state.payment) ||
      this.refundTimer !== null ||
      this.refundAttempts >= REFUND_POLL_MAX
    ) {
      return;
    }
    this.scheduleRefundCheck();
  }

  private scheduleRefundCheck(): void {
    this.refundTimer = setTimeout(() => {
      this.refundTimer = null;
      this.refundAttempts++;
      this.track(
        this.paymentService.getPaymentByBooking(this.bookingId).subscribe({
          next: (res) => {
            if (res.data && !holdsMoney(res.data)) {
              this.paymentState.set({ kind: 'ready', payment: res.data });
            } else {
              this.maybeCatchUpRefund();
            }
          },
          error: () => this.maybeCatchUpRefund(),
        }),
      );
    }, REFUND_POLL_INTERVAL_MS);
  }

  private track(subscription: Subscription): void {
    this.background.add(subscription);
  }

  private clearPollTimer(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopAll(): void {
    this.clearPollTimer();
    if (this.refundTimer !== null) {
      clearTimeout(this.refundTimer);
      this.refundTimer = null;
    }
    this.inflight?.unsubscribe();
    this.background.forEach((s) => s.unsubscribe());
    this.background.clear();
  }
}
