import { formatBookingTime } from '../driver-booking-detail/booking-detail-format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A reference far from any real row, so formatBookingTime always prints the full date: "Mon, 26 Oct 2026, 4:30 PM". */
const FULL_DATE_REFERENCE = new Date(0);

/** Relative text within the last 24 hours ("just now", "5 minutes ago", "3 hours ago"), otherwise the booking-page date format. */
export function formatNotificationTime(sentAt: string, now: Date = new Date()): string {
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return sentAt;

  // A clock-skewed future time reads as "just now".
  const age = Math.max(0, now.getTime() - sent.getTime());
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return plural(Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return plural(Math.floor(age / HOUR), 'hour');
  return formatBookingTime(sentAt, now);
}

/** Full date and time for the time element's title attribute. */
export function formatNotificationFullTime(sentAt: string): string {
  return formatBookingTime(sentAt, FULL_DATE_REFERENCE);
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}
