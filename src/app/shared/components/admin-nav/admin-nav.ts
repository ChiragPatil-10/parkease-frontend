import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

export type AdminNavTab = 'users' | 'manager-applications' | 'lot-approvals' | 'all-lots';

interface AdminNavItem {
  tab: AdminNavTab;
  label: string;
  route: string | null;
}

const NAV_ITEMS: AdminNavItem[] = [
  { tab: 'users', label: 'Users', route: null },
  { tab: 'manager-applications', label: 'Manager Applications', route: '/admin/approvals' },
  { tab: 'lot-approvals', label: 'Lot Approvals', route: '/admin/approvals' },
  { tab: 'all-lots', label: 'All Lots', route: null },
];

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css',
})
export class AdminNav {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly activeTab = input.required<AdminNavTab>();

  protected readonly navItems = NAV_ITEMS;

  protected logOut(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
