import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DriverPaymentPending } from './driver-payment-pending';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

const NOW = new Date('2026-10-24T10:00:00Z');

function envelope<T>(data: T) {
  return { success: true, message: null, data, errors: null };
}

function httpError(status: number): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status }));
}

function booking(status: string, paymentDueAt: string | null = '2026-10-24T10:15:00Z') {
  return { bookingId: 'bk-1', lotId: 'lot-1', spotId: 'spot-1', status, paymentDueAt };
}

describe('DriverPaymentPending', () => {
  let fixture: ComponentFixture<DriverPaymentPending>;
  let el: HTMLElement;
  let bookingResult: () => Observable<unknown>;
  let lotResult: () => Observable<unknown>;
  let spotResult: () => Observable<unknown>;
  let bookingCalls: number;
  let auth: AuthService;
  let router: Router;

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const h1 = () => el.querySelector('h1') as HTMLElement;

  async function flush(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  async function setup(bookingId = 'bk-1'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DriverPaymentPending],
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
              if (path.startsWith('/api/bookings/')) {
                bookingCalls++;
                return bookingResult();
              }
              return path.includes('/lots/') ? lotResult() : spotResult();
            },
          },
        },
      ],
    }).compileComponents();
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(auth, 'clearSession');
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(DriverPaymentPending);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await flush();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    bookingCalls = 0;
    bookingResult = () => of(envelope(booking('Pending')));
    lotResult = () => of(envelope({ lotId: 'lot-1', name: 'Whitefield Central' }));
    spotResult = () => of(envelope({ spotId: 'spot-1', spotNumber: 'A-02' }));
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  describe('pending', () => {
    it('loads the booking and shows the lot and spot', async () => {
      await setup();
      expect(h1().textContent).toContain('Payment successful');
      expect(el.querySelector('.font-mono')?.textContent?.trim()).toBe('Whitefield Central · A-02');
      expect(text()).toContain('Pending');
      expect(bookingCalls).toBe(1);
    });

    it('falls back to "Your booking" when the lookups fail, and still polls', async () => {
      lotResult = () => httpError(500);
      await setup();
      expect(el.querySelector('.font-mono')?.textContent?.trim()).toBe('Your booking');
      await flush(2000);
      expect(bookingCalls).toBe(2);
    });

    it('falls back when the spot lookup fails', async () => {
      spotResult = () => httpError(404);
      await setup();
      expect(el.querySelector('.font-mono')?.textContent?.trim()).toBe('Your booking');
    });

    it('polls every 2 seconds, then moves to Confirmed and stops', async () => {
      await setup();
      await flush(2000);
      await flush(2000);
      expect(bookingCalls).toBe(3);

      bookingResult = () => of(envelope(booking('Confirmed', null)));
      await flush(2000);
      expect(bookingCalls).toBe(4);
      expect(h1().textContent?.trim()).toBe('Booking confirmed');
      expect(text()).toContain('Find more parking');
      expect(text()).not.toContain('View booking');
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Booking confirmed.');
      expect(document.activeElement).toBe(h1());

      await flush(20_000);
      expect(bookingCalls).toBe(4);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('shows the "still working" line and link after 60 seconds, and slows to 5 seconds', async () => {
      await setup();
      expect(text()).not.toContain('taking longer than usual');
      await flush(60_000);
      expect(text()).toContain('This is taking longer than usual');
      const link = Array.from(el.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Back to parking lots'),
      );
      expect(link?.getAttribute('href')).toBe('/lots');

      const before = bookingCalls;
      await flush(5000);
      expect(bookingCalls).toBe(before + 1);
    });
  });

  describe('other statuses', () => {
    it('shows Cancelled and stops polling', async () => {
      bookingResult = () => of(envelope(booking('Cancelled', null)));
      await setup();
      expect(h1().textContent?.trim()).toBe('This booking was cancelled');
      expect(text()).toContain('the amount will be refunded');
      expect(text()).toContain('Find parking');
      await flush(10_000);
      expect(bookingCalls).toBe(1);
    });

    it.each(['CheckedIn', 'Completed', 'NoShow'])('shows the neutral card for %s', async (status) => {
      bookingResult = () => of(envelope(booking(status, null)));
      await setup();
      expect(h1().textContent?.trim()).toBe('This booking is no longer waiting for payment');
      expect(text()).toContain('Find parking');
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('not found', () => {
    it.each([404, 403, 401])('shows the not-found state for %s without logging out', async (status) => {
      bookingResult = () => httpError(status);
      await setup();
      expect(h1().textContent?.trim()).toBe("We couldn't find this booking");
      expect(el.querySelector('.font-mono')).toBeNull();
      expect(auth.clearSession).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      await flush(10_000);
      expect(bookingCalls).toBe(1);
    });
  });

  describe('timeout', () => {
    it('stops at paymentDueAt and shows the timed-out message; Check again fetches once more', async () => {
      bookingResult = () =>
        of(envelope(booking('Pending', new Date(Date.now() + 5000).toISOString())));
      await setup();
      await flush(2000);
      await flush(2000);
      expect(h1().textContent).toContain('Payment successful');
      await flush(2000);

      expect(h1().textContent?.trim()).toBe('We could not confirm your booking yet');
      expect(text()).not.toContain('failed');
      const calls = bookingCalls;
      await flush(10_000);
      expect(bookingCalls).toBe(calls);

      const button = Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Check again'),
      ) as HTMLButtonElement;
      button.click();
      await flush();
      expect(bookingCalls).toBe(calls + 1);
      // Still Pending: polling restarts for another minute.
      expect(h1().textContent).toContain('Payment successful');
      await flush(2000);
      expect(bookingCalls).toBe(calls + 2);
    });

    it('uses a 5 minute limit when paymentDueAt is null', async () => {
      bookingResult = () => of(envelope(booking('Pending', null)));
      await setup();
      await flush(4 * 60_000);
      expect(h1().textContent).toContain('Payment successful');
      await flush(70_000);
      expect(h1().textContent?.trim()).toBe('We could not confirm your booking yet');
    });

    it('shows Confirmed if Check again finds it confirmed', async () => {
      bookingResult = () => of(envelope(booking('Pending', new Date(Date.now() - 1000).toISOString())));
      await setup();
      expect(h1().textContent).toContain('could not confirm');
      bookingResult = () => of(envelope(booking('Confirmed', null)));
      (el.querySelector('button') as HTMLButtonElement).click();
      await flush();
      expect(h1().textContent?.trim()).toBe('Booking confirmed');
    });
  });

  describe('errors while polling', () => {
    it('shows the banner after 3 failures in a row and hides it after a success', async () => {
      await setup();
      bookingResult = () => httpError(503);
      await flush(2000);
      await flush(2000);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      await flush(2000);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        "We're having trouble checking your booking. Retrying...",
      );

      bookingResult = () => of(envelope(booking('Pending')));
      await flush(2000);
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('keeps polling through network errors and 429', async () => {
      await setup();
      bookingResult = () => httpError(0);
      await flush(2000);
      bookingResult = () => httpError(429);
      await flush(2000);
      expect(h1().textContent).toContain('Payment successful');
      expect(bookingCalls).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('leaves no timers after the component is destroyed', async () => {
      await setup();
      await flush(2000);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
      const calls = bookingCalls;
      await flush(120_000);
      expect(bookingCalls).toBe(calls);
    });
  });

  it('shows not-found when the route has no booking id', async () => {
    await setup('');
    expect(h1().textContent?.trim()).toBe("We couldn't find this booking");
    expect(bookingCalls).toBe(0);
  });

  it('has a hidden polite status region and a decorative spinner', async () => {
    await setup();
    const status = el.querySelector('[role="status"]');
    expect(status?.classList).toContain('sr-only');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(h1().getAttribute('tabindex')).toBe('-1');
  });
});
