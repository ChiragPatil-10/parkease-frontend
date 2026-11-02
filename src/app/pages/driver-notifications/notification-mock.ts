/** Phase 1 only: local shape and mock rows. Phase 2 replaces these with the real API types. */
export type NotificationStatus = 'Sent' | 'Failed' | 'Pending';

export interface NotificationRow {
  id: string;
  eventType: string;
  title: string;
  message: string | null;
  /** 'Pending' is design-only: the real API returns just Sent or Failed. */
  status: NotificationStatus;
  /** UTC ISO string. */
  sentAt: string;
  bookingId: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const LOT = 'Whitefield Central Lot, spot A-02';

/** Newest first; sentAt is relative to `now` so the relative and absolute times both show. */
export function mockNotifications(now: Date = new Date()): NotificationRow[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  return [
    {
      id: 'n-1',
      eventType: 'BookingConfirmed',
      title: 'Booking confirmed',
      message: `${LOT}.`,
      status: 'Sent',
      sentAt: ago(5 * MINUTE),
      bookingId: 'bk-1',
    },
    {
      id: 'n-2',
      eventType: 'PaymentReceived',
      title: 'Payment received',
      message: `₹120 paid for your booking at ${LOT}.`,
      status: 'Sent',
      sentAt: ago(6 * MINUTE),
      bookingId: 'bk-1',
    },
    {
      id: 'n-3',
      eventType: 'BookingCancelled',
      title: 'Booking cancelled',
      message: `${LOT}. The payment window expired.`,
      status: 'Sent',
      sentAt: ago(3 * HOUR),
      bookingId: 'bk-2',
    },
    {
      id: 'n-4',
      eventType: 'RefundProcessed',
      title: 'Refund processed',
      message: '₹120 refunded for your booking.',
      status: 'Failed',
      sentAt: ago(7 * DAY),
      bookingId: 'bk-2',
    },
    {
      id: 'n-5',
      eventType: 'CheckedOut',
      title: 'Checked out',
      message: `Total charged ₹240 at ${LOT}.`,
      status: 'Sent',
      sentAt: ago(8 * DAY),
      bookingId: 'bk-3',
    },
    {
      id: 'n-6',
      eventType: 'PasswordChanged',
      title: 'Password changed',
      message: 'Your password was changed.',
      status: 'Sent',
      sentAt: ago(10 * DAY),
      bookingId: null,
    },
    {
      id: 'n-7',
      eventType: 'BookingCreated',
      title: 'Booking created',
      message: null,
      status: 'Sent',
      sentAt: ago(12 * DAY),
      bookingId: 'bk-4',
    },
    {
      id: 'n-8',
      eventType: 'PaymentReceived',
      title: 'Payment received',
      message: null,
      status: 'Sent',
      sentAt: ago(13 * DAY),
      bookingId: null,
    },
    {
      // Design-only: the screenshot shows a grey Pending row; the real API never returns one.
      id: 'n-9',
      eventType: 'BookingReminder',
      title: 'Reminder',
      message: 'Your booking starts in 30 minutes.',
      status: 'Pending',
      sentAt: ago(14 * DAY),
      bookingId: 'bk-5',
    },
  ];
}
