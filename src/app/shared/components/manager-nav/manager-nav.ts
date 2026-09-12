import { Component, input } from '@angular/core';

export type ManagerNavTab = 'my-lots' | 'spots' | 'lot-bookings' | 'applications';

interface ManagerNavItem {
  tab: ManagerNavTab;
  label: string;
}

const NAV_ITEMS: ManagerNavItem[] = [
  { tab: 'my-lots', label: 'My Lots' },
  { tab: 'spots', label: 'Spots' },
  { tab: 'lot-bookings', label: 'Lot Bookings' },
  { tab: 'applications', label: 'Applications' },
];

@Component({
  selector: 'app-manager-nav',
  imports: [],
  templateUrl: './manager-nav.html',
  styleUrl: './manager-nav.css',
})
export class ManagerNav {
  readonly activeTab = input.required<ManagerNavTab>();

  protected readonly navItems = NAV_ITEMS;
}
