import { BookingResponse } from '../../models/booking.model';
import { cancelledLabel, formatBookingTime } from '../driver-booking-detail/booking-detail-format';

export type PillTone = 'blue' | 'green' | 'grey' | 'red';
export type ActionKey = 'check-in' | 'check-out' | 'cancel' | 'book-again' | 'view-receipt';
export type ActionKind = 'primary' | 'danger' | 'neutral';

export interface RowAction {
  key: ActionKey;
  label: string;
  kind: ActionKind;
}

export interface BookingRowView {
  pill: string;
  tone: PillTone;
  actions: RowAction[];
  /** Pending bookings are not links: the detail page would send them to the payment screen. */
  linked: boolean;
  /** "Pay by 4:45 PM" for Pending bookings. */
  hint: string | null;
}

const CHECK_IN: RowAction = { key: 'check-in', label: 'Check in', kind: 'primary' };
const CHECK_OUT: RowAction = { key: 'check-out', label: 'Check out', kind: 'primary' };
const CANCEL: RowAction = { key: 'cancel', label: 'Cancel', kind: 'danger' };
const BOOK_AGAIN: RowAction = { key: 'book-again', label: 'Book again', kind: 'neutral' };
const VIEW_RECEIPT: RowAction = { key: 'view-receipt', label: 'View receipt', kind: 'neutral' };

function paymentHint(dueAt: string | null | undefined, now: Date): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return due.getTime() <= now.getTime()
    ? 'Payment time is up'
    : `Pay by ${formatBookingTime(dueAt, now)}`;
}

/** Pill, actions, link and hint for one booking, decided only by its status (and cancelReason). */
export function bookingRowView(booking: BookingResponse, now: Date = new Date()): BookingRowView {
  const base = { linked: true, hint: null };
  switch (booking.status) {
    case 'Pending':
      return {
        pill: 'Pending',
        tone: 'grey',
        actions: [CANCEL],
        linked: false,
        hint: paymentHint(booking.paymentDueAt, now),
      };
    case 'Confirmed':
      return { ...base, pill: 'Confirmed', tone: 'blue', actions: [CHECK_IN, CANCEL] };
    case 'CheckedIn':
      return { ...base, pill: 'Checked in', tone: 'green', actions: [CHECK_OUT] };
    case 'Completed':
      return { ...base, pill: 'Completed', tone: 'grey', actions: [VIEW_RECEIPT] };
    case 'Cancelled':
      return {
        ...base,
        pill: cancelledLabel(booking.cancelReason),
        tone: 'red',
        actions: [BOOK_AGAIN],
      };
    case 'NoShow':
      return { ...base, pill: 'No-show', tone: 'red', actions: [BOOK_AGAIN] };
    default:
      return { ...base, pill: String(booking.status), tone: 'grey', actions: [] };
  }
}
