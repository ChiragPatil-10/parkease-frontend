import { GENERAL_RATE_LIMIT_MESSAGE, LOGIN_RATE_LIMIT_MESSAGE } from './toast.constants';

export type RateLimitKind = 'login' | 'general';

/**
 * Turns a Retry-After value into whole seconds. Only a positive whole number counts; anything
 * else (missing, empty, an HTTP date, 0, negative, decimal) is "missing" and returns null.
 */
export function parseRetryAfter(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const seconds = Number.parseInt(text, 10);
  return seconds > 0 ? seconds : null;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** The toast text for a 429. Both kinds count whole seconds from Retry-After when it is usable. */
export function formatRateLimitMessage(
  kind: RateLimitKind,
  retryAfter: string | number | null | undefined,
): string {
  const seconds = parseRetryAfter(retryAfter);

  if (kind === 'login') {
    return seconds === null
      ? LOGIN_RATE_LIMIT_MESSAGE
      : `Too many login attempts. Try again in ${plural(seconds, 'second')}.`;
  }

  return seconds === null
    ? GENERAL_RATE_LIMIT_MESSAGE
    : `Too many requests. Please wait ${plural(seconds, 'second')} and try again.`;
}
