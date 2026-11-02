import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { BookingStatus } from '../../models/booking.model';
import {
  bookingStatusLabel,
  formatAmount,
  formatBookingTime,
} from '../driver-booking-detail/booking-detail-format';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import { MockLotBooking, buildMockLots } from './lot-bookings-mock';

export type LotBookingsState = 'loaded' | 'loading' | 'empty' | 'error' | 'lotNotFound' | 'noLots';

export type StatusFilter = 'all' | 'Confirmed' | 'CheckedIn' | 'Completed' | 'Cancelled';

export const FILTER_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'CheckedIn', label: 'Checked in' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 5;

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

export function lotBookingRowView(booking: MockLotBooking, now: Date = new Date()): LotBookingRowView {
  return {
    id: booking.bookingId,
    spot: booking.spotNumber,
    plate: booking.plateNumber ? formatPlate(booking.plateNumber) : null,
    startTime: formatBookingTime(booking.startTime, now),
    amount: formatAmount(booking.amount),
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
export class ManagerLotBookings {
  /** Phase 1: set by hand. Phase 2 replaces this with real fetching. 'loaded' shows 'empty' when no rows match. */
  readonly state = signal<LotBookingsState>('loaded');
  readonly loadingMore = signal(false);

  protected readonly chips = FILTER_CHIPS;
  protected readonly skeletonRows = [1, 2, 3, 4];

  private readonly lots = signal(buildMockLots());
  protected readonly lotOptions = computed(() =>
    this.lots().map((lot) => ({
      id: lot.lotId,
      label: lot.approved ? lot.name : `${lot.name} (pending approval)`,
    })),
  );
  protected readonly showLotPicker = computed(() => this.lots().length > 1);

  /** Phase 2 moves this into the URL as ?lotId=. */
  readonly selectedLotId = signal(this.lots()[0].lotId);
  readonly filter = signal<StatusFilter>('all');
  private readonly visibleCount = signal(PAGE_SIZE);

  protected readonly lotName = computed(
    () => this.lots().find((lot) => lot.lotId === this.selectedLotId())?.name ?? '',
  );

  private readonly filtered = computed(() => {
    const lot = this.lots().find((l) => l.lotId === this.selectedLotId());
    const filter = this.filter();
    const all = lot?.bookings ?? [];
    return filter === 'all' ? all : all.filter((b) => b.status === filter);
  });

  protected readonly rows = computed(() => {
    const now = new Date();
    return this.filtered()
      .slice(0, this.visibleCount())
      .map((b) => lotBookingRowView(b, now));
  });

  protected readonly hasMore = computed(() => this.filtered().length > this.visibleCount());

  protected readonly view = computed<LotBookingsState>(() =>
    this.state() === 'loaded' && this.filtered().length === 0 ? 'empty' : this.state(),
  );

  protected readonly emptyText = computed(() => {
    const filter = this.filter();
    if (filter === 'all') return 'No bookings yet.';
    const label = this.chips.find((c) => c.value === filter)?.label ?? '';
    return `No ${label.toLowerCase()} bookings.`;
  });

  protected selectLot(lotId: string): void {
    this.selectedLotId.set(lotId);
    this.filter.set('all');
    this.visibleCount.set(PAGE_SIZE);
  }

  protected selectFilter(value: StatusFilter): void {
    this.filter.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected showMore(): void {
    this.visibleCount.update((n) => n + PAGE_SIZE);
  }
}
