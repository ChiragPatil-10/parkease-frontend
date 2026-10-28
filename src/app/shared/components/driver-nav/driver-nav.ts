import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NavShell } from '../nav-shell/nav-shell';
import { AuthService } from '../../../services/auth.service';

export type DriverNavTab = 'search-lots' | 'my-vehicles' | 'my-bookings' | 'notifications';

interface DriverNavItem {
  tab: DriverNavTab;
  label: string;
  route: string | null;
}

const NAV_ITEMS: DriverNavItem[] = [
  { tab: 'search-lots', label: 'Search Lots', route: '/lots' },
  { tab: 'my-vehicles', label: 'My Vehicles', route: '/vehicles' },
  { tab: 'my-bookings', label: 'My Bookings', route: null },
  { tab: 'notifications', label: 'Notifications', route: null },
];

@Component({
  selector: 'app-driver-nav',
  imports: [RouterLink, NavShell],
  templateUrl: './driver-nav.html',
  styleUrl: './driver-nav.css',
})
export class DriverNav {
  readonly activeTab = input.required<DriverNavTab>();

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = NAV_ITEMS;

  protected logOut(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
