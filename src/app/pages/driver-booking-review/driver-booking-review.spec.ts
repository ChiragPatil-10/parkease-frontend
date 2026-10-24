import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DriverBookingReview } from './driver-booking-review';
import {
  computeAmount,
  formatDuration,
  nextQuarterHour,
  parseHours,
  toBookingStartTime,
} from './booking-review-format';
import { ApiService } from '../../services/api.service';
import {
  RazorpayCheckoutOptions,
  RazorpayLoader,
} from '../../services/razorpay-loader.service';

const NOW = new Date('2026-10-24T10:07:00Z');
const GOOD_QUERY = { spotId: 'spot-1', vehicleId: 'veh-1', hours: '3' };

const LOT = { lotId: 'lot-1', name: 'Whitefield Central Lot' };
const SPOT = {
  spotId: 'spot-1',
  lotId: 'lot-1',
  spotNumber: 'A-02',
  spotType: 'Standard',
  status: 'Available',
  pricePerHour: 40,
};
const VEHICLE = { vehicleId: 'veh-1', plateNumber: 'KA05MJ4471', isActive: true };
const BOOKING = { bookingId: 'bk-1', status: 'Pending' };
const PAYMENT = {
  paymentId: 'pay-1',
  bookingId: 'bk-1',
  status: 'Held',
  gatewayOrderId: 'order_123',
};

function envelope<T>(data: T) {
  return { success: true, message: null, data, errors: null };
}

function httpError(status: number, message: string | null = null): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: { message } }));
}

class FakeCheckout {
  static instances: FakeCheckout[] = [];
  readonly handlers: Record<string, () => void> = {};
  readonly open = vi.fn();

  constructor(readonly options: RazorpayCheckoutOptions) {
    FakeCheckout.instances.push(this);
  }

  on(event: string, callback: () => void): void {
    this.handlers[event] = callback;
  }
}

