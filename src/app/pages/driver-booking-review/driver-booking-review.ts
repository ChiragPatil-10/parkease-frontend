import { Component } from '@angular/core';

interface BookingDetail {
  label: string;
  value: string;
  mono?: boolean;
}

@Component({
  selector: 'app-driver-booking-review',
  templateUrl: './driver-booking-review.html',
  styleUrl: './driver-booking-review.css',
})
export class DriverBookingReview {
  // Static mock data for Phase 1; replaced by route/query values and API data in Phase 2.
  protected readonly details: BookingDetail[] = [
    { label: 'Lot', value: 'Whitefield Central Lot' },
    { label: 'Spot', value: 'A-02 · Standard', mono: true },
    { label: 'Vehicle', value: 'KA 05 MJ 4471' },
    { label: 'Start time', value: 'Today, 4:30 PM' },
    { label: 'Duration', value: '3 hours' },
  ];
  protected readonly amount = '₹120';
}
