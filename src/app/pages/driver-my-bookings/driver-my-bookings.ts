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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, Subscription, catchError, map, mergeMap, of, tap } from 'rxjs';
import { BookingResponse } from '../../models/booking.model';
import { AuthService } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';
import { VehicleService } from '../../services/vehicle.service';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { formatAmount, formatBookingTime } from '../driver-booking-detail/booking-detail-format';
import { CancelBookingDialog } from '../driver-booking-detail/cancel-booking-dialog/cancel-booking-dialog';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import { ActionKind, PillTone, bookingRowView } from './booking-row';

type View = 'loading' | 'list' | 'empty' | 'error' | 'rate-limited';
type Phase = 'idle' | 'checking-in' | 'checking-out' | 'cancelling';

interface RowUi {
  phase: Phase;
  slow: boolean;
}

interface Poll {
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
}

const PAGE_SIZE = 10;
const LOOKUP_CONCURRENCY = 4;
const POLL_INTERVAL_MS = 2000;
const POLL_LIMIT_MS = 60_000;
const CANCEL_REASON = 'Cancelled by driver';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const IDLE: RowUi = { phase: 'idle', slow: false };

const PHASE_TEXT: Record<Exclude<Phase, 'idle'>, string> = {
  'checking-in': 'Checking in...',
  'checking-out': 'Checking out...',
  cancelling: 'Cancelling...',
};

const PILL_CLASSES: Record<PillTone, { pill: string; dot: string }> = {
  blue: { pill: 'bg-link/10 text-link', dot: 'bg-link' },
  green: { pill: 'bg-green-50 text-green-700', dot: 'bg-green-700' },
  grey: { pill: 'bg-surface text-muted', dot: 'bg-muted' },
  red: { pill: 'bg-red-50 text-red-700', dot: 'bg-red-700' },
};

const ACTION_CLASSES: Record<ActionKind, string> = {
  primary: 'bg-accent font-semibold text-ink hover:bg-accent-hover focus-visible:outline-ink',
  danger:
    'border border-red-700 bg-card text-red-700 hover:bg-red-50 focus-visible:outline-red-700',
  neutral: 'border border-border bg-card text-ink hover:bg-surface focus-visible:outline-ink',
};

function isHttpStatus(err: unknown, ...statuses: number[]): boolean {
  return err instanceof HttpErrorResponse && statuses.includes(err.status);
}

function serverMessage(err: unknown): string {
  return err instanceof HttpErrorResponse ? (err.error?.message ?? '') : '';
}

