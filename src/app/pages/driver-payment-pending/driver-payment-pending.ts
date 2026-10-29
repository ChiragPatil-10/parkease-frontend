import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-driver-payment-pending',
  templateUrl: './driver-payment-pending.html',
  styleUrl: './driver-payment-pending.css',
})
export class DriverPaymentPending {
  /** Read from the route but not used until Phase 2. */
  protected readonly bookingId = inject(ActivatedRoute).snapshot.paramMap.get('bookingId');

  protected readonly bookingSummary = 'Whitefield Central · A-02';
}
