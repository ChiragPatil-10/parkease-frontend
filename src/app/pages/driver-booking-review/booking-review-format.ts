const QUARTER_HOUR_MS = 15 * 60_000;
const HOURS_PATTERN = /^[1-4]$/;

/** The `hours` query value as 1-4, or null if it is missing or not a plain integer in that range. */
export function parseHours(value: string | null): number | null {
  return value !== null && HOURS_PATTERN.test(value) ? Number(value) : null;
}

export function formatDuration(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/** Price x hours, rounded to paise to avoid float noise (e.g. 0.1 x 3). */
export function computeAmount(pricePerHour: number, hours: number): number {
  return Math.round(pricePerHour * hours * 100) / 100;
}

/** Now rounded up to the next 15 minutes; an exact quarter-hour is kept. */
export function nextQuarterHour(now: Date): Date {
  return new Date(Math.ceil(now.getTime() / QUARTER_HOUR_MS) * QUARTER_HOUR_MS);
}

/** UTC ISO without milliseconds, e.g. 2026-09-16T16:00:00Z (the format shown in 05-Booking-Service.md). */
export function toBookingStartTime(now: Date): string {
  return nextQuarterHour(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
