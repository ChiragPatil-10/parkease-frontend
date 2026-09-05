import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { DriverLots } from './pages/driver-lots/driver-lots';
import { ManagerLots } from './pages/manager-lots/manager-lots';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'lots', component: DriverLots },
  { path: 'manager/lots', component: ManagerLots },
];
