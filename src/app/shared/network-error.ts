import { HttpErrorResponse } from '@angular/common/http';

/** Same wording the Driver pages show when the request never reached the server. */
export const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

/**
 * Status 0 means the browser never got a response. The error body is then the browser's own
 * TypeError ("Failed to fetch"), which has a `message` and must not be shown to the user.
 */
export function isNetworkError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}
