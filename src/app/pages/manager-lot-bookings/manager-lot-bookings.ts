import { Component } from '@angular/core';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

@Component({
  selector: 'app-manager-lot-bookings',
  imports: [ManagerNav],
  template: `<app-manager-nav activeTab="lot-bookings" />
    <p class="p-8 text-center text-muted">Lot Bookings — coming soon.</p>`,
})
export class ManagerLotBookings {}
