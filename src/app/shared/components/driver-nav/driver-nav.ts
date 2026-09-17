import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type DriverNavTab = 'search-lots' | 'my-vehicles' | 'my-bookings' | 'notifications';

interface DriverNavItem {
  tab: DriverNavTab;
  label: string;
  route: string | null;
}

const NAV_ITEMS: DriverNavItem[] = [
  { tab: 'search-lots', label: 'Search Lots', route: '/lots' },
  { tab: 'my-vehicles', label: 'My Vehicles', route: null },
  { tab: 'my-bookings', label: 'My Bookings', route: null },
  { tab: 'notifications', label: 'Notifications', route: null },
];

@Component({
  selector: 'app-driver-nav',
  imports: [RouterLink],
  templateUrl: './driver-nav.html',
  styleUrl: './driver-nav.css',
})
export class DriverNav {
  readonly activeTab = input.required<DriverNavTab>();

  protected readonly navItems = NAV_ITEMS;
}
