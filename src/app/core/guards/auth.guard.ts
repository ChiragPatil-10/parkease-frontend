import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const session = authService.getSession();
  if (!session) {
    return router.createUrlTree(['/']);
  }

  if (!authService.hasValidToken(session)) {
    authService.clearSession();
    return router.createUrlTree(['/login']);
  }

  return true;
};
