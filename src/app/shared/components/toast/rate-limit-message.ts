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

/** The toast text for a 429, using the Retry-After seconds when they are usable. */
export function formatRateLimitMessage(
  kind: RateLimitKind,
  retryAfter: string | number | null | undefined,
): string {
  const seconds = parseRetryAfter(retryAfter);

  if (kind === 'login') {
    if (seconds === null || (seconds >= 60 && seconds <= 119)) return LOGIN_RATE_LIMIT_MESSAGE;
    const wait = seconds < 60 ? plural(seconds, 'second') : plural(Math.ceil(seconds / 60), 'minute');
    return `Too many login attempts \u2014 try again in ${wait}.`;
  }

  if (seconds === null) return GENERAL_RATE_LIMIT_MESSAGE;
  const wait = seconds < 60 ? plural(seconds, 'second') : plural(Math.ceil(seconds / 60), 'minute');
  return `Too many requests. Please wait ${wait} and try again.`;
}
