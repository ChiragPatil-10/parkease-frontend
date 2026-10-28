import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Keeps logged-in users off login/register pages by sending them to their role's home. */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const session = authService.getSession();
  if (!session) {
    return true;
  }

  if (!authService.hasValidToken(session)) {
    authService.clearSession();
    return true;
  }

  return router.createUrlTree([authService.resolvePostAuthRoute(session.user.role)]);
};
