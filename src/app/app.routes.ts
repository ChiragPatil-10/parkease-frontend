import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { RegisterDriver } from './pages/register-driver/register-driver';
import { RegisterManager } from './pages/register-manager/register-manager';
import { ManagerApplicationSubmitted } from './pages/manager-application-submitted/manager-application-submitted';
import { DriverLots } from './pages/driver-lots/driver-lots';
import { ManagerLots } from './pages/manager-lots/manager-lots';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'register', component: RegisterDriver },
  { path: 'register-manager', component: RegisterManager },
  { path: 'register-manager/submitted', component: ManagerApplicationSubmitted },
  { path: 'lots', component: DriverLots, canActivate: [authGuard] },
  { path: 'manager/lots', component: ManagerLots, canActivate: [authGuard] },
];
