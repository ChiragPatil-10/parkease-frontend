import { BookingStatus, CancelReason } from '../../models/booking.model';
import { PaymentResponse } from '../../models/payment.model';
import { formatTime12h } from '../driver-lot-detail/driver-lot-detail';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const FAILED_PAYMENT_REASON = "We couldn't set up the payment for this booking.";

/** ₹120, with two decimals only when needed (₹62.50). */
export function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/**
 * UTC ISO string shown in the browser's local time: "Today, 4:30 PM", "Tomorrow, ...",
 * "Yesterday, ...", otherwise "Mon, 26 Oct, 4:30 PM" (plus the year when it is not this year).
 */
export function formatBookingTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded because a DST change makes a local day 23 or 25 hours long.
  const dayDiff = Math.round((dayStart(date) - dayStart(now)) / DAY_MS);
  const time = formatTime12h(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  );

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;

  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${time}`;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked in',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'No-show',
};

const CANCELLED_LABEL: Record<CancelReason, string> = {
  DriverCancelled: 'Cancelled',
  PaymentTimeout: 'Cancelled \u2014 payment timed out',
  PaymentFailed: 'Cancelled \u2014 payment failed',
  SpotUnavailable: 'Cancelled \u2014 spot unavailable',
  Other: 'Cancelled',
};

/** The only text ever shown for a cancelled booking; unknown or missing reasons read plain "Cancelled". */
export function cancelledLabel(reason: CancelReason | null | undefined): string {
  return (reason && CANCELLED_LABEL[reason]) || 'Cancelled';
}

export function bookingStatusLabel(status: BookingStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export type PillTone = 'blue' | 'neutral' | 'red';

export interface PaymentCardView {
  pill: string;
  tone: PillTone;
  amount: string;
  orderId: string | null;
  paidAt: string | null;
  /** Extra line under the rows. */
  note: { text: string; tone: 'muted' | 'red' } | null;
  /** Red "Reason" row (Failed only). Always fixed text, never the API's failureReason. */
  reason: string | null;
}

/** payment is null when the payment service returned 404 (no payment); the booking amount is used instead. */
export function paymentCardView(
  payment: PaymentResponse | null,
  bookingAmount: number,
  now: Date = new Date(),
): PaymentCardView {
  const base: PaymentCardView = {
    pill: 'No payment taken',
    tone: 'neutral',
    amount: formatAmount(payment?.amount ?? bookingAmount),
    orderId: null,
    paidAt: null,
    note: null,
    reason: null,
  };
  if (!payment) {
    return base;
  }

  const paid = {
    orderId: payment.gatewayOrderId || null,
    paidAt: payment.paidAt ? formatBookingTime(payment.paidAt, now) : null,
  };

  switch (payment.status) {
    case 'Captured':
    case 'Held':
      return { ...base, ...paid, pill: 'Captured \u2014 paid', tone: 'blue' };
    case 'Created':
      return { ...base, pill: 'Awaiting payment' };
    case 'Refunded':
      return {
        ...base,
        ...paid,
        pill: 'Refunded',
        tone: 'blue',
        note: { text: 'Your payment was refunded.', tone: 'muted' },
      };
    case 'RefundFailed':
      return {
        ...base,
        ...paid,
        pill: 'Refund pending',
        tone: 'red',
        note: {
          text: 'We could not refund you automatically. Support will refund you manually.',
          tone: 'red',
        },
      };
    case 'Failed':
      return { ...base, pill: 'Failed', tone: 'red', reason: FAILED_PAYMENT_REASON };
    case 'Voided':
    default:
      return base;
  }
}
