import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LOT_BOOKINGS_PAGE_SIZE } from '../../constants/booking.constants';
import { BookingStatus, ManagerLotBooking } from '../../models/booking.model';
import { LotResponse } from '../../models/lot.model';
import { AuthService } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import {
  bookingStatusLabel,
  formatAmount,
  formatBookingTime,
} from '../driver-booking-detail/booking-detail-format';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import { lotApprovalSuffix } from './lot-approval-suffix';

export type LotBookingsState =
  | 'loaded'
  | 'loading'
  | 'empty'
  | 'error'
  | 'rateLimited'
  | 'lotNotFound'
  | 'noLots';

/** A 429 is explained by the global toast, so the page shows no banner of its own for it. */
function isRateLimited(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 429;
}

export type StatusFilter = 'all' | 'Confirmed' | 'CheckedIn' | 'Completed' | 'Cancelled';

export const FILTER_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'CheckedIn', label: 'Checked in' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pills are always grey; only the dot carries the status colour. Unknown statuses get the muted dot. */
const DOT_CLASS: Record<string, string> = {
  Confirmed: 'bg-link',
  CheckedIn: 'bg-green-700',
  Completed: 'bg-muted',
  Cancelled: 'bg-red-700',
  NoShow: 'bg-muted',
};

export interface LotBookingRowView {
  id: string;
  spot: string | null;
  plate: string | null;
  startTime: string;
  amount: string;
  statusLabel: string;
  dotClass: string;
}

export function lotBookingRowView(
  booking: ManagerLotBooking,
  now: Date = new Date(),
): LotBookingRowView {
  return {
    id: booking.bookingId,
    spot: booking.spotNumber || null,
    plate: booking.plateNumber ? formatPlate(booking.plateNumber) : null,
    startTime: formatBookingTime(booking.startTime, now),
    amount: formatAmount(booking.totalAmount),
    statusLabel: bookingStatusLabel(booking.status as BookingStatus),
    dotClass: DOT_CLASS[booking.status] ?? 'bg-muted',
  };
}

