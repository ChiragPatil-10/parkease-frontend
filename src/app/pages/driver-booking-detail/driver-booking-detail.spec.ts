import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DriverBookingDetail } from './driver-booking-detail';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

const NOW = new Date('2026-10-24T10:00:00Z');

function envelope<T>(data: T, message: string | null = null) {
  return { success: true, message, data, errors: null };
}

function httpError(status: number, message: string | null = null): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: { message } }));
}

function booking(status: string, extra: Record<string, unknown> = {}) {
  return {
    bookingId: 'bk-1',
    lotId: 'lot-1',
    spotId: 'spot-1',
    vehicleId: 'veh-1',
    startTime: NOW.toISOString(),
    totalAmount: 120,
    status,
    ...extra,
  };
}

function payment(status: string, extra: Record<string, unknown> = {}) {
  return {
    paymentId: 'pay-1',
    bookingId: 'bk-1',
    amount: 120,
    status,
    gatewayOrderId: 'order_Nk3xR9Qp',
    failureReason: 'RAW_GATEWAY_ERROR',
    razorpayKeyId: 'rzp_test_secret',
    paidAt: NOW.toISOString(),
    ...extra,
  };
}

describe('DriverBookingDetail', () => {
  let fixture: ComponentFixture<DriverBookingDetail>;
  let el: HTMLElement;
  let router: Router;
  let auth: AuthService;

  let bookingResult: () => Observable<unknown>;
  let lotResult: () => Observable<unknown>;
  let spotResult: () => Observable<unknown>;
  let vehicleResult: () => Observable<unknown>;
  let paymentResult: () => Observable<unknown>;
  let checkInResult: () => Observable<unknown>;
  let checkOutResult: () => Observable<unknown>;
  let cancelResult: () => Observable<unknown>;
  let gets: string[];
  let posts: { path: string; body: unknown }[];

  const count = (path: string) => gets.filter((p) => p === path).length;
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const h1 = () => el.querySelector('h1') as HTMLElement;
  const main = () => el.querySelector('main') as HTMLElement;
  const buttonLabels = () =>
    Array.from(main().querySelectorAll('button, a'))
      .map((n) => n.textContent?.trim())
      .filter((t) => !!t);
  const find = (selector: string, label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(selector)).find((n) =>
      n.textContent?.includes(label),
    );
  const dialog = () => el.querySelector('[role="dialog"]') as HTMLElement | null;
  const mono = (value: string) =>
    Array.from(el.querySelectorAll('.font-mono')).some((n) => n.textContent?.trim() === value);

  async function flush(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  async function setup(bookingId = 'bk-1'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DriverBookingDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ bookingId }) } },
        },
        {
          provide: ApiService,
          useValue: {
            get: (path: string) => {
              gets.push(path);
              if (path === '/api/bookings/bk-1') return bookingResult();
              if (path === '/api/v1/lots/lot-1') return lotResult();
              if (path === '/api/v1/spots/spot-1') return spotResult();
              if (path === '/api/vehicles/veh-1') return vehicleResult();
              if (path === '/api/payments/booking/bk-1') return paymentResult();
              return httpError(404);
            },
            post: (path: string, body: unknown) => {
              posts.push({ path, body });
              if (path.endsWith('/checkin')) return checkInResult();
              if (path.endsWith('/checkout')) return checkOutResult();
              return cancelResult();
            },
          },
        },
      ],
    }).compileComponents();
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(auth, 'clearSession');
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(DriverBookingDetail);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await flush();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    gets = [];
    posts = [];
    bookingResult = () => of(envelope(booking('Confirmed')));
    lotResult = () => of(envelope({ lotId: 'lot-1', name: 'Whitefield Central Lot' }));
    spotResult = () => of(envelope({ spotId: 'spot-1', spotNumber: 'A-02', spotType: 'Standard' }));
    vehicleResult = () => of(envelope({ vehicleId: 'veh-1', plateNumber: 'KA05MJ4471' }));
    paymentResult = () => of(envelope(payment('Captured')));
    checkInResult = () => of(envelope(booking('CheckedIn')));
    checkOutResult = () => of(envelope(booking('CheckedIn')));
    cancelResult = () => of(envelope(booking('Confirmed')));
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  describe('loading and lookups', () => {
    it('shows the real booking, lot, spot, vehicle and payment', async () => {
      await setup();
      expect(h1().textContent?.trim()).toBe('Whitefield Central Lot');
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(text()).toContain('Today,');
      expect(text()).toContain('Confirmed');
      expect(mono('A-02 · Standard')).toBe(true);
      expect(mono('KA 05 MJ 4471')).toBe(true);
      expect(mono('₹120')).toBe(true);
      expect(mono('order_Nk3xR9Qp')).toBe(true);
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Payment');
      expect(text()).toContain('Captured — paid');
      expect(text()).toContain('Paid at');
    });

    it('shows a loading state, not the not-found view, until the booking arrives', async () => {
      const pending = new Subject<unknown>();
      bookingResult = () => pending;
      await setup();
      expect(main().getAttribute('aria-busy')).toBe('true');
      expect(text()).not.toContain('not found');
      pending.next(envelope(booking('Confirmed')));
      pending.complete();
      await flush();
      expect(h1().textContent?.trim()).toBe('Whitefield Central Lot');
    });

    it('falls back to "Your booking" when the lot lookup fails', async () => {
      lotResult = () => httpError(500);
      await setup();
      expect(h1().textContent?.trim()).toBe('Your booking');
      expect(buttonLabels()).toContain('Check in');
    });

    it('shows "Not available" when the spot or vehicle lookup fails', async () => {
      spotResult = () => httpError(404);
      vehicleResult = () => httpError(401);
      await setup();
      expect(text()).toContain('Spot Not available');
      expect(text()).toContain('Vehicle Not available');
      expect(text()).toContain('Captured — paid');
    });

    it('treats a payment 404 as "no payment"', async () => {
      paymentResult = () => httpError(404);
      await setup();
      expect(text()).toContain('No payment taken');
      expect(mono('₹120')).toBe(true);
    });

    it('shows a muted line for other payment errors', async () => {
      paymentResult = () => httpError(500);
      await setup();
      expect(text()).toContain('Payment details are not available right now.');
      expect(text()).not.toContain('No payment taken');
      expect(buttonLabels()).toContain('Check in');
    });

    it('marks My Bookings active and not a link', async () => {
      await setup();
      const item = Array.from(el.querySelectorAll('nav > *')).find((n) =>
        n.textContent?.includes('My Bookings'),
      ) as HTMLElement;
      expect(item.tagName).toBe('SPAN');
      expect(item.classList).toContain('text-ink');
    });
  });

  describe('Pending', () => {
    it('redirects to the payment page with replaceUrl and renders nothing', async () => {
      bookingResult = () => of(envelope(booking('Pending')));
      await setup();
      expect(router.navigate).toHaveBeenCalledWith(['/bookings', 'bk-1', 'payment'], {
        replaceUrl: true,
      });
      expect(el.querySelector('h2')).toBeNull();
      expect(count('/api/v1/lots/lot-1')).toBe(0);
    });
  });

  describe('views by status', () => {
    it('Confirmed has Check in and Cancel booking', async () => {
      await setup();
      expect(buttonLabels()).toEqual(['Check in', 'Cancel booking']);
    });

    it('CheckedIn has only Check out and the no-cancel note', async () => {
      bookingResult = () => of(envelope(booking('CheckedIn')));
      await setup();
      expect(buttonLabels()).toEqual(['Check out']);
      expect(text()).toContain('Cancelling is not available after check-in.');
      expect(text()).toContain('Checked in');
    });

    it.each([
      ['Completed', 'Completed'],
      ['Cancelled', 'Cancelled'],
      ['NoShow', 'No-show'],
    ])('%s has only Book again, linking to the lot', async (status, label) => {
      bookingResult = () => of(envelope(booking(status)));
      paymentResult = () => of(envelope(payment('Refunded')));
      await setup();
      expect(buttonLabels()).toEqual(['Book again']);
      expect(find('a', 'Book again')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(text()).toContain(label);
    });
  });

  describe('payment card', () => {
    const cases: [string, string, boolean][] = [
      ['Captured', 'Captured — paid', true],
      ['Held', 'Captured — paid', true],
      ['Created', 'Awaiting payment', false],
      ['Refunded', 'Refunded', true],
      ['RefundFailed', 'Refund pending', true],
      ['Voided', 'No payment taken', false],
      ['Failed', 'Failed', false],
    ];

    it.each(cases)('%s shows "%s"', async (status, pill, hasOrder) => {
      paymentResult = () => of(envelope(payment(status, status === 'Failed' ? { gatewayOrderId: '' } : {})));
      await setup();
      const card = el.querySelector('h2')!.parentElement as HTMLElement;
      expect(card.textContent).toContain(pill);
      expect(card.textContent?.includes('order_Nk3xR9Qp')).toBe(hasOrder);
      expect(card.textContent?.includes('Paid at')).toBe(hasOrder);
      expect(el.textContent).not.toContain('RAW_GATEWAY_ERROR');
      expect(el.textContent).not.toContain('rzp_test_secret');
    });

    it('Failed shows the fixed reason in red', async () => {
      paymentResult = () => of(envelope(payment('Failed', { gatewayOrderId: '' })));
      await setup();
      const reason = find('dd', "We couldn't set up the payment for this booking.");
      expect(reason?.classList).toContain('text-red-700');
    });

    it('Refunded and RefundFailed show their notes', async () => {
      paymentResult = () => of(envelope(payment('Refunded')));
      await setup();
      expect(text()).toContain('Your payment was refunded.');
    });

    it('RefundFailed shows the red manual-refund note', async () => {
      paymentResult = () => of(envelope(payment('RefundFailed')));
      await setup();
      const note = find('p', 'Support will refund you manually.');
      expect(note?.classList).toContain('text-red-700');
    });
  });

  describe('load errors', () => {
    it.each([404, 403, 401, 400])('%s shows the not-found view without logging out', async (status) => {
      bookingResult = () => httpError(status);
      await setup();
      expect(h1().textContent?.trim()).toBe('Booking not found or not accessible');
      expect(el.querySelector('h2')).toBeNull();
      expect(find('a', 'Back to parking lots')?.getAttribute('href')).toBe('/lots');
      expect(auth.clearSession).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(count('/api/bookings/bk-1')).toBe(1);
    });

    it('shows not-found without any request when the route has no id', async () => {
      await setup('');
      expect(h1().textContent).toContain('not found');
      expect(gets).toEqual([]);
    });

    it.each([0, 500, 429])('%s shows a banner with Try again, then recovers', async (status) => {
      bookingResult = () => httpError(status);
      await setup();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Try again');
      expect(text()).not.toContain('not found');
      expect(el.querySelectorAll('h1').length).toBe(1);

      bookingResult = () => of(envelope(booking('Confirmed')));
      (find('button', 'Try again') as HTMLButtonElement).click();
      await flush();
      expect(h1().textContent?.trim()).toBe('Whitefield Central Lot');
    });
  });

  describe('check in', () => {
    it('updates the view from the response', async () => {
      await setup();
      (find('button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(posts).toEqual([{ path: '/api/bookings/bk-1/checkin', body: {} }]);
      expect(buttonLabels()).toEqual(['Check out']);
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Checked in.');
    });

    it('disables the button while running and ignores double clicks', async () => {
      const pending = new Subject<unknown>();
      checkInResult = () => pending;
      await setup();
      const button = find('button', 'Check in') as HTMLButtonElement;
      button.click();
      button.click();
      fixture.detectChanges();
      expect(posts.length).toBe(1);
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Checking in…');
    });

    it('shows the server message on 409 and reloads the booking', async () => {
      checkInResult = () => httpError(409, 'The spot could not be occupied.');
      await setup();
      const before = count('/api/bookings/bk-1');
      (find('button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'The spot could not be occupied.',
      );
      expect(count('/api/bookings/bk-1')).toBe(before + 1);
    });

    it('clears the session and goes to login on 401', async () => {
      checkInResult = () => httpError(401);
      await setup();
      (find('button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it.each([0, 500, 429])('shows a generic banner on %s and keeps the button usable', async (status) => {
      checkInResult = () => httpError(status);
      await setup();
      (find('button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'Something went wrong. Please try again.',
      );
      expect((find('button', 'Check in') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('check out', () => {
    beforeEach(() => {
      bookingResult = () => of(envelope(booking('CheckedIn')));
    });

    it('polls every 2 seconds until Completed, then shows the Completed view and focuses the h1', async () => {
      await setup();
      (find('button', 'Check out') as HTMLButtonElement).click();
      await flush();
      expect(posts[0].path).toBe('/api/bookings/bk-1/checkout');
      expect(text()).toContain('Checking out...');
      expect(buttonLabels()).toEqual([]);
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Checking out.');

      const before = count('/api/bookings/bk-1');
      await flush(2000);
      await flush(2000);
      expect(count('/api/bookings/bk-1')).toBe(before + 2);

      bookingResult = () => of(envelope(booking('Completed')));
      await flush(2000);
      expect(buttonLabels()).toEqual(['Book again']);
      expect(text()).not.toContain('Checking out...');
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Booking completed.');
      expect(document.activeElement).toBe(h1());

      const after = count('/api/bookings/bk-1');
      await flush(20_000);
      expect(count('/api/bookings/bk-1')).toBe(after);
    });

    it('stops after 60 seconds and shows the taking-longer line', async () => {
      await setup();
      (find('button', 'Check out') as HTMLButtonElement).click();
      await flush();
      await flush(58_000);
      expect(text()).not.toContain('taking longer than usual');
      await flush(2000);
      expect(text()).toContain('This is taking longer than usual. Please refresh in a moment.');
      const calls = count('/api/bookings/bk-1');
      await flush(30_000);
      expect(count('/api/bookings/bk-1')).toBe(calls);
    });

    it('keeps polling through poll errors', async () => {
      await setup();
      (find('button', 'Check out') as HTMLButtonElement).click();
      await flush();
      bookingResult = () => httpError(503);
      await flush(2000);
      bookingResult = () => of(envelope(booking('Completed')));
      await flush(2000);
      expect(buttonLabels()).toEqual(['Book again']);
    });

    it('401 on checkout clears the session', async () => {
      checkOutResult = () => httpError(401);
      await setup();
      (find('button', 'Check out') as HTMLButtonElement).click();
      await flush();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });
  });

  describe('cancel', () => {
    async function openDialog(): Promise<HTMLButtonElement> {
      const button = find('button', 'Cancel booking') as HTMLButtonElement;
      button.click();
      await flush();
      return button;
    }

    it('opens an accessible dialog with the refund text', async () => {
      await setup();
      await openDialog();
      const d = dialog()!;
      expect(d.getAttribute('aria-modal')).toBe('true');
      const title = el.querySelector(`#${d.getAttribute('aria-labelledby')}`);
      expect(title?.textContent?.trim()).toBe('Cancel this booking?');
      expect(d.textContent).toContain(
        'Your payment of ₹120 will be refunded to your original payment method.',
      );
      expect(d.textContent).toContain('Keep booking');
      expect(d.contains(document.activeElement)).toBe(true);
    });

    it('uses the plain text when the payment is not Captured or Held', async () => {
      paymentResult = () => httpError(404);
      await setup();
      await openDialog();
      expect(dialog()!.textContent).toContain('This booking will be cancelled.');
      expect(dialog()!.textContent).not.toContain('refunded');
    });

    it('Escape closes it and focus returns to the Cancel button', async () => {
      await setup();
      const button = await openDialog();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await flush();
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(button);
      expect(posts.length).toBe(0);
    });

    it('Keep booking closes it', async () => {
      await setup();
      await openDialog();
      (find('[role="dialog"] button', 'Keep booking') as HTMLButtonElement).click();
      await flush();
      expect(dialog()).toBeNull();
      expect(posts.length).toBe(0);
    });

    it('confirm sends the fixed reason, then polls until Cancelled', async () => {
      await setup();
      await openDialog();
      (find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).click();
      await flush();
      expect(posts).toEqual([
        { path: '/api/bookings/bk-1/cancel', body: { reason: 'Cancelled by driver' } },
      ]);
      expect(dialog()).toBeNull();
      expect(text()).toContain('Cancelling...');
      expect(buttonLabels()).toEqual([]);
      expect(el.querySelector('[role="status"]')?.textContent).toContain(
        'Cancellation in progress.',
      );

      paymentResult = () => of(envelope(payment('Refunded')));
      bookingResult = () => of(envelope(booking('Cancelled')));
      await flush(2000);
      expect(buttonLabels()).toEqual(['Book again']);
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Booking cancelled.');
      expect(document.activeElement).toBe(h1());
    });

    it('stops polling after 60 seconds with the taking-longer line', async () => {
      await setup();
      await openDialog();
      (find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).click();
      await flush();
      await flush(60_000);
      expect(text()).toContain('This is taking longer than usual. Please refresh in a moment.');
      const calls = count('/api/bookings/bk-1');
      await flush(20_000);
      expect(count('/api/bookings/bk-1')).toBe(calls);
    });

    it('sends only one request on a double click and disables the buttons', async () => {
      const pending = new Subject<unknown>();
      cancelResult = () => pending;
      await setup();
      await openDialog();
      const confirm = find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement;
      confirm.click();
      confirm.click();
      fixture.detectChanges();
      expect(posts.length).toBe(1);
      expect(confirm.disabled).toBe(true);
      expect(confirm.textContent).toContain('Cancelling…');
    });

    it('409 shows the message inside the dialog and reloads the booking', async () => {
      cancelResult = () => httpError(409, 'Cannot cancel after check-in.');
      await setup();
      const before = count('/api/bookings/bk-1');
      await openDialog();
      (find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain(
        'Cannot cancel after check-in.',
      );
      expect(count('/api/bookings/bk-1')).toBe(before + 1);
    });

    it('401 clears the session', async () => {
      cancelResult = () => httpError(401);
      await setup();
      await openDialog();
      (find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('a 500 keeps the dialog open with a usable button', async () => {
      cancelResult = () => httpError(500);
      await setup();
      await openDialog();
      (find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain(
        'Something went wrong. Please try again.',
      );
      expect((find('[role="dialog"] button', 'Yes, cancel booking') as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });

  describe('refund catch-up', () => {
    beforeEach(() => {
      bookingResult = () => of(envelope(booking('Cancelled')));
      paymentResult = () => of(envelope(payment('Captured')));
    });

    it('re-fetches the payment every 3 seconds, at most 10 times', async () => {
      await setup();
      expect(count('/api/payments/booking/bk-1')).toBe(1);
      await flush(3000);
      expect(count('/api/payments/booking/bk-1')).toBe(2);
      await flush(60_000);
      expect(count('/api/payments/booking/bk-1')).toBe(11);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops as soon as the status changes', async () => {
      await setup();
      paymentResult = () => of(envelope(payment('Refunded')));
      await flush(3000);
      expect(text()).toContain('Refunded');
      expect(text()).toContain('Your payment was refunded.');
      await flush(30_000);
      expect(count('/api/payments/booking/bk-1')).toBe(2);
    });

    it('does not poll when the payment is already settled', async () => {
      paymentResult = () => of(envelope(payment('Refunded')));
      await setup();
      await flush(30_000);
      expect(count('/api/payments/booking/bk-1')).toBe(1);
    });

    it('stops on destroy', async () => {
      await setup();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
      const calls = count('/api/payments/booking/bk-1');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(count('/api/payments/booking/bk-1')).toBe(calls);
    });
  });

  describe('cleanup', () => {
    it('leaves no timers after destroy while polling', async () => {
      bookingResult = () => of(envelope(booking('CheckedIn')));
      await setup();
      (find('button', 'Check out') as HTMLButtonElement).click();
      await flush();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('has a hidden polite status region', async () => {
    await setup();
    const status = el.querySelector('[role="status"]');
    expect(status?.classList).toContain('sr-only');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(h1().getAttribute('tabindex')).toBe('-1');
  });
});