describe('DriverBookingReview', () => {
  let fixture: ComponentFixture<DriverBookingReview>;
  let el: HTMLElement;
  let router: Router;
  let query: Record<string, string>;
  let razorpayKey: string;
  let loader: { keyId: string; load: ReturnType<typeof vi.fn> };

  let lotResponse: () => Observable<unknown>;
  let spotResponse: () => Observable<unknown>;
  let vehiclesResponse: () => Observable<unknown>;
  let paymentResponse: () => Observable<unknown>;
  let bookingResponse: () => Observable<unknown>;
  let createResponse: () => Observable<unknown>;
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    FakeCheckout.instances = [];
    query = { ...GOOD_QUERY };
    razorpayKey = 'rzp_test_key';

    lotResponse = () => of(envelope(LOT));
    spotResponse = () => of(envelope(SPOT));
    vehiclesResponse = () => of(envelope([VEHICLE]));
    paymentResponse = () => of(envelope(PAYMENT));
    bookingResponse = () => of(envelope(BOOKING));
    createResponse = () => of(envelope(BOOKING));

    api = {
      get: vi.fn((path: string) => {
        if (path === '/api/v1/lots/lot-1') return lotResponse();
        if (path === '/api/v1/spots/spot-1') return spotResponse();
        if (path === '/api/vehicles/my') return vehiclesResponse();
        if (path === '/api/payments/booking/bk-1') return paymentResponse();
        if (path === '/api/bookings/bk-1') return bookingResponse();
        return httpError(404);
      }),
      post: vi.fn(() => createResponse()),
    };
    loader = {
      get keyId() {
        return razorpayKey;
      },
      load: vi.fn(() => Promise.resolve(FakeCheckout)),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Creates the page and lets the initial parallel load settle. */
  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DriverBookingReview],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: RazorpayLoader, useValue: loader },
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              paramMap: convertToParamMap({ lotId: 'lot-1' }),
              queryParamMap: convertToParamMap(query),
            },
          }),
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DriverBookingReview);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await flush();
  }

  async function flush(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  }

  function payButton(): HTMLButtonElement {
    return el.querySelector<HTMLButtonElement>('button[aria-busy]')!;
  }

  async function clickPay(): Promise<void> {
    payButton().click();
    await flush();
  }

  const text = () => el.textContent ?? '';
  const paymentCalls = () =>
    api.get.mock.calls.filter(([path]) => String(path).startsWith('/api/payments/')).length;
  const createBodies = () => api.post.mock.calls.map(([, body]) => body);

  function notFound(): Observable<never> {
    return httpError(404);
  }

  describe('inputs and loading', () => {
    it.each([
      ['missing spotId', { vehicleId: 'veh-1', hours: '3' }],
      ['missing vehicleId', { spotId: 'spot-1', hours: '3' }],
      ['missing hours', { spotId: 'spot-1', vehicleId: 'veh-1' }],
      ['hours 0', { ...GOOD_QUERY, hours: '0' }],
      ['hours 5', { ...GOOD_QUERY, hours: '5' }],
      ['fractional hours', { ...GOOD_QUERY, hours: '2.5' }],
      ['non-numeric hours', { ...GOOD_QUERY, hours: 'abc' }],
    ])('shows the bad link state for %s without calling the API', async (_name, params) => {
      query = params;
      await create();

      expect(text()).toContain('This booking link is not valid.');
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(api.get).not.toHaveBeenCalled();
    });

    it('shows a loading state while the requests are pending', async () => {
      const pending = new Subject<unknown>();
      lotResponse = () => pending;
      await create();

      expect(text()).toContain('Loading booking…');
    });

    it('renders the real lot, spot, vehicle, duration and amount', async () => {
      await create();

      const values = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
      expect([values[0], values[1], values[2], values[4]]).toEqual([
        'Whitefield Central Lot',
        'A-02 · Standard',
        'KA 05 MJ 4471',
        '3 hours',
      ]);
      expect(values[3]).toMatch(/^(Today|Tomorrow), \d{1,2}:\d{2} (AM|PM)$/);
      expect(text()).toContain('₹120');
      expect(payButton().textContent).toContain('Pay ₹120');
    });

    it('uses the singular for one hour', async () => {
      query = { ...GOOD_QUERY, hours: '1' };
      await create();

      expect(text()).toContain('1 hour');
      expect(text()).not.toContain('1 hours');
      expect(text()).toContain('₹40');
    });

    it('treats a 404 from any lookup as a bad link', async () => {
      spotResponse = notFound;
      await create();

      expect(text()).toContain('This booking link is not valid.');
    });

    it('treats a spot from another lot as a bad link', async () => {
      spotResponse = () => of(envelope({ ...SPOT, lotId: 'lot-2' }));
      await create();

      expect(text()).toContain('This booking link is not valid.');
    });

    it('treats a vehicle that is not in the driver list as a bad link', async () => {
      vehiclesResponse = () => of(envelope([{ ...VEHICLE, vehicleId: 'someone-else' }]));
      await create();

      expect(text()).toContain('This booking link is not valid.');
    });

    it('shows spot taken when the spot is not Available', async () => {
      spotResponse = () => of(envelope({ ...SPOT, status: 'Reserved' }));
      await create();

      expect(text()).toContain('This spot is no longer available.');
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(buttonByText('Razorpay')).toBeUndefined();
    });

    it('shows the generic error with Try again on a server error and reloads', async () => {
      lotResponse = () => httpError(500);
      await create();
      expect(text()).toContain('Something went wrong. Please try again.');

      lotResponse = () => of(envelope(LOT));
      buttonByText('Try again')!.click();
      await flush();
      expect(text()).toContain('Review your booking');
    });

    it('back control links to the spot picker', async () => {
      await create();

      expect(el.querySelector('a')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(el.querySelector('a')?.textContent).toContain('Back to spot picker');
    });
  });

  describe('payments not configured', () => {
    it('shows a banner and keeps Pay disabled', async () => {
      razorpayKey = '';
      await create();

      expect(text()).toContain('Payments are not configured.');
      expect(payButton().disabled).toBe(true);
      payButton().click();
      await flush();
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('creating the booking', () => {
    it('disables Pay with a busy label while running and ignores further clicks', async () => {
      const pending = new Subject<unknown>();
      createResponse = () => pending;
      await create();

      await clickPay();
      expect(payButton().disabled).toBe(true);
      expect(payButton().textContent).toContain('Processing…');

      payButton().click();
      el.querySelector<HTMLButtonElement>('button[aria-busy]')!.dispatchEvent(new Event('click'));
      await flush();
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('sends exactly the documented body with a rounded-up UTC start time and the amount', async () => {
      await create();
      await clickPay();

      expect(api.post).toHaveBeenCalledTimes(1);
      const [path, body] = api.post.mock.calls[0];
      expect(path).toBe('/api/bookings');
      expect(Object.keys(body as object).sort()).toEqual(
        ['idempotencyKey', 'lotId', 'spotId', 'startTime', 'totalAmount', 'vehicleId'].sort(),
      );
      expect(body).toMatchObject({
        lotId: 'lot-1',
        spotId: 'spot-1',
        vehicleId: 'veh-1',
        startTime: '2026-10-24T10:15:00Z',
        totalAmount: 120,
      });
      expect((body as { idempotencyKey: string }).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('creates one booking per visit across repeated clicks and retries, reusing the key', async () => {
      paymentResponse = notFound;
      await create();

      await clickPay();
      await flush(15_000);
      expect(text()).toContain('This is taking longer than expected.');

      buttonByText('Try again')!.click();
      await flush(15_000);
      expect(text()).toContain('This is taking longer than expected.');

      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('reuses the same idempotency key when create fails and is retried', async () => {
      createResponse = () => httpError(500);
      await create();

      await clickPay();
      expect(text()).toContain('Something went wrong. Please try again.');

      createResponse = () => of(envelope(BOOKING));
      buttonByText('Try again')!.click();
      await flush();

      expect(api.post).toHaveBeenCalledTimes(2);
      const [first, second] = createBodies() as { idempotencyKey: string }[];
      expect(second.idempotencyKey).toBe(first.idempotencyKey);
    });

    it('retries a still-processing 409 after 1s with the same key, up to 3 times, then fails', async () => {
      createResponse = () => httpError(409, 'A booking request with this idempotency key is already being processed.');
      await create();

      await clickPay();
      expect(api.post).toHaveBeenCalledTimes(1);
      await flush(1000);
      expect(api.post).toHaveBeenCalledTimes(2);
      await flush(1000);
      await flush(1000);
      expect(api.post).toHaveBeenCalledTimes(4);

      expect(text()).toContain('Something went wrong. Please try again.');
      const keys = new Set((createBodies() as { idempotencyKey: string }[]).map((b) => b.idempotencyKey));
      expect(keys.size).toBe(1);
    });

    it('continues once a retried 409 succeeds', async () => {
      let calls = 0;
      createResponse = () =>
        ++calls < 3
          ? httpError(409, 'A booking request with this idempotency key is already being processed.')
          : of(envelope(BOOKING));
      await create();

      await clickPay();
      await flush(2000);

      expect(api.post).toHaveBeenCalledTimes(3);
      expect(FakeCheckout.instances.length).toBe(1);
    });

    it('does not retry other 409 conflicts', async () => {
      createResponse = () => httpError(409, 'This vehicle is not active.');
      await create();

      await clickPay();
      await flush(5000);

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(text()).toContain('Something went wrong. Please try again.');
    });
  });

  describe('waiting for the payment order', () => {
    it('keeps polling through 404s, then opens Razorpay with the order id', async () => {
      let calls = 0;
      paymentResponse = () => (++calls <= 2 ? notFound() : of(envelope(PAYMENT)));
      await create();

      await clickPay();
      expect(FakeCheckout.instances.length).toBe(0);
      await flush(2000);

      expect(paymentCalls()).toBe(3);
      expect(FakeCheckout.instances.length).toBe(1);
      const checkout = FakeCheckout.instances[0];
      expect(checkout.options).toMatchObject({
        key: 'rzp_test_key',
        order_id: 'order_123',
        name: 'ParkEase',
        notes: { bookingId: 'bk-1' },
        prefill: {},
      });
      expect(checkout.open).toHaveBeenCalledTimes(1);
    });

    it('accepts any non-Failed status when an order id exists', async () => {
      paymentResponse = () => of(envelope({ ...PAYMENT, status: 'SomethingNew' }));
      await create();

      await clickPay();

      expect(FakeCheckout.instances.length).toBe(1);
    });

    it('shows payment failed with a link back when the status is Failed', async () => {
      paymentResponse = () =>
        of(envelope({ ...PAYMENT, status: 'Failed', gatewayOrderId: '', failureReason: 'x' }));
      await create();

      await clickPay();

      expect(text()).toContain('The payment could not be completed.');
      expect(el.querySelector('main a')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(payButton().disabled).toBe(true);
      expect(FakeCheckout.instances.length).toBe(0);
    });

    it('shows payment failed when the status is Failed even if an order id is present', async () => {
      paymentResponse = () => of(envelope({ ...PAYMENT, status: 'Failed' }));
      await create();

      await clickPay();

      expect(text()).toContain('The payment could not be completed.');
      expect(FakeCheckout.instances.length).toBe(0);
    });

    it('keeps polling a non-Failed payment with an empty order id until the timeout banner', async () => {
      paymentResponse = () => of(envelope({ ...PAYMENT, gatewayOrderId: '' }));
      await create();

      await clickPay();
      await flush(14_000);
      expect(text()).not.toContain('The payment could not be completed.');
      expect(text()).not.toContain('taking longer');
      await flush(1000);

      expect(paymentCalls()).toBe(16);
      expect(text()).toContain('This is taking longer than expected.');
      expect(text()).not.toContain('The payment could not be completed.');
      expect(FakeCheckout.instances.length).toBe(0);
    });

    it('opens Razorpay once a missing order id later appears', async () => {
      let calls = 0;
      paymentResponse = () =>
        of(envelope(++calls < 3 ? { ...PAYMENT, gatewayOrderId: undefined } : PAYMENT));
      await create();

      await clickPay();
      await flush(2000);

      expect(FakeCheckout.instances.length).toBe(1);
      expect(FakeCheckout.instances[0].options.order_id).toBe('order_123');
    });

    it('shows the taking-longer banner after 15 seconds and never opens Razorpay', async () => {
      paymentResponse = notFound;
      await create();

      await clickPay();
      await flush(14_000);
      expect(text()).not.toContain('taking longer');
      await flush(1000);

      expect(text()).toContain('This is taking longer than expected.');
      expect(paymentCalls()).toBe(16);
      expect(FakeCheckout.instances.length).toBe(0);
      expect(payButton().disabled).toBe(false);
    });

    it('Try again after a timeout restarts only the payment polling', async () => {
      let ready = false;
      paymentResponse = () => (ready ? of(envelope(PAYMENT)) : notFound());
      await create();
      await clickPay();
      await flush(15_000);

      ready = true;
      buttonByText('Try again')!.click();
      await flush();

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(FakeCheckout.instances.length).toBe(1);
    });

    it('shows spot taken and stops polling when the booking becomes Cancelled', async () => {
      paymentResponse = notFound;
      bookingResponse = () => of(envelope({ ...BOOKING, status: 'Cancelled' }));
      await create();

      await clickPay();
      await flush(2000);

      expect(text()).toContain('This spot is no longer available.');
      const calls = paymentCalls();
      await flush(10_000);
      expect(paymentCalls()).toBe(calls);
      expect(FakeCheckout.instances.length).toBe(0);
    });

    it('polls the booking every 2 seconds while waiting', async () => {
      paymentResponse = notFound;
      await create();

      await clickPay();
      await flush(6000);

      const bookingCalls = api.get.mock.calls.filter(([p]) => p === '/api/bookings/bk-1').length;
      expect(bookingCalls).toBe(3);
    });

    it('stops all polling when the component is destroyed', async () => {
      paymentResponse = notFound;
      await create();
      await clickPay();
      await flush(3000);

      const before = api.get.mock.calls.length;
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(api.get.mock.calls.length).toBe(before);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('Razorpay outcomes', () => {
    async function openCheckout(): Promise<FakeCheckout> {
      await create();
      await clickPay();
      return FakeCheckout.instances[0];
    }

    it('navigates to the payment pending page with replaceUrl on success', async () => {
      const checkout = await openCheckout();

      checkout.options.handler();

      expect(router.navigate).toHaveBeenCalledWith(['/bookings', 'bk-1', 'payment'], {
        replaceUrl: true,
      });
    });

    it('shows Retry payment when the window is dismissed and reopens the same order', async () => {
      const checkout = await openCheckout();

      checkout.options.modal.ondismiss();
      await flush();
      expect(text()).toContain('Payment was not completed.');
      expect(payButton().textContent).toContain('Retry payment');
      expect(payButton().disabled).toBe(false);

      await clickPay();

      expect(FakeCheckout.instances.length).toBe(2);
      expect(FakeCheckout.instances[1].options.order_id).toBe('order_123');
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(paymentCalls()).toBe(1);
    });

    it('shows payment failed with Retry payment on payment.failed', async () => {
      const checkout = await openCheckout();

      checkout.handlers['payment.failed']();
      await flush();

      expect(text()).toContain('The payment could not be completed.');
      expect(payButton().textContent).toContain('Retry payment');

      await clickPay();
      expect(FakeCheckout.instances.length).toBe(2);
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('keeps the payment failed message when the window is then dismissed', async () => {
      const checkout = await openCheckout();

      checkout.handlers['payment.failed']();
      checkout.options.modal.ondismiss();
      await flush();

      expect(text()).toContain('The payment could not be completed.');
      expect(text()).not.toContain('Payment was not completed.');
    });

    it('shows the generic error when checkout.js cannot load, then retries without a new booking', async () => {
      loader.load.mockRejectedValueOnce(new Error('offline'));
      await create();

      await clickPay();
      expect(text()).toContain('Something went wrong. Please try again.');

      buttonByText('Try again')!.click();
      await flush();

      expect(FakeCheckout.instances.length).toBe(1);
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('helpers', () => {
    it('parses hours 1-4 only', () => {
      expect(['1', '2', '3', '4'].map(parseHours)).toEqual([1, 2, 3, 4]);
      for (const bad of [null, '', '0', '5', '01', '2.5', '-1', 'abc', ' 2']) {
        expect(parseHours(bad)).toBeNull();
      }
    });

    it('formats the duration with a singular hour', () => {
      expect(formatDuration(1)).toBe('1 hour');
      expect(formatDuration(3)).toBe('3 hours');
    });

    it('computes the amount without float noise', () => {
      expect(computeAmount(40, 3)).toBe(120);
      expect(computeAmount(0.1, 3)).toBe(0.3);
      expect(computeAmount(22.5, 3)).toBe(67.5);
    });

    it.each([
      ['2026-10-24T10:00:00.000Z', '2026-10-24T10:00:00Z'],
      ['2026-10-24T10:00:00.001Z', '2026-10-24T10:15:00Z'],
      ['2026-10-24T10:07:00.000Z', '2026-10-24T10:15:00Z'],
      ['2026-10-24T10:14:59.999Z', '2026-10-24T10:15:00Z'],
      ['2026-10-24T10:15:00.000Z', '2026-10-24T10:15:00Z'],
      ['2026-10-24T10:45:01.000Z', '2026-10-24T11:00:00Z'],
      ['2026-10-24T23:50:00.000Z', '2026-10-25T00:00:00Z'],
    ])('rounds %s up to the next quarter hour as %s', (now, expected) => {
      expect(nextQuarterHour(new Date(now)).toISOString()).toBe(expected.replace('Z', '.000Z'));
      expect(toBookingStartTime(new Date(now))).toBe(expected);
    });
  });
});