@Component({
  selector: 'app-manager-lot-bookings',
  imports: [ManagerNav, RouterLink, NgTemplateOutlet],
  templateUrl: './manager-lot-bookings.html',
  styleUrl: './manager-lot-bookings.css',
})
export class ManagerLotBookings implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly lotService = inject(ParkingLotService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<LotBookingsState>('loading');
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);
  /** True only when the last page came back with exactly LOT_BOOKINGS_PAGE_SIZE rows. */
  readonly hasMore = signal(false);
  readonly filter = signal<StatusFilter>('all');

  protected readonly chips = FILTER_CHIPS;
  protected readonly skeletonRows = [1, 2, 3, 4];

  private readonly lots = signal<LotResponse[]>([]);
  /** The manager's lot picked by the ?lotId= query parameter; null when none is valid. */
  private readonly selectedLotId = signal<string | null>(null);
  private readonly items = signal<ManagerLotBooking[]>([]);

  protected readonly selectedLot = computed(
    () => this.lots().find((lot) => lot.lotId === this.selectedLotId()) ?? null,
  );
  protected readonly selectedLotValue = computed(() => this.selectedLot()?.lotId ?? '');
  protected readonly lotOptions = computed(() =>
    this.lots().map((lot) => ({
      id: lot.lotId,
      label: lot.name + lotApprovalSuffix(lot),
    })),
  );
  protected readonly showLotPicker = computed(() => this.lots().length > 1);

  protected readonly view = computed(() => this.state());

  protected readonly rows = computed(() => {
    const now = new Date();
    return this.items().map((b) => lotBookingRowView(b, now));
  });

  protected readonly emptyText = computed(() => {
    const filter = this.filter();
    if (filter === 'all') return 'No bookings yet.';
    const label = this.chips.find((c) => c.value === filter)?.label ?? '';
    return `No ${label.toLowerCase()} bookings.`;
  });

  private page = 1;
  private lotsLoaded = false;
  private watchingRoute = false;
  private lotsRequest: Subscription | null = null;
  private bookingsRequest: Subscription | null = null;

  constructor() {
    // A late response must never update a destroyed page.
    this.destroyRef.onDestroy(() => {
      this.lotsRequest?.unsubscribe();
      this.bookingsRequest?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.loadLots();
  }

  protected retry(): void {
    if (this.lotsLoaded) {
      this.fetchFirstPage();
    } else {
      this.loadLots();
    }
  }

  private loadLots(): void {
    const managerId = this.authService.getCurrentUser()?.userId;
    if (!managerId) {
      this.expireSession();
      return;
    }
    this.lotsRequest?.unsubscribe();
    this.state.set('loading');
    this.lotsRequest = this.lotService.getLotsByManager(managerId).subscribe({
      next: (res) => {
        this.lotsRequest = null;
        this.lotsLoaded = true;
        this.lots.set(res.data ?? []);
        if (this.lots().length === 0) {
          this.cancelBookings();
          this.selectedLotId.set(null);
          this.state.set('noLots');
          return;
        }
        this.watchRoute();
      },
      error: (err: unknown) => {
        this.lotsRequest = null;
        if (this.expireIfUnauthorized(err)) return;
        this.state.set(isRateLimited(err) ? 'rateLimited' : 'error');
      },
    });
  }

  /** The URL is the source of truth for the selected lot, so Back and refresh both work. */
  private watchRoute(): void {
    if (this.watchingRoute) {
      this.applyLotParam(this.route.snapshot.queryParamMap.get('lotId'));
      return;
    }
    this.watchingRoute = true;
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyLotParam(params.get('lotId')));
  }

  private applyLotParam(param: string | null): void {
    const lots = this.lots();
    if (lots.length === 0) return;

    if (!param) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { lotId: lots[0].lotId },
        replaceUrl: true,
      });
      return;
    }

    const lot = GUID.test(param)
      ? lots.find((l) => l.lotId.toLowerCase() === param.toLowerCase())
      : undefined;
    if (!lot) {
      this.cancelBookings();
      this.selectedLotId.set(null);
      this.items.set([]);
      this.state.set('lotNotFound');
      return;
    }

    const changed = lot.lotId !== this.selectedLotId();
    this.selectedLotId.set(lot.lotId);
    if (
      changed ||
      this.state() === 'lotNotFound' ||
      this.state() === 'error' ||
      this.state() === 'rateLimited'
    ) {
      this.filter.set('all');
      this.fetchFirstPage();
    }
  }

  protected selectLot(lotId: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { lotId } });
  }

  protected selectFilter(value: StatusFilter): void {
    if (value === this.filter()) return;
    this.filter.set(value);
    this.fetchFirstPage();
  }

  private cancelBookings(): void {
    this.bookingsRequest?.unsubscribe();
    this.bookingsRequest = null;
    this.loadingMore.set(false);
    this.moreError.set(false);
    this.hasMore.set(false);
  }

  /** Page 1 for the current lot and chip. Any older in-flight request is dropped first. */
  private fetchFirstPage(): void {
    const lotId = this.selectedLotId();
    if (!lotId) return;
    this.cancelBookings();
    this.page = 1;
    this.items.set([]);
    this.state.set('loading');

    const request = this.bookingService.getLotBookings(
      lotId,
      this.statusParam(),
      1,
      LOT_BOOKINGS_PAGE_SIZE,
    );
    const sub = request.subscribe({
      next: (res) => {
        this.bookingsRequest = null;
        const list = res.data ?? [];
        this.items.set(list);
        this.hasMore.set(list.length === LOT_BOOKINGS_PAGE_SIZE);
        this.state.set(list.length > 0 ? 'loaded' : 'empty');
      },
      error: (err: unknown) => {
        this.bookingsRequest = null;
        if (this.expireIfUnauthorized(err)) return;
        if (isRateLimited(err)) {
          // Nothing to show yet for this lot and chip: a neutral retry instead of the red banner.
          this.state.set('rateLimited');
          return;
        }
        this.state.set(err instanceof HttpErrorResponse && err.status === 404 ? 'lotNotFound' : 'error');
      },
    });
    // The response may arrive synchronously, before `sub` is assigned.
    if (!sub.closed) this.bookingsRequest = sub;
  }

  /** Next page, appended. Ignored while a request is in flight (the gateway rate-limits per user). */
  protected showMore(): void {
    const lotId = this.selectedLotId();
    if (!lotId || this.bookingsRequest || !this.hasMore()) return;
    this.moreError.set(false);
    this.loadingMore.set(true);

    const next = this.page + 1;
    const sub = this.bookingService
      .getLotBookings(lotId, this.statusParam(), next, LOT_BOOKINGS_PAGE_SIZE)
      .subscribe({
        next: (res) => {
          this.bookingsRequest = null;
          const list = res.data ?? [];
          this.page = next;
          const known = new Set(this.items().map((b) => b.bookingId));
          this.items.update((current) => [...current, ...list.filter((b) => !known.has(b.bookingId))]);
          this.hasMore.set(list.length === LOT_BOOKINGS_PAGE_SIZE);
          this.loadingMore.set(false);
        },
        error: (err: unknown) => {
          this.bookingsRequest = null;
          this.loadingMore.set(false);
          if (this.expireIfUnauthorized(err)) return;
          // The rows already on screen stay; the button retries the same page. A 429 adds no message.
          if (isRateLimited(err)) return;
          this.moreError.set(true);
        },
      });
    if (!sub.closed) this.bookingsRequest = sub;
  }

  private statusParam(): string | null {
    return this.filter() === 'all' ? null : this.filter();
  }

  private expireIfUnauthorized(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse && err.status === 401)) return false;
    this.expireSession();
    return true;
  }

  private expireSession(): void {
    this.authService.clearSession();
    void this.router.navigateByUrl('/login');
  }
}
