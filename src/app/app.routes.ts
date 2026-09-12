import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { RegisterDriver } from './pages/register-driver/register-driver';
import { RegisterManager } from './pages/register-manager/register-manager';
import { ManagerApplicationSubmitted } from './pages/manager-application-submitted/manager-application-submitted';
import { DriverLots } from './pages/driver-lots/driver-lots';
import { ManagerLots } from './pages/manager-lots/manager-lots';
import { ManagerLotForm } from './pages/manager-lot-form/manager-lot-form';
import { ManagerSpots } from './pages/manager-spots/manager-spots';
import { ManagerLotBookings } from './pages/manager-lot-bookings/manager-lot-bookings';
import { ManagerApplications } from './pages/manager-applications/manager-applications';
import { AdminApprovalQueue } from './pages/admin-approval-queue/admin-approval-queue';
import { Forbidden } from './pages/forbidden/forbidden';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './models/auth/user-role.enum';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'login', component: Login },
  { path: 'register', component: RegisterDriver },
  { path: 'register-manager', component: RegisterManager },
  { path: 'register-manager/submitted', component: ManagerApplicationSubmitted },
  { path: 'lots', component: DriverLots, canActivate: [authGuard] },
  {
    path: 'manager/lots',
    component: ManagerLots,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lots/new',
    component: ManagerLotForm,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lots/:id/edit',
    component: ManagerLotForm,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/spots',
    component: ManagerSpots,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/lot-bookings',
    component: ManagerLotBookings,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'manager/applications',
    component: ManagerApplications,
    canActivate: [authGuard, roleGuard(UserRole.Manager)],
  },
  {
    path: 'admin/approvals',
    component: AdminApprovalQueue,
    canActivate: [authGuard, roleGuard(UserRole.Admin)],
  },
  { path: '403', component: Forbidden },
];
