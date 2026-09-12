import { Component, input } from '@angular/core';

export type AdminNavTab = 'users' | 'manager-applications' | 'lot-approvals' | 'all-lots';

interface AdminNavItem {
  tab: AdminNavTab;
  label: string;
}

const NAV_ITEMS: AdminNavItem[] = [
  { tab: 'users', label: 'Users' },
  { tab: 'manager-applications', label: 'Manager Applications' },
  { tab: 'lot-approvals', label: 'Lot Approvals' },
  { tab: 'all-lots', label: 'All Lots' },
];

@Component({
  selector: 'app-admin-nav',
  imports: [],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css',
})
export class AdminNav {
  readonly activeTab = input.required<AdminNavTab>();

  protected readonly navItems = NAV_ITEMS;
}
