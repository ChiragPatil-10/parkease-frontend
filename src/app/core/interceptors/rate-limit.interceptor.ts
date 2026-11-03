import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AUTH_API } from '../../constants/auth.constants';
import { RateLimitKind, formatRateLimitMessage } from '../../shared/components/toast/rate-limit-message';
import { ToastService } from '../../shared/components/toast/toast.service';

function pathOf(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
}

function kindFor(url: string): RateLimitKind {
  const path = pathOf(url);
  return path.includes(AUTH_API.login) || path.includes(AUTH_API.registerPrefix) ? 'login' : 'general';
}

/**
 * Shows a toast for a Gateway 429 (using the Retry-After header) and rethrows the error unchanged
 * so callers still end their busy states. Never retries, so payments are never resent.
 */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 429) {
        toast.show(formatRateLimitMessage(kindFor(req.url), error.headers?.get('Retry-After')));
      }
      return throwError(() => error);
    }),
  );
};