@Component({
  selector: 'app-driver-my-bookings',
  imports: [DriverNav, RouterLink, CancelBookingDialog],
  templateUrl: './driver-my-bookings.html',
  styleUrl: './driver-my-bookings.css',
})
export class DriverMyBookings implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly vehicleService = inject(VehicleService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly view = signal<View>('loading');
  protected readonly bookings = signal<BookingResponse[]>([]);
  protected readonly visibleCount = signal(PAGE_SIZE);
  protected readonly rowUi = signal<Record<string, RowUi>>({});
  protected readonly banner = signal<string | null>(null);
  protected readonly announcement = signal('');

  // Fallback lookups, cached by id. A null value means the lookup failed.
  private readonly lotNames = signal<Record<string, string | null>>({});
  private readonly spotNumbers = signal<Record<string, string | null>>({});
  private readonly plates = signal<Record<string, string>>({});

  protected readonly cancelTarget = signal<BookingResponse | null>(null);
  protected readonly dialogBusy = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly dialogOpener = signal<HTMLElement | null>(null);

  protected readonly pill = PILL_CLASSES;
  protected readonly actionClasses = ACTION_CLASSES;
  protected readonly phaseText = PHASE_TEXT;

  protected readonly visibleBookings = computed(() => this.bookings().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.bookings().length > this.visibleCount());

  protected readonly rows = computed(() =>
    this.visibleBookings().map((booking) => {
      const plate = booking.plateNumber ?? this.plates()[booking.vehicleId] ?? null;
      return {
        booking,
        ...bookingRowView(booking),
        badge: booking.spotNumber ?? this.spotNumbers()[booking.spotId] ?? '?',
        title: booking.lotName ?? this.lotNames()[booking.lotId] ?? 'Booking',
        startTime: formatBookingTime(booking.startTime),
        plate: plate ? formatPlate(plate) : null,
        ui: this.rowUi()[booking.bookingId] ?? IDLE,
      };
    }),
  );

  protected readonly cancelMessage = computed(() => {
    const target = this.cancelTarget();
    return target?.status === 'Confirmed'
      ? `Your payment of ${formatAmount(target.totalAmount)} will be refunded to your original payment method.`
      : 'This booking will be cancelled.';
  });

  private inflight: Subscription | null = null;
  private readonly background = new Set<Subscription>();
  private readonly polls = new Map<string, Poll>();
  private readonly requestedLots = new Set<string>();
  private readonly requestedSpots = new Set<string>();
  private vehiclesRequested = false;
  /** Every fallback lookup goes through here so at most LOOKUP_CONCURRENCY run at once. */
  private readonly lookupQueue = new Subject<Observable<unknown>>();

  constructor() {
    this.lookupQueue
      .pipe(
        mergeMap((lookup) => lookup, LOOKUP_CONCURRENCY),
        takeUntilDestroyed(),
      )
      .subscribe();
    inject(DestroyRef).onDestroy(() => this.stopAll());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.stopPolls();
    this.inflight?.unsubscribe();
    this.rowUi.set({});
    this.banner.set(null);
    this.view.set('loading');
    this.announcement.set('Loading bookings.');
    this.inflight = this.bookingService.getMyBookings().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.bookings.set(list);
        this.visibleCount.set(PAGE_SIZE);
        this.view.set(list.length > 0 ? 'list' : 'empty');
        this.announcement.set('');
        this.requestLookups();
      },
      error: (err: unknown) => {
        if (isHttpStatus(err, 401)) {
          this.expireSession();
          return;
        }
        if (isHttpStatus(err, 429)) {
          // The toast explains. Keep any bookings already loaded; with none, offer a neutral retry.
          this.view.set(this.bookings().length > 0 ? 'list' : 'rate-limited');
          this.announcement.set('');
          return;
        }
        this.view.set('error');
        this.announcement.set('');
      },
    });
  }

  protected showMore(): void {
    const firstNew = this.visibleBookings().length;
    this.visibleCount.update((n) => n + PAGE_SIZE);
    this.announcement.set('10 more bookings shown.');
    this.requestLookups();
    if (!this.hasMore()) {
      // The button disappears with the last page; keep focus in the list.
      const id = this.bookings()[firstNew]?.bookingId;
      if (id) this.focusRow(id);
    }
  }

  protected checkIn(booking: BookingResponse): void {
    const id = booking.bookingId;
    if (this.phaseOf(id) !== 'idle') return;
    this.setUi(id, { phase: 'checking-in', slow: false });
    this.banner.set(null);
    this.track(
      this.bookingService.checkIn(id).subscribe({
        next: (res) => {
          this.setUi(id, IDLE);
          if (res.data) this.replace(res.data);
          this.announcement.set('Checked in.');
        },
        error: (err: unknown) => {
          this.setUi(id, IDLE);
          this.banner.set(this.actionError(err, id));
        },
      }),
    );
  }

  protected checkOut(booking: BookingResponse): void {
    const id = booking.bookingId;
    if (this.phaseOf(id) !== 'idle') return;
    this.setUi(id, { phase: 'checking-out', slow: false });
    this.banner.set(null);
    this.track(
      this.bookingService.checkOut(id).subscribe({
        next: () => {
          this.announcement.set('Checking out.');
          this.startPoll(id, 'CheckedIn');
        },
        error: (err: unknown) => {
          this.setUi(id, IDLE);
          this.banner.set(this.actionError(err, id));
        },
      }),
    );
  }

  protected openCancel(booking: BookingResponse, event: Event): void {
    if (this.phaseOf(booking.bookingId) !== 'idle') return;
    this.dialogOpener.set(event.currentTarget as HTMLElement);
    this.dialogError.set(null);
    this.cancelTarget.set(booking);
  }

  protected closeCancel(): void {
    this.cancelTarget.set(null);
  }

  protected confirmCancel(): void {
    const booking = this.cancelTarget();
    if (!booking || this.dialogBusy()) return;
    const id = booking.bookingId;
    this.dialogBusy.set(true);
    this.dialogError.set(null);
    this.track(
      this.bookingService.cancelBooking(id, CANCEL_REASON).subscribe({
        next: () => {
          this.dialogBusy.set(false);
          this.cancelTarget.set(null);
          this.setUi(id, { phase: 'cancelling', slow: false });
          this.announcement.set('Cancellation in progress.');
          this.startPoll(id, booking.status);
          // The Cancel button is replaced by "Cancelling...", so focus moves to the row.
          this.focusRow(id);
        },
        error: (err: unknown) => {
          this.dialogBusy.set(false);
          this.dialogError.set(this.actionError(err, id));
        },
      }),
    );
  }

  private phaseOf(id: string): Phase {
    return (this.rowUi()[id] ?? IDLE).phase;
  }

  private setUi(id: string, ui: RowUi): void {
    this.rowUi.update((all) => ({ ...all, [id]: ui }));
  }

  private replace(booking: BookingResponse): void {
    this.bookings.update((list) =>
      list.map((b) => (b.bookingId === booking.bookingId ? booking : b)),
    );
  }

  private expireSession(): void {
    this.authService.clearSession();
    void this.router.navigateByUrl('/login');
  }

  /**
   * Text for a failed action. 401 means the session expired (it is our booking), 404 means the
   * booking is gone so the whole list reloads, 409 re-fetches just that booking.
   */
  private actionError(err: unknown, id: string): string | null {
    if (isHttpStatus(err, 429)) {
      // The toast explains; the row and any open dialog stay as they are.
      return null;
    }
    if (isHttpStatus(err, 401)) {
      this.expireSession();
      return null;
    }
    if (isHttpStatus(err, 404)) {
      this.cancelTarget.set(null);
      this.load();
      return null;
    }
    if (isHttpStatus(err, 409)) {
      this.reloadOne(id);
      return serverMessage(err) || GENERIC_ERROR;
    }
    return GENERIC_ERROR;
  }

  /** Quietly refresh one booking after a 409; failures are ignored. */
  private reloadOne(id: string): void {
    this.track(
      this.bookingService.getBookingById(id).subscribe({
        next: (res) => {
          if (res.data) this.replace(res.data);
        },
        error: () => undefined,
      }),
    );
  }

  /** Polls one booking every 2 seconds until its status moves on from `from`, for at most 60 seconds. */
  private startPoll(id: string, from: BookingResponse['status']): void {
    this.stopPoll(id);
    this.polls.set(id, { timer: null, startedAt: Date.now() });
    this.schedulePoll(id, from);
  }

  private schedulePoll(id: string, from: BookingResponse['status']): void {
    const poll = this.polls.get(id);
    if (!poll) return;
    poll.timer = setTimeout(() => {
      poll.timer = null;
      this.track(
        this.bookingService.getBookingById(id).subscribe({
          next: (res) => this.afterPoll(id, from, res.data),
          error: (err: unknown) => {
            if (isHttpStatus(err, 404)) {
              this.stopPoll(id);
              this.load();
              return;
            }
            this.afterPoll(id, from, null);
          },
        }),
      );
    }, POLL_INTERVAL_MS);
  }

  private afterPoll(
    id: string,
    from: BookingResponse['status'],
    booking: BookingResponse | null,
  ): void {
    const poll = this.polls.get(id);
    if (!poll) return;
    if (booking && booking.status !== from) {
      this.stopPoll(id);
      this.replace(booking);
      this.setUi(id, IDLE);
      if (booking.status === 'Completed') this.announcement.set('Booking completed.');
      if (booking.status === 'Cancelled') this.announcement.set('Booking cancelled.');
    } else if (Date.now() - poll.startedAt >= POLL_LIMIT_MS) {
      this.stopPoll(id);
      this.setUi(id, { phase: this.phaseOf(id), slow: true });
    } else {
      this.schedulePoll(id, from);
    }
  }

  private stopPoll(id: string): void {
    const poll = this.polls.get(id);
    if (poll?.timer) clearTimeout(poll.timer);
    this.polls.delete(id);
  }

  private stopPolls(): void {
    [...this.polls.keys()].forEach((id) => this.stopPoll(id));
  }

  /** Focus the row's title link, or the row itself when it is not a link. */
  private focusRow(id: string): void {
    afterNextRender(
      () => {
        const row = Array.from(this.host.querySelectorAll<HTMLElement>('[data-booking]')).find(
          (el) => el.dataset['booking'] === id,
        );
        (row?.querySelector<HTMLElement>('a[data-title]') ?? row)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Looks up only what the visible rows lack: snapshot fields are null on older bookings.
   * One call per distinct lot and spot, and one /vehicles/my call for all plates.
   */
  private requestLookups(): void {
    let needPlate = false;
    for (const booking of this.visibleBookings()) {
      if (!booking.lotName && !this.requestedLots.has(booking.lotId)) {
        this.requestedLots.add(booking.lotId);
        this.queueLookup(
          this.lotService.getLotById(booking.lotId).pipe(map((res) => res.data?.name ?? null)),
          (name) => this.lotNames.update((m) => ({ ...m, [booking.lotId]: name })),
        );
      }
      if (!booking.spotNumber && !this.requestedSpots.has(booking.spotId)) {
        this.requestedSpots.add(booking.spotId);
        this.queueLookup(
          this.spotService
            .getSpotById(booking.spotId)
            .pipe(map((res) => res.data?.spotNumber ?? null)),
          (number) => this.spotNumbers.update((m) => ({ ...m, [booking.spotId]: number })),
        );
      }
      needPlate ||= !booking.plateNumber;
    }
    if (needPlate && !this.vehiclesRequested) {
      this.vehiclesRequested = true;
      this.queueLookup(
        this.vehicleService.getMyVehicles().pipe(
          map((res) => Object.fromEntries((res.data ?? []).map((v) => [v.vehicleId, v.plateNumber]))),
        ),
        (byId) => this.plates.set(byId),
      );
    }
  }

  /** A failed lookup leaves the fallback text in place and never blocks anything else. */
  private queueLookup<T>(source: Observable<T>, store: (value: T) => void): void {
    this.lookupQueue.next(
      source.pipe(
        tap((value) => store(value)),
        catchError(() => of(null)),
      ),
    );
  }

  private track(subscription: Subscription): void {
    this.background.add(subscription);
  }

  private stopAll(): void {
    this.stopPolls();
    this.inflight?.unsubscribe();
    this.background.forEach((s) => s.unsubscribe());
    this.background.clear();
  }
}
