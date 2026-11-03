import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NavShell } from '../nav-shell/nav-shell';
import { AuthService } from '../../../services/auth.service';

export type AdminNavTab = 'users' | 'manager-applications' | 'lot-approvals' | 'all-lots';

interface AdminNavItem {
  tab: AdminNavTab;
  label: string;
  route: string | null;
  queryParams?: Record<string, string>;
}

const NAV_ITEMS: AdminNavItem[] = [
  { tab: 'users', label: 'Users', route: '/admin/users' },
  {
    tab: 'manager-applications',
    label: 'Manager Applications',
    route: '/admin/approvals',
    queryParams: { tab: 'manager-applications' },
  },
  {
    tab: 'lot-approvals',
    label: 'Lot Approvals',
    route: '/admin/approvals',
    queryParams: { tab: 'lot-approvals' },
  },
  { tab: 'all-lots', label: 'All Lots', route: '/admin/lots' },
];

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, NavShell],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css',
})
export class AdminNav {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly activeTab = input.required<AdminNavTab | null>();

  protected readonly navItems = NAV_ITEMS;

  protected logOut(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
