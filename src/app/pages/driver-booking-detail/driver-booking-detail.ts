import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';

type BookingView = 'confirmed' | 'failed' | 'notfound';

const VIEWS: readonly BookingView[] = ['confirmed', 'failed', 'notfound'];

interface SampleBooking {
  lotName: string;
  spot: string;
  vehicle: string;
  startTime: string;
  amount: string;
}

const CONFIRMED_BOOKING: SampleBooking & { orderId: string; paidAt: string } = {
  lotName: 'Whitefield Central Lot',
  spot: 'A-02 · Standard',
  vehicle: 'KA-05 MJ 4471',
  startTime: 'Today, 4:30 PM',
  amount: '₹120',
  orderId: 'order_Nk3xR9Qp',
  paidAt: 'Today, 4:32 PM',
};

const FAILED_BOOKING: SampleBooking & { reason: string } = {
  lotName: 'Whitefield Central Lot',
  spot: 'A-11 · Standard',
  vehicle: 'KA-05 MJ 4471',
  startTime: 'Mon, 26 Oct, 4:30 PM',
  amount: '₹75',
  reason: "We couldn't set up the payment for this booking.",
};

@Component({
  selector: 'app-driver-booking-detail',
  imports: [DriverNav],
  templateUrl: './driver-booking-detail.html',
  styleUrl: './driver-booking-detail.css',
})
export class DriverBookingDetail {
  private readonly route = inject(ActivatedRoute);

  /** Read from the route but not used until Phase 2. */
  protected readonly bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';

  // TODO(phase 2): replace with real booking status
  protected readonly view = toSignal(
    this.route.queryParamMap.pipe(
      map((params): BookingView => {
        const state = params.get('state') as BookingView;
        return VIEWS.includes(state) ? state : 'confirmed';
      }),
    ),
    { initialValue: 'confirmed' as BookingView },
  );

  protected readonly confirmed = CONFIRMED_BOOKING;
  protected readonly failed = FAILED_BOOKING;
}
