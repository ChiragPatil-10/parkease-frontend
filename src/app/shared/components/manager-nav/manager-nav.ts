import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ManagerNavTab = 'my-lots' | 'spots' | 'lot-bookings' | 'applications';

interface ManagerNavItem {
  tab: ManagerNavTab;
  label: string;
  route: string;
}

const NAV_ITEMS: ManagerNavItem[] = [
  { tab: 'my-lots', label: 'My Lots', route: '/manager/lots' },
  { tab: 'spots', label: 'Spots', route: '/manager/spots' },
  { tab: 'lot-bookings', label: 'Lot Bookings', route: '/manager/lot-bookings' },
  { tab: 'applications', label: 'Applications', route: '/manager/applications' },
];

@Component({
  selector: 'app-manager-nav',
  imports: [RouterLink],
  templateUrl: './manager-nav.html',
  styleUrl: './manager-nav.css',
})
export class ManagerNav {
  readonly activeTab = input.required<ManagerNavTab>();

  protected readonly navItems = NAV_ITEMS;
}
