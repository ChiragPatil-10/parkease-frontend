import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../../models/api-response.model';

/** Backend message from the response envelope, if there is one. */
export function backendMessage(err: unknown): string | null {
  return err instanceof HttpErrorResponse
    ? ((err.error as ApiResponse<unknown> | null)?.message ?? null)
    : null;
}

/** Message for errors that are not specific to a field or a business rule (not 401, which redirects). */
export function genericErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    if (err.status === 429) {
      return 'Too many requests. Please retry in a few moments.';
    }
    if (err.status >= 500) {
      return 'Something went wrong on our side. Please try again shortly.';
    }
  }
  return fallback;
}
