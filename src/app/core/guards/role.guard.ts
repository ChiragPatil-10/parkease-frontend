import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/auth/user-role.enum';

export const roleGuard = (...allowedRoles: UserRole[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  if (!user) {
    return router.createUrlTree(['/']);
  }

  if (!allowedRoles.includes(user.role)) {
    return router.createUrlTree(['/403']);
  }

  return true;
};
