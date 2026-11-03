import { PaymentResponse, PaymentStatus } from '../../models/payment.model';
import {
  FAILED_PAYMENT_REASON,
  bookingStatusLabel,
  cancelledLabel,
  formatAmount,
  formatBookingTime,
  paymentCardView,
} from './booking-detail-format';

/** Local wall-clock time, so the expectations hold in any time zone. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (date: Date) => date.toISOString();

describe('formatBookingTime', () => {
  const now = local(2026, 10, 24, 12, 0);

  it('says Today, Tomorrow and Yesterday', () => {
    expect(formatBookingTime(iso(local(2026, 10, 24, 16, 30)), now)).toBe('Today, 4:30 PM');
    expect(formatBookingTime(iso(local(2026, 10, 25, 9, 5)), now)).toBe('Tomorrow, 9:05 AM');
    expect(formatBookingTime(iso(local(2026, 10, 23, 0, 0)), now)).toBe('Yesterday, 12:00 AM');
  });

  it('uses the local calendar day near midnight', () => {
    const lateNow = local(2026, 10, 24, 23, 55);
    expect(formatBookingTime(iso(local(2026, 10, 25, 0, 10)), lateNow)).toBe('Tomorrow, 12:10 AM');
    expect(formatBookingTime(iso(local(2026, 10, 24, 23, 59)), lateNow)).toBe('Today, 11:59 PM');
    const earlyNow = local(2026, 10, 24, 0, 5);
    expect(formatBookingTime(iso(local(2026, 10, 23, 23, 50)), earlyNow)).toBe('Yesterday, 11:50 PM');
  });

  it('shows weekday, day and month for other dates', () => {
    expect(formatBookingTime(iso(local(2026, 10, 26, 16, 30)), now)).toBe('Mon, 26 Oct, 4:30 PM');
    expect(formatBookingTime(iso(local(2026, 10, 20, 8, 0)), now)).toBe('Tue, 20 Oct, 8:00 AM');
  });

  it('adds the year only when it is not the current year', () => {
    expect(formatBookingTime(iso(local(2027, 1, 1, 9, 5)), now)).toBe('Fri, 1 Jan 2027, 9:05 AM');
    expect(formatBookingTime(iso(local(2025, 12, 31, 18, 0)), now)).toBe('Wed, 31 Dec 2025, 6:00 PM');
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(formatBookingTime('nonsense', now)).toBe('nonsense');
  });
});

describe('formatAmount', () => {
  it.each([
    [120, '₹120'],
    [75, '₹75'],
    [62.5, '₹62.50'],
    [0, '₹0'],
    [0.1 * 3, '₹0.30'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatAmount(amount)).toBe(expected);
  });
});

describe('bookingStatusLabel', () => {
  it('uses the display wording', () => {
    expect(bookingStatusLabel('CheckedIn')).toBe('Checked in');
    expect(bookingStatusLabel('NoShow')).toBe('No-show');
    expect(bookingStatusLabel('Confirmed')).toBe('Confirmed');
  });
});

describe('paymentCardView', () => {
  const NOW = local(2026, 10, 24, 12, 0);
  const paidAt = iso(local(2026, 10, 24, 16, 32));

  function payment(status: PaymentStatus, extra: Partial<PaymentResponse> = {}): PaymentResponse {
    return {
      paymentId: 'pay-1',
      bookingId: 'bk-1',
      driverId: 'd-1',
      amount: 120,
      status,
      gatewayOrderId: 'order_Nk3xR9Qp',
      failureReason: 'Raw gateway error: BAD_REQUEST_ERROR',
      createdAt: paidAt,
      updatedAt: paidAt,
      razorpayKeyId: 'rzp_test_secret',
      paidAt,
      ...extra,
    };
  }

  it.each<[PaymentStatus, string, string]>([
    ['Captured', 'Captured \u2014 paid', 'blue'],
    ['Held', 'Captured \u2014 paid', 'blue'],
    ['Refunded', 'Refunded', 'blue'],
    ['RefundFailed', 'Refund pending', 'red'],
  ])('%s shows the order and paid-at rows', (status, pill, tone) => {
    const view = paymentCardView(payment(status), 0, NOW);
    expect(view.pill).toBe(pill);
    expect(view.tone).toBe(tone);
    expect(view.amount).toBe('₹120');
    expect(view.orderId).toBe('order_Nk3xR9Qp');
    expect(view.paidAt).toBe('Today, 4:32 PM');
  });

  it('adds the refund notes', () => {
    expect(paymentCardView(payment('Refunded'), 0, NOW).note).toEqual({
      text: 'Your payment was refunded.',
      tone: 'muted',
    });
    expect(paymentCardView(payment('RefundFailed'), 0, NOW).note).toEqual({
      text: 'We could not refund you automatically. Support will refund you manually.',
      tone: 'red',
    });
  });

  it.each<[PaymentStatus, string]>([
    ['Created', 'Awaiting payment'],
    ['Voided', 'No payment taken'],
  ])('%s shows only the amount', (status, pill) => {
    const view = paymentCardView(payment(status, { gatewayOrderId: 'order_x', paidAt: null }), 0, NOW);
    expect(view.pill).toBe(pill);
    expect(view.tone).toBe('neutral');
    expect(view.orderId).toBeNull();
    expect(view.paidAt).toBeNull();
    expect(view.note).toBeNull();
  });

  it('Failed shows the fixed reason and never the API failureReason', () => {
    const view = paymentCardView(payment('Failed', { gatewayOrderId: '', paidAt: null }), 0, NOW);
    expect(view.pill).toBe('Failed');
    expect(view.tone).toBe('red');
    expect(view.reason).toBe(FAILED_PAYMENT_REASON);
    expect(JSON.stringify(view)).not.toContain('BAD_REQUEST_ERROR');
    expect(JSON.stringify(view)).not.toContain('rzp_test_secret');
  });

  it('omits rows without a value', () => {
    const view = paymentCardView(payment('Captured', { gatewayOrderId: '', paidAt: null }), 0, NOW);
    expect(view.orderId).toBeNull();
    expect(view.paidAt).toBeNull();
  });

  it('uses the booking amount when there is no payment', () => {
    const view = paymentCardView(null, 62.5, NOW);
    expect(view.pill).toBe('No payment taken');
    expect(view.amount).toBe('₹62.50');
  });
});

describe('cancelledLabel', () => {
  it.each([
    ['DriverCancelled', 'Cancelled'],
    ['PaymentTimeout', 'Cancelled \u2014 payment timed out'],
    ['PaymentFailed', 'Cancelled \u2014 payment failed'],
    ['SpotUnavailable', 'Cancelled \u2014 spot unavailable'],
    ['Other', 'Cancelled'],
    [null, 'Cancelled'],
    [undefined, 'Cancelled'],
  ] as const)('%s reads "%s"', (reason, expected) => {
    expect(cancelledLabel(reason)).toBe(expected);
  });

  it('never shows an unknown code', () => {
    expect(cancelledLabel('SomethingNew' as never)).toBe('Cancelled');
  });
});
