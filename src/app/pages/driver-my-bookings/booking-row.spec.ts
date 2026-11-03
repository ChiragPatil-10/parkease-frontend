import { BookingResponse } from '../../models/booking.model';
import { bookingRowView } from './booking-row';

const NOW = new Date(2026, 9, 24, 12, 0);

function booking(status: string, extra: Partial<BookingResponse> = {}): BookingResponse {
  return {
    bookingId: 'bk-1',
    status,
    startTime: NOW.toISOString(),
    ...extra,
  } as BookingResponse;
}

describe('bookingRowView', () => {
  const labels = (status: string, extra: Partial<BookingResponse> = {}) =>
    bookingRowView(booking(status, extra), NOW).actions.map((a) => a.label);

  it.each([
    ['Pending', 'Pending', 'grey', ['Cancel'], false],
    ['Confirmed', 'Confirmed', 'blue', ['Check in', 'Cancel'], true],
    ['CheckedIn', 'Checked in', 'green', ['Check out'], true],
    ['Completed', 'Completed', 'grey', ['View receipt'], true],
    ['Cancelled', 'Cancelled', 'red', ['Book again'], true],
    ['NoShow', 'No-show', 'red', ['Book again'], true],
  ])('%s: pill "%s" (%s), actions %j, linked %s', (status, pill, tone, actions, linked) => {
    const view = bookingRowView(booking(status), NOW);
    expect(view.pill).toBe(pill);
    expect(view.tone).toBe(tone);
    expect(view.actions.map((a) => a.label)).toEqual(actions);
    expect(view.linked).toBe(linked);
  });

  it.each([
    ['DriverCancelled', 'Cancelled'],
    ['PaymentTimeout', 'Cancelled \u2014 payment timed out'],
    ['PaymentFailed', 'Cancelled \u2014 payment failed'],
    ['SpotUnavailable', 'Cancelled \u2014 spot unavailable'],
    ['Other', 'Cancelled'],
    [null, 'Cancelled'],
  ] as const)('cancelReason %s gives the pill "%s"', (cancelReason, pill) => {
    expect(bookingRowView(booking('Cancelled', { cancelReason }), NOW).pill).toBe(pill);
  });

  it('shows "Pay by" for a Pending booking that is still due', () => {
    const due = new Date(2026, 9, 24, 12, 15).toISOString();
    expect(bookingRowView(booking('Pending', { paymentDueAt: due }), NOW).hint).toMatch(
      /^Pay by Today, \d{1,2}:15 (AM|PM)$/,
    );
  });

  it('shows "Payment time is up" once the due time has passed', () => {
    const due = new Date(2026, 9, 24, 11, 45).toISOString();
    expect(bookingRowView(booking('Pending', { paymentDueAt: due }), NOW).hint).toBe(
      'Payment time is up',
    );
  });

  it('has no hint without a due time, or on other statuses', () => {
    expect(bookingRowView(booking('Pending', { paymentDueAt: null }), NOW).hint).toBeNull();
    const due = new Date(2026, 9, 24, 12, 15).toISOString();
    expect(bookingRowView(booking('Confirmed', { paymentDueAt: due }), NOW).hint).toBeNull();
    expect(labels('Confirmed')).toEqual(['Check in', 'Cancel']);
  });
});
