import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserRole } from '../../../models/auth/user-role.enum';
import { AuthService } from '../../../services/auth.service';
import { AdminNav } from '../admin-nav/admin-nav';
import { DriverNav } from '../driver-nav/driver-nav';
import { ManagerNav } from '../manager-nav/manager-nav';

/**
 * Shared layout for the 403 and 404 pages: the top bar for the signed-in role (no item active,
 * or just the wordmark when logged out), and a centred message with a "Back to home" button.
 */
@Component({
  selector: 'app-error-page',
  imports: [RouterLink, AdminNav, DriverNav, ManagerNav],
  templateUrl: './error-page.html',
  styleUrl: './error-page.css',
})
export class ErrorPage {
  private readonly authService = inject(AuthService);

  readonly code = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input.required<string>();

  protected readonly role = this.authService.getCurrentUser()?.role ?? null;
  protected readonly Role = UserRole;

  /** The role's home page (same logic as after login), or the login page when logged out. */
  protected readonly homeRoute = this.role ? this.authService.resolvePostAuthRoute(this.role) : '/login';
}
