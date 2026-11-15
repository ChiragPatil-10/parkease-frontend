import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './models/auth/user-role.enum';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/login/login').then((m) => m.Login), canActivate: [guestGuard] },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./pages/register-driver/register-driver').then((m) => m.RegisterDriver), canActivate: [guestGuard] },
  { path: 'register-manager', loadComponent: () => import('./pages/register-manager/register-manager').then((m) => m.RegisterManager), canActivate: [guestGuard] },
  { path: 'register-manager/submitted', loadComponent: () => import('./pages/manager-application-submitted/manager-application-submitted').then((m) => m.ManagerApplicationSubmitted) },
  { path: 'lots', loadComponent: () => import('./pages/driver-lots/driver-lots').then((m) => m.DriverLots), canActivate: [authGuard, roleGuard(UserRole.Driver)] },
  {
    path: 'lots/:lotId',
    loadComponent: () => import('./pages/driver-lot-detail/driver-lot-detail').then((m) => m.DriverLotDetail),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'lots/:lotId/book',
    loadComponent: () => import('./pages/driver-booking-review/driver-booking-review').then((m) => m.DriverBookingReview),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'bookings/:bookingId/payment',
    loadComponent: () => import('./pages/driver-payment-pending/driver-payment-pending').then((m) => m.DriverPaymentPending),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'bookings',
    loadComponent: () => import('./pages/driver-my-bookings/driver-my-bookings').then((m) => m.DriverMyBookings),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'bookings/:bookingId',
    loadComponent: () => import('./pages/driver-booking-detail/driver-booking-detail').then((m) => m.DriverBookingDetail),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/driver-notifications/driver-notifications').then((m) => m.DriverNotifications),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./pages/driver-my-vehicles/driver-my-vehicles').then((m) => m.DriverMyVehicles),
    canActivate: [authGuard, roleGuard(UserRole.Driver)],
  },
  {
    path: 'manager/lots',
    loadComponent: () => import('./pages/manager-lots/manager-lots').then((m) => m.ManagerLots),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lots/new',
    loadComponent: () => import('./pages/manager-lot-form/manager-lot-form').then((m) => m.ManagerLotForm),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lots/:id/edit',
    loadComponent: () => import('./pages/manager-lot-form/manager-lot-form').then((m) => m.ManagerLotForm),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/spots',
    loadComponent: () => import('./pages/manager-spots/manager-spots').then((m) => m.ManagerSpots),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/spots/:lotId/bulk-create',
    loadComponent: () => import('./pages/manager-bulk-create-spots/manager-bulk-create-spots').then((m) => m.ManagerBulkCreateSpots),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lot-bookings',
    loadComponent: () => import('./pages/manager-lot-bookings/manager-lot-bookings').then((m) => m.ManagerLotBookings),
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'admin/approvals',
    loadComponent: () => import('./pages/admin-approval-queue/admin-approval-queue').then((m) => m.AdminApprovalQueue),
    canActivate: [authGuard, roleGuard(UserRole.Admin)],
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin-users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard, roleGuard(UserRole.Admin)],
  },
  {
    path: 'admin/lots',
    loadComponent: () => import('./pages/admin-all-lots/admin-all-lots').then((m) => m.AdminAllLots),
    canActivate: [authGuard, roleGuard(UserRole.Admin)],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
  },
  { path: '403', loadComponent: () => import('./pages/forbidden/forbidden').then((m) => m.Forbidden) },
  // Must stay the last route: anything not matched above is a 404.
  {
    path: '**',
    loadComponent: () => import('./pages/error-not-found/error-not-found').then((m) => m.ErrorNotFound),
  },
];
