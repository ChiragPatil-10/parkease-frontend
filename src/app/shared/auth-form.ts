import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse } from '../models/api-response.model';
import { formatRateLimitMessage } from './components/toast/rate-limit-message';

/** Same rule as the backend: an uppercase letter, a lowercase letter and a digit. */
export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PHONE_PATTERN = /^[0-9+\-\s]{5,20}$/;

export const PASSWORD_MESSAGES = {
  oldRequired: 'Old password is required.',
  newRequired: 'New password is required.',
  tooShort: 'New password must be at least 8 characters.',
  complexity: 'Password must contain uppercase, lowercase, and a digit.',
  sameAsOld: 'New password must differ from old password.',
  confirmRequired: 'Confirm your new password.',
  mismatch: 'The passwords do not match.',
} as const;

export const PASSWORD_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Message the server sent in the ApiResponse envelope, or null when the body has none. */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  const body = err.error as ApiResponse<unknown> | null;
  return typeof body?.message === 'string' && body.message ? body.message : null;
}

/**
 * Maps a 422 `errors` dictionary to field name (lower case) -> first message.
 * The server keys are the PascalCase property names, so lookups are case-insensitive.
 */
export function serverFieldErrors(err: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!(err instanceof HttpErrorResponse)) {
    return result;
  }
  const errors = (err.error as ApiResponse<unknown> | null)?.errors;
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const first = messages?.[0];
    if (first) {
      result[key.toLowerCase()] = first;
    }
  }
  return result;
}

/** Calm inline text for a 429, using the Retry-After seconds when the header is present. */
export function rateLimitNotice(err: HttpErrorResponse): string {
  return formatRateLimitMessage('general', err.headers?.get('Retry-After'));
}
