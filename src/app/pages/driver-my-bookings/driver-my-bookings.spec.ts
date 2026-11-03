import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DriverMyBookings } from './driver-my-bookings';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

const NOW = new Date('2026-10-24T10:00:00Z');

function envelope<T>(data: T) {
  return { success: true, message: null, data, errors: null };
}

function httpError(status: number, message: string | null = null): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: { message } }));
}

/** A booking with a complete snapshot; pass nulls to exercise the fallbacks. */
function booking(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    bookingId: id,
    lotId: `lot-${id}`,
    spotId: `spot-${id}`,
    vehicleId: `veh-${id}`,
    startTime: NOW.toISOString(),
    totalAmount: 120,
    status,
    paymentDueAt: null,
    cancelReason: null,
    lotName: `Lot ${id}`,
    spotNumber: `S-${id}`,
    spotType: 'Standard',
    plateNumber: 'KA05MJ4471',
    ...extra,
  };
}

describe('DriverMyBookings', () => {
  let fixture: ComponentFixture<DriverMyBookings>;
  let el: HTMLElement;
  let router: Router;
  let auth: AuthService;

  let listResult: () => Observable<unknown>;
  let byId: Record<string, () => Observable<unknown>>;
  let lotResult: (id: string) => Observable<unknown>;
  let spotResult: (id: string) => Observable<unknown>;
  let vehiclesResult: () => Observable<unknown>;
  let postResult: Record<string, () => Observable<unknown>>;
  let gets: string[];
  let posts: { path: string; body: unknown }[];

  const count = (prefix: string) => gets.filter((p) => p.startsWith(prefix)).length;
  const text = (node: Element = el) => node.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('main ul > li'));
  const row = (id: string) => el.querySelector(`[data-booking="${id}"]`) as HTMLElement;
  const labels = (r: HTMLElement) =>
    Array.from(r.querySelectorAll('button, a:not([data-title])')).map((n) => n.textContent?.trim());
  const find = (scope: ParentNode, selector: string, label: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(selector)).find((n) =>
      n.textContent?.includes(label),
    );
  const dialog = () => el.querySelector('[role="dialog"]') as HTMLElement | null;
  const status = () => el.querySelector('[role="status"]')?.textContent ?? '';

  async function flush(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DriverMyBookings],
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            get: (path: string) => {
              gets.push(path);
              if (path === '/api/bookings/my') return listResult();
              if (path === '/api/vehicles/my') return vehiclesResult();
              if (path.startsWith('/api/v1/lots/')) return lotResult(path.split('/').pop()!);
              if (path.startsWith('/api/v1/spots/')) return spotResult(path.split('/').pop()!);
              const id = path.split('/').pop()!;
              return byId[id] ? byId[id]() : httpError(404);
            },
            post: (path: string, body: unknown) => {
              posts.push({ path, body });
              return postResult[path.split('/').pop()!]();
            },
          },
        },
      ],
    }).compileComponents();
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(auth, 'clearSession');
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(DriverMyBookings);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await flush();
  }

  function respondWith(...bookings: ReturnType<typeof booking>[]) {
    listResult = () => of(envelope(bookings));
    byId = Object.fromEntries(bookings.map((b) => [b.bookingId, () => of(envelope(b))]));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    gets = [];
    posts = [];
    byId = {};
    respondWith(booking('1', 'Confirmed'));
    lotResult = (id) => of(envelope({ lotId: id, name: `Looked-up ${id}` }));
    spotResult = (id) => of(envelope({ spotId: id, spotNumber: `L-${id}` }));
    vehiclesResult = () => of(envelope([{ vehicleId: 'veh-1', plateNumber: 'KA01AB9922' }]));
    postResult = {
      checkin: () => of(envelope(booking('1', 'CheckedIn'))),
      checkout: () => of(envelope(booking('1', 'CheckedIn'))),
      cancel: () => of(envelope(booking('1', 'Confirmed'))),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  describe('loading the list', () => {
    it('shows the snapshot values without any lookup calls', async () => {
      respondWith(booking('1', 'Confirmed'), booking('2', 'Completed'));
      await setup();
      expect(rows().length).toBe(2);
      expect(text(row('1'))).toContain('Lot 1');
      expect(text(row('1'))).toContain('Today,');
      expect(text(row('1'))).toContain('KA 05 MJ 4471');
      expect(row('1').querySelector('.font-mono')?.textContent?.trim()).toBe('S-1');
      expect(gets).toEqual(['/api/bookings/my']);
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('My bookings');
    });

    it('keeps the order the server sent', async () => {
      respondWith(booking('b', 'Confirmed'), booking('a', 'Completed'), booking('c', 'Pending'));
      await setup();
      expect(rows().map((r) => r.dataset['booking'])).toEqual(['b', 'a', 'c']);
    });

    it('shows placeholders, not the empty view, while loading', async () => {
      const pending = new Subject<unknown>();
      listResult = () => pending;
      await setup();
      expect(el.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
      expect(el.querySelectorAll('main ul > li').length).toBe(3);
      expect(text()).not.toContain('No bookings yet');
      expect(status()).toContain('Loading bookings.');
      pending.next(envelope([booking('1', 'Confirmed')]));
      pending.complete();
      await flush();
      expect(rows().length).toBe(1);
    });

    it('shows the empty view for zero bookings', async () => {
      respondWith();
      await setup();
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('No bookings yet');
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('ul')).toBeNull();
      const link = find(el, 'main a', 'Find a spot near you');
      expect(link?.getAttribute('href')).toBe('/lots');
    });

    it('a first-load 429 shows no banner and a neutral Retry that reloads', async () => {
      listResult = () => httpError(429);
      await setup();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(text()).not.toContain("We couldn't load your bookings.");
      expect(text()).not.toContain('No bookings yet');
      expect(el.querySelector('[data-rate-limited]')?.textContent).toContain(
        "Couldn't load this right now.",
      );
      await flush(10_000);
      expect(count('/api/bookings/my')).toBe(1);

      respondWith(booking('1', 'Confirmed'));
      (find(el, 'button', 'Retry') as HTMLButtonElement).click();
      await flush();
      expect(rows().length).toBe(1);
      expect(el.querySelector('[data-rate-limited]')).toBeNull();
    });

    it('a 429 on a reload keeps the bookings on screen with no banner', async () => {
      await setup();
      expect(rows().length).toBe(1);

      listResult = () => httpError(429);
      (fixture.componentInstance as unknown as { load(): void }).load();
      await flush();

      expect(rows().length).toBe(1);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.querySelector('[data-rate-limited]')).toBeNull();
    });

    it.each([0, 500])('shows the banner on %s and Try again reloads', async (code) => {
      listResult = () => httpError(code);
      await setup();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        "We couldn't load your bookings.",
      );
      expect(text()).not.toContain('No bookings yet');
      await flush(10_000);
      expect(count('/api/bookings/my')).toBe(1);

      respondWith(booking('1', 'Confirmed'));
      (find(el, 'button', 'Try again') as HTMLButtonElement).click();
      await flush();
      expect(rows().length).toBe(1);
    });

    it('clears the session and goes to login on 401', async () => {
      listResult = () => httpError(401);
      await setup();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('links My Bookings in the nav as the active item', async () => {
      await setup();
      const item = find(el, 'nav > *', 'My Bookings') as HTMLElement;
      expect(item.tagName).toBe('A');
      expect(item.getAttribute('href')).toBe('/bookings');
      expect(item.classList).toContain('text-ink');
    });
  });

  describe('fallback lookups', () => {
    const old = (id: string, extra: Record<string, unknown> = {}) =>
      booking(id, 'Completed', {
        lotName: null,
        spotNumber: null,
        spotType: null,
        plateNumber: null,
        ...extra,
      });

    it('fills null snapshot values from lookups, one call per distinct id', async () => {
      respondWith(
        old('1', { lotId: 'lot-x', spotId: 'spot-1', vehicleId: 'veh-1' }),
        old('2', { lotId: 'lot-x', spotId: 'spot-2', vehicleId: 'veh-1' }),
      );
      await setup();
      expect(count('/api/v1/lots/')).toBe(1);
      expect(count('/api/v1/spots/')).toBe(2);
      expect(count('/api/vehicles/my')).toBe(1);
      expect(text(row('1'))).toContain('Looked-up lot-x');
      expect(row('1').querySelector('.font-mono')?.textContent?.trim()).toBe('L-spot-1');
      expect(text(row('1'))).toContain('KA 01 AB 9922');
      expect(text(row('2'))).toContain('Looked-up lot-x');
    });

    it('only looks up the null values and skips /vehicles/my when every plate is known', async () => {
      respondWith(booking('1', 'Completed', { lotName: null }));
      await setup();
      expect(count('/api/v1/lots/')).toBe(1);
      expect(count('/api/v1/spots/')).toBe(0);
      expect(count('/api/vehicles/my')).toBe(0);
    });

    it('falls back to "Booking", "?" and no plate when the lookups fail', async () => {
      respondWith(old('1'));
      lotResult = () => httpError(500);
      spotResult = () => httpError(404);
      vehiclesResult = () => httpError(500);
      await setup();
      expect(rows().length).toBe(1);
      expect(text(row('1'))).toContain('Booking');
      expect(row('1').querySelector('.font-mono')?.textContent?.trim()).toBe('?');
      expect(row('1').querySelectorAll('.font-mono').length).toBe(1);
      expect(labels(row('1'))).toEqual(['View receipt']);
    });

    it('has a plate-less row when the vehicle is not in /vehicles/my', async () => {
      respondWith(old('1', { vehicleId: 'unknown' }));
      await setup();
      expect(row('1').querySelectorAll('.font-mono').length).toBe(1);
    });

    it('runs at most 4 lookups at once and starts the next as one finishes', async () => {
      respondWith(
        ...Array.from({ length: 8 }, (_, i) =>
          booking(`${i + 1}`, 'Completed', { lotName: null }),
        ),
      );
      const open: Subject<unknown>[] = [];
      let inFlight = 0;
      let started = 0;
      let peak = 0;
      lotResult = () => {
        const subject = new Subject<unknown>();
        return new Observable((subscriber) => {
          open.push(subject);
          started++;
          inFlight++;
          peak = Math.max(peak, inFlight);
          const inner = subject.subscribe(subscriber);
          return () => {
            inFlight--;
            inner.unsubscribe();
          };
        });
      };
      await setup();
      expect(inFlight).toBe(4);
      expect(started).toBe(4);
      open[0].next(envelope({ name: 'Done' }));
      open[0].complete();
      await flush();
      expect(started).toBe(5);
      expect(peak).toBe(4);
    });

    it('does lookups only for visible rows, and for the next page once it is shown', async () => {
      respondWith(
        ...Array.from({ length: 12 }, (_, i) =>
          booking(`${i + 1}`, 'Completed', { lotName: null }),
        ),
      );
      await setup();
      expect(rows().length).toBe(10);
      expect(count('/api/v1/lots/')).toBe(10);
      (find(el, 'button', 'Show more') as HTMLButtonElement).click();
      await flush();
      expect(count('/api/v1/lots/')).toBe(12);
    });
  });

  describe('status, pill and actions', () => {
    it('shows the right pill and actions for every status', async () => {
      respondWith(
        booking('1', 'Pending'),
        booking('2', 'Confirmed'),
        booking('3', 'CheckedIn'),
        booking('4', 'Completed'),
        booking('5', 'Cancelled'),
        booking('6', 'NoShow'),
      );
      await setup();
      const expected: [string, string, string[]][] = [
        ['1', 'Pending', ['Cancel']],
        ['2', 'Confirmed', ['Check in', 'Cancel']],
        ['3', 'Checked in', ['Check out']],
        ['4', 'Completed', ['View receipt']],
        ['5', 'Cancelled', ['Book again']],
        ['6', 'No-show', ['Book again']],
      ];
      for (const [id, pill, actions] of expected) {
        expect(text(row(id)), id).toContain(pill);
        expect(labels(row(id)), id).toEqual(actions);
      }
    });

    it('colours the pills by tone with decorative dots', async () => {
      respondWith(
        booking('1', 'Confirmed'),
        booking('2', 'CheckedIn'),
        booking('3', 'Completed'),
        booking('4', 'Cancelled'),
      );
      await setup();
      const pill = (id: string) => row(id).querySelector('span.inline-flex') as HTMLElement;
      expect(pill('1').classList).toContain('text-link');
      expect(pill('2').classList).toContain('text-green-700');
      expect(pill('3').classList).toContain('text-muted');
      expect(pill('4').classList).toContain('text-red-700');
      expect(pill('1').querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
    });

    it.each([
      ['DriverCancelled', 'Cancelled'],
      ['PaymentTimeout', 'Cancelled \u2014 payment timed out'],
      ['PaymentFailed', 'Cancelled \u2014 payment failed'],
      ['SpotUnavailable', 'Cancelled \u2014 spot unavailable'],
      ['Other', 'Cancelled'],
      [null, 'Cancelled'],
    ])('cancelReason %s shows "%s" and no other text', async (cancelReason, pill) => {
      respondWith(booking('1', 'Cancelled', { cancelReason }));
      await setup();
      expect(row('1').querySelector('span.inline-flex')?.textContent?.trim()).toBe(pill);
    });
  });

  describe('links', () => {
    it('makes every row except Pending a link to its detail page', async () => {
      respondWith(
        booking('1', 'Pending'),
        booking('2', 'Confirmed'),
        booking('3', 'Completed'),
        booking('4', 'Cancelled'),
      );
      await setup();
      expect(row('1').querySelector('a[data-title]')).toBeNull();
      expect(row('1').querySelector('a')).toBeNull();
      expect(row('2').querySelector('a[data-title]')?.getAttribute('href')).toBe('/bookings/2');
      expect(row('3').querySelector('a[data-title]')?.getAttribute('href')).toBe('/bookings/3');
      expect(row('4').querySelector('a[data-title]')?.getAttribute('href')).toBe('/bookings/4');
    });

    it('sends Book again to the lot and View receipt to the booking', async () => {
      respondWith(booking('1', 'Cancelled'), booking('2', 'Completed'), booking('3', 'NoShow'));
      await setup();
      expect(find(row('1'), 'a', 'Book again')?.getAttribute('href')).toBe('/lots/lot-1');
      expect(find(row('3'), 'a', 'Book again')?.getAttribute('href')).toBe('/lots/lot-3');
      expect(find(row('2'), 'a', 'View receipt')?.getAttribute('href')).toBe('/bookings/2');
    });

    it('keeps the buttons outside the row link and above its click area', async () => {
      await setup();
      const link = row('1').querySelector('a[data-title]') as HTMLElement;
      const button = find(row('1'), 'button', 'Check in') as HTMLElement;
      expect(link.contains(button)).toBe(false);
      expect(link.className).toContain('after:absolute');
      expect(button.parentElement?.className).toContain('z-10');
    });

    it('shows "Pay by" for a due Pending booking and "Payment time is up" when past', async () => {
      respondWith(
        booking('1', 'Pending', { paymentDueAt: new Date(Date.now() + 600_000).toISOString() }),
        booking('2', 'Pending', { paymentDueAt: new Date(Date.now() - 60_000).toISOString() }),
        booking('3', 'Confirmed'),
      );
      await setup();
      expect(text(row('1'))).toMatch(/Pay by Today, \d{1,2}:\d{2} (AM|PM)/);
      expect(text(row('2'))).toContain('Payment time is up');
      expect(text(row('3'))).not.toContain('Pay by');
    });
  });

  describe('check in', () => {
    it('updates the row from the response', async () => {
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(posts).toEqual([{ path: '/api/bookings/1/checkin', body: {} }]);
      expect(labels(row('1'))).toEqual(['Check out']);
      expect(text(row('1'))).toContain('Checked in');
      expect(status()).toContain('Checked in.');
    });

    it('shows "Checking in..." in place of the buttons and ignores double clicks', async () => {
      const pending = new Subject<unknown>();
      postResult['checkin'] = () => pending;
      await setup();
      const button = find(row('1'), 'button', 'Check in') as HTMLButtonElement;
      button.click();
      button.click();
      fixture.detectChanges();
      expect(posts.length).toBe(1);
      expect(text(row('1'))).toContain('Checking in...');
      expect(labels(row('1'))).toEqual([]);
    });

    it('works per row, independently', async () => {
      respondWith(booking('1', 'Confirmed'), booking('2', 'Confirmed'));
      const pending = new Subject<unknown>();
      postResult['checkin'] = () => pending;
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(labels(row('2'))).toEqual(['Check in', 'Cancel']);
      (find(row('2'), 'button', 'Check in') as HTMLButtonElement).click();
      expect(posts.length).toBe(2);
    });

    it('shows the server message on 409 and re-fetches only that booking', async () => {
      postResult['checkin'] = () => httpError(409, 'The spot could not be occupied.');
      byId['1'] = () => of(envelope(booking('1', 'Cancelled', { cancelReason: 'SpotUnavailable' })));
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'The spot could not be occupied.',
      );
      expect(gets.filter((p) => p === '/api/bookings/1').length).toBe(1);
      expect(count('/api/bookings/my')).toBe(1);
      expect(text(row('1'))).toContain('Cancelled \u2014 spot unavailable');
    });

    it('reloads the whole list on 404', async () => {
      postResult['checkin'] = () => httpError(404);
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      await flush();
      expect(count('/api/bookings/my')).toBe(2);
    });

    it('clears the session and goes to login on 401', async () => {
      postResult['checkin'] = () => httpError(401);
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('a 429 shows no banner and brings the buttons back', async () => {
      postResult['checkin'] = () => httpError(429);
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(text()).not.toContain('Something went wrong');
      expect(labels(row('1'))).toEqual(['Check in', 'Cancel']);
      expect(rows().length).toBe(1);
    });

    it.each([0, 500])('shows a generic banner on %s and brings the buttons back', async (code) => {
      postResult['checkin'] = () => httpError(code);
      await setup();
      (find(row('1'), 'button', 'Check in') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'Something went wrong. Please try again.',
      );
      expect(labels(row('1'))).toEqual(['Check in', 'Cancel']);
    });
  });

  describe('check out', () => {
    beforeEach(() => {
      respondWith(booking('1', 'CheckedIn'));
    });

    async function start(): Promise<void> {
      await setup();
      (find(row('1'), 'button', 'Check out') as HTMLButtonElement).click();
      await flush();
    }

    it('polls every 2 seconds until Completed, then updates the row', async () => {
      await start();
      expect(posts[0].path).toBe('/api/bookings/1/checkout');
      expect(text(row('1'))).toContain('Checking out...');
      expect(status()).toContain('Checking out.');
      const before = gets.filter((p) => p === '/api/bookings/1').length;
      await flush(2000);
      await flush(2000);
      expect(gets.filter((p) => p === '/api/bookings/1').length).toBe(before + 2);

      byId['1'] = () => of(envelope(booking('1', 'Completed')));
      await flush(2000);
      expect(labels(row('1'))).toEqual(['View receipt']);
      expect(text(row('1'))).toContain('Completed');
      expect(status()).toContain('Booking completed.');
      const after = gets.filter((p) => p === '/api/bookings/1').length;
      await flush(20_000);
      expect(gets.filter((p) => p === '/api/bookings/1').length).toBe(after);
    });

    it('keeps polling after a failed poll', async () => {
      await start();
      byId['1'] = () => httpError(503);
      await flush(2000);
      byId['1'] = () => of(envelope(booking('1', 'Completed')));
      await flush(2000);
      expect(labels(row('1'))).toEqual(['View receipt']);
    });

    it('keeps polling through a 429 with no banner', async () => {
      await start();
      byId['1'] = () => httpError(429);
      await flush(2000);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      byId['1'] = () => of(envelope(booking('1', 'Completed')));
      await flush(2000);
      expect(labels(row('1'))).toEqual(['View receipt']);
    });

    it('stops after 60 seconds with the taking-longer line in that row', async () => {
      await start();
      await flush(58_000);
      expect(text(row('1'))).not.toContain('taking longer than usual');
      await flush(2000);
      expect(text(row('1'))).toContain(
        'This is taking longer than usual. Please refresh in a moment.',
      );
      const calls = gets.filter((p) => p === '/api/bookings/1').length;
      await flush(30_000);
      expect(gets.filter((p) => p === '/api/bookings/1').length).toBe(calls);
    });

    it('reloads the whole list when a poll gets a 404', async () => {
      await start();
      byId['1'] = () => httpError(404);
      await flush(2000);
      expect(count('/api/bookings/my')).toBe(2);
    });
  });

  describe('cancel', () => {
    async function openDialog(id = '1'): Promise<HTMLButtonElement> {
      const button = find(row(id), 'button', 'Cancel') as HTMLButtonElement;
      button.click();
      await flush();
      return button;
    }
    const confirm = () => find(dialog()!, 'button', 'Yes, cancel booking') as HTMLButtonElement;

    it('opens the dialog with the refund text for a Confirmed booking', async () => {
      await setup();
      await openDialog();
      expect(dialog()?.getAttribute('aria-modal')).toBe('true');
      expect(dialog()!.textContent).toContain('Cancel this booking?');
      expect(dialog()!.textContent).toContain(
        'Your payment of ₹120 will be refunded to your original payment method.',
      );
      expect(dialog()!.contains(document.activeElement)).toBe(true);
    });

    it('uses the plain text for a Pending booking', async () => {
      respondWith(booking('1', 'Pending', { paymentDueAt: new Date(Date.now() + 60_000).toISOString() }));
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

    it('confirm sends the fixed reason, polls until Cancelled and focuses the row link', async () => {
      await setup();
      await openDialog();
      confirm().click();
      await flush();
      expect(posts).toEqual([
        { path: '/api/bookings/1/cancel', body: { reason: 'Cancelled by driver' } },
      ]);
      expect(dialog()).toBeNull();
      expect(text(row('1'))).toContain('Cancelling...');
      expect(status()).toContain('Cancellation in progress.');
      expect(document.activeElement).toBe(row('1').querySelector('a[data-title]'));

      byId['1'] = () => of(envelope(booking('1', 'Cancelled', { cancelReason: 'DriverCancelled' })));
      await flush(2000);
      expect(labels(row('1'))).toEqual(['Book again']);
      expect(row('1').querySelector('span.inline-flex')?.textContent?.trim()).toBe('Cancelled');
      expect(status()).toContain('Booking cancelled.');
    });

    it('cancels a Pending booking and polls from Pending', async () => {
      respondWith(booking('1', 'Pending', { paymentDueAt: new Date(Date.now() + 60_000).toISOString() }));
      await setup();
      await openDialog();
      confirm().click();
      await flush();
      expect(text(row('1'))).toContain('Cancelling...');
      byId['1'] = () => of(envelope(booking('1', 'Cancelled', { cancelReason: 'DriverCancelled' })));
      await flush(2000);
      expect(labels(row('1'))).toEqual(['Book again']);
    });

    it('stops polling after 60 seconds with the taking-longer line', async () => {
      await setup();
      await openDialog();
      confirm().click();
      await flush();
      await flush(60_000);
      expect(text(row('1'))).toContain('This is taking longer than usual.');
    });

    it('sends one request on a double click and disables the dialog button', async () => {
      const pending = new Subject<unknown>();
      postResult['cancel'] = () => pending;
      await setup();
      await openDialog();
      const button = confirm();
      button.click();
      button.click();
      fixture.detectChanges();
      expect(posts.length).toBe(1);
      expect(button.disabled).toBe(true);
    });

    it('409 shows the message inside the dialog and re-fetches that booking', async () => {
      postResult['cancel'] = () => httpError(409, 'Cannot cancel after check-in.');
      byId['1'] = () => of(envelope(booking('1', 'CheckedIn')));
      await setup();
      await openDialog();
      confirm().click();
      await flush();
      expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain(
        'Cannot cancel after check-in.',
      );
      expect(labels(row('1'))).toEqual(['Check out']);
    });

    it('401 clears the session', async () => {
      postResult['cancel'] = () => httpError(401);
      await setup();
      await openDialog();
      confirm().click();
      fixture.detectChanges();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('a 429 shows no message, keeps the dialog open and enables its button again', async () => {
      postResult['cancel'] = () => httpError(429);
      await setup();
      await openDialog();
      confirm().click();
      fixture.detectChanges();
      expect(dialog()).not.toBeNull();
      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
      expect(dialog()!.textContent).not.toContain('Something went wrong');
      expect(confirm().disabled).toBe(false);
    });

    it('keeps the dialog open with a banner on a 500', async () => {
      postResult['cancel'] = () => httpError(500);
      await setup();
      await openDialog();
      confirm().click();
      fixture.detectChanges();
      expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain(
        'Something went wrong. Please try again.',
      );
      expect(confirm().disabled).toBe(false);
    });
  });

  describe('show more', () => {
    beforeEach(() => {
      respondWith(...Array.from({ length: 25 }, (_, i) => booking(`${i + 1}`, 'Completed')));
    });

    it('reveals 10 at a time and announces it', async () => {
      await setup();
      expect(rows().length).toBe(10);
      const button = find(el, 'button', 'Show more') as HTMLButtonElement;
      button.click();
      await flush();
      expect(rows().length).toBe(20);
      expect(status()).toContain('10 more bookings shown.');
      expect(find(el, 'button', 'Show more')).toBe(button);
      button.click();
      await flush();
      expect(rows().length).toBe(25);
      expect(find(el, 'button', 'Show more')).toBeUndefined();
    });

    it('has no button for 10 bookings or fewer', async () => {
      respondWith(...Array.from({ length: 10 }, (_, i) => booking(`${i + 1}`, 'Completed')));
      await setup();
      expect(find(el, 'button', 'Show more')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('leaves no timers or further requests after destroy', async () => {
      respondWith(booking('1', 'CheckedIn'));
      await setup();
      (find(row('1'), 'button', 'Check out') as HTMLButtonElement).click();
      await flush();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
      const calls = gets.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(gets.length).toBe(calls);
    });
  });
});
