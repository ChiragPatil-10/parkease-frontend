import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ManagerLotBookings, lotBookingRowView } from './manager-lot-bookings';
import { ApiResponse } from '../../models/api-response.model';
import { ManagerLotBooking } from '../../models/booking.model';
import { LotResponse } from '../../models/lot.model';
import { AuthService } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { formatAmount, formatBookingTime } from '../driver-booking-detail/booking-detail-format';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';

const LOT_A = '11111111-1111-4111-8111-111111111111';
const LOT_B = '22222222-2222-4222-8222-222222222222';
const LOT_C = '33333333-3333-4333-8333-333333333333';
const FOREIGN = '99999999-9999-4999-8999-999999999999';
const PAGE = 20;

const lot = (lotId: string, name: string, isApproved = true): LotResponse =>
  ({ lotId, name, isApproved, managerId: 'mgr-1' }) as LotResponse;

const LOTS = [
  lot(LOT_A, 'Whitefield Central Lot'),
  lot(LOT_B, 'Koramangala Plaza Lot'),
  lot(LOT_C, 'Indiranagar Metro Lot', false),
];

function row(n: number, extra: Partial<ManagerLotBooking> = {}): ManagerLotBooking {
  return {
    bookingId: `b-${n}`,
    spotNumber: `A-${String(n).padStart(2, '0')}`,
    plateNumber: 'KA05MJ4471',
    startTime: new Date(Date.now() + 3_600_000).toISOString(),
    totalAmount: 120,
    status: 'Confirmed',
    cancelReason: null,
    ...extra,
  };
}
const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));
const envelope = <T>(data: T): ApiResponse<T> => ({ success: true, message: null, data, errors: null });

interface Call {
  lotId: string;
  status: string | null;
  page: number;
  pageSize: number;
  subject: Subject<ApiResponse<ManagerLotBooking[]>>;
}

@Component({ template: '' })
class LoginStub {}

describe('ManagerLotBookings', () => {
  let calls: Call[];
  let lotsCalls: string[];
  let lotsResult: () => Observable<ApiResponse<LotResponse[]>>;
  let clearSession: ReturnType<typeof vi.fn>;
  let userId: string | undefined;

  async function render(url = `/manager/lot-bookings?lotId=${LOT_A}`) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'manager/lot-bookings', component: ManagerLotBookings },
          { path: 'login', component: LoginStub },
        ]),
        {
          provide: BookingService,
          useValue: {
            getLotBookings: (lotId: string, status: string | null, page: number, pageSize: number) => {
              const subject = new Subject<ApiResponse<ManagerLotBooking[]>>();
              calls.push({ lotId, status, page, pageSize, subject });
              return subject;
            },
          },
        },
        {
          provide: ParkingLotService,
          useValue: {
            getLotsByManager: (id: string) => {
              lotsCalls.push(id);
              return lotsResult();
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => (userId ? { userId } : null),
            clearSession,
            logout: vi.fn(),
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, ManagerLotBookings);
    const fixture = harness.fixture;
    const el: HTMLElement = fixture.nativeElement;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await settle();
    return { fixture, el, router, navigate, settle, harness };
  }

  const last = () => calls[calls.length - 1];
  const respond = (call: Call, data: ManagerLotBooking[]) => call.subject.next(envelope(data));
  const fail = (call: Call, status: number, body: unknown = null) =>
    call.subject.error(new HttpErrorResponse({ status, error: body }));

  const chip = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('[role="group"] button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  const button = (el: HTMLElement, pattern: RegExp) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('main button')).find((b) =>
      pattern.test(b.textContent ?? ''),
    );
  const tableRows = (el: HTMLElement) => el.querySelectorAll('tbody tr');
  const h1 = (el: HTMLElement) => el.querySelector('h1')!.textContent!.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    calls = [];
    lotsCalls = [];
    lotsResult = () => of(envelope(LOTS));
    clearSession = vi.fn();
    userId = 'mgr-1';
  });

  describe('lots and selection', () => {
    it('loads the logged-in manager\'s lots, shows the nav with Lot Bookings active and the lot name in the h1', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      expect(lotsCalls).toEqual(['mgr-1']);
      expect(el.querySelector('app-manager-nav')).toBeTruthy();
      expect(el.querySelector('nav a.font-semibold')?.textContent?.trim()).toBe('Lot Bookings');
      expect(h1(el)).toBe('Bookings — Whitefield Central Lot');
      expect(el.querySelector('h1')?.className).toContain('font-display');
    });

    it('shows noLots and makes no bookings request when the manager has no lots', async () => {
      lotsResult = () => of(envelope([]));
      const { el } = await render();
      expect(calls.length).toBe(0);
      expect(el.textContent).toContain("You don't have any parking lots yet.");
      expect(el.querySelector('main a')?.getAttribute('href')).toBe('/manager/lots');
      expect(el.querySelector('select')).toBeNull();
      expect(el.querySelector('[role="group"]')).toBeNull();
      expect(el.querySelector('table')).toBeNull();
      expect(h1(el)).toBe('Bookings');
    });

    it('selects the first lot and sets the URL with replaceUrl when there is no lotId', async () => {
      const { navigate, router, settle } = await render('/manager/lot-bookings');
      await settle();
      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { lotId: LOT_A }, replaceUrl: true }),
      );
      expect(router.url).toContain(`lotId=${LOT_A}`);
      expect(calls.length).toBe(1);
      expect(calls[0].lotId).toBe(LOT_A);
    });

    it('shows lotNotFound without a bookings request for an invalid lotId, keeping the dropdown', async () => {
      const { el } = await render('/manager/lot-bookings?lotId=not-a-guid');
      expect(calls.length).toBe(0);
      expect(el.textContent).toContain('Lot not found.');
      expect(el.textContent).toContain("It may have been removed, or it isn't one of your lots.");
      expect(el.querySelector('select')).toBeTruthy();
      expect(el.querySelector('[role="group"]')).toBeNull();
      expect(el.querySelector('main a[href="/manager/lots"]')).toBeTruthy();
      expect(h1(el)).toBe('Bookings');
    });

    it('shows lotNotFound without a bookings request for a lot that is not theirs', async () => {
      const { el } = await render(`/manager/lot-bookings?lotId=${FOREIGN}`);
      expect(calls.length).toBe(0);
      expect(el.textContent).toContain('Lot not found.');
    });

    it('hides the dropdown with a single lot', async () => {
      lotsResult = () => of(envelope([LOTS[0]]));
      const { el } = await render();
      expect(el.querySelector('select')).toBeNull();
    });
  });

  describe('lot dropdown', () => {
    it('lists the lots with the pending suffix on the unapproved one', async () => {
      const { el } = await render();
      expect(el.querySelector('label[for="lot-select"]')?.textContent?.trim()).toBe('Lot');
      expect(Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim())).toEqual([
        'Whitefield Central Lot',
        'Koramangala Plaza Lot',
        'Indiranagar Metro Lot (pending approval)',
      ]);
    });

    it('labels a rejected lot "(not approved)" in the dropdown and shows the plain name in the h1', async () => {
      const rejected = { ...lot(LOT_C, 'Hebbal Annex Lot', false), approvalStatus: 'Rejected' };
      lotsResult = () => of(envelope([rejected, LOTS[0]]));
      const { el } = await render(`/manager/lot-bookings?lotId=${LOT_C}`);
      expect(Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim())).toEqual([
        'Hebbal Annex Lot (not approved)',
        'Whitefield Central Lot',
      ]);
      expect(h1(el)).toBe('Bookings — Hebbal Annex Lot');
    });

    it('changing it updates the URL, reloads, resets the chip to All and drops the suffix from the h1', async () => {
      const { el, router, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      chip(el, 'Confirmed').click();
      await settle();
      respond(last(), rows(1, 1));
      await settle();

      const select = el.querySelector('select') as HTMLSelectElement;
      select.value = LOT_C;
      select.dispatchEvent(new Event('change'));
      await settle();

      expect(router.url).toContain(`lotId=${LOT_C}`);
      expect(last().lotId).toBe(LOT_C);
      expect(last().status).toBeNull();
      expect(last().page).toBe(1);
      expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('true');
      expect(h1(el)).toBe('Bookings — Indiranagar Metro Lot');
      respond(last(), []);
      await settle();
      expect(el.textContent).toContain('No bookings yet.');
    });

    it('a stale response after a lot change is ignored', async () => {
      const { el, settle, router } = await render();
      const first = last();
      await router.navigate([], { queryParams: { lotId: LOT_B } });
      await settle();
      expect(first.subject.observed).toBe(false);
      const second = last();
      respond(first, rows(1, 3));
      respond(second, rows(50, 1));
      await settle();
      expect(tableRows(el).length).toBe(1);
    });
  });

  describe('filter chips', () => {
    it('are a labelled toggle group with All pressed by default', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Filter by status');
      expect(Array.from(el.querySelectorAll('[role="group"] button')).map((b) => b.textContent?.trim())).toEqual(
        ['All', 'Confirmed', 'Checked in', 'Completed', 'Cancelled'],
      );
      expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('true');
      expect(chip(el, 'Confirmed').getAttribute('aria-pressed')).toBe('false');
      expect(calls[0].status).toBeNull();
    });

    it('sends the right status, resets to page 1 and shows the skeleton meanwhile', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      respond(last(), rows(100, 2));
      await settle();
      expect(last().page).toBe(2);

      chip(el, 'Checked in').click();
      await settle();
      expect(last().status).toBe('CheckedIn');
      expect(last().page).toBe(1);
      expect(last().pageSize).toBe(PAGE);
      expect(el.querySelector('[data-skeleton="table"]')).toBeTruthy();
      expect(tableRows(el).length).toBe(0);
      expect(chip(el, 'Checked in').getAttribute('aria-pressed')).toBe('true');

      for (const [label, status] of [
        ['Confirmed', 'Confirmed'],
        ['Completed', 'Completed'],
        ['Cancelled', 'Cancelled'],
      ]) {
        chip(el, label).click();
        await settle();
        expect(last().status).toBe(status);
      }
      chip(el, 'All').click();
      await settle();
      expect(last().status).toBeNull();
    });

    it('a stale response after a chip change is ignored', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      chip(el, 'Confirmed').click();
      await settle();
      const slow = last();
      chip(el, 'Completed').click();
      await settle();
      const fast = last();
      expect(slow.subject.observed).toBe(false);
      respond(slow, rows(200, 5));
      respond(fast, rows(300, 1));
      await settle();
      expect(tableRows(el).length).toBe(1);
    });

    it('shows a chip-specific empty message with the chips still visible', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      chip(el, 'Checked in').click();
      await settle();
      respond(last(), []);
      await settle();
      expect(el.textContent).toContain('No checked in bookings.');
      expect(el.querySelectorAll('[role="group"] button').length).toBe(5);
    });
  });

  describe('paging', () => {
    it('hasMore is true for exactly 20 rows and false for fewer', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      expect(button(el, /Show more/)).toBeTruthy();

      chip(el, 'Completed').click();
      await settle();
      respond(last(), rows(1, PAGE - 1));
      await settle();
      expect(button(el, /Show more/)).toBeUndefined();
    });

    it('Show more appends, de-duplicates, and hides on an empty next page', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      expect(last().page).toBe(2);
      respond(last(), [...rows(PAGE, 3)]); // b-20 repeats
      await settle();
      expect(tableRows(el).length).toBe(PAGE + 2);
      expect(button(el, /Show more/)).toBeUndefined();

      // full page then an empty page
      chip(el, 'Cancelled').click();
      await settle();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      respond(last(), []);
      await settle();
      expect(tableRows(el).length).toBe(PAGE);
      expect(button(el, /Show more|Loading/)).toBeUndefined();
    });

    it('is disabled with "Loading..." while in flight and ignores extra clicks', async () => {
      const { el, settle, harness } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      const more = button(el, /Show more/)!;
      more.click();
      await settle();
      expect(calls.length).toBe(2);
      const loading = button(el, /Loading\.\.\./)!;
      expect(loading.disabled).toBe(true);
      harness.routeDebugElement!.componentInstance.showMore();
      loading.click();
      await settle();
      expect(calls.length).toBe(2);
    });

    it('keeps the rows on a Show more failure, shows an inline error and retries the same page', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      fail(last(), 500, { message: 'secret stack trace' });
      await settle();
      expect(tableRows(el).length).toBe(PAGE);
      expect(el.textContent).toContain('Could not load more.');
      expect(el.textContent).not.toContain('secret stack trace');
      expect(el.querySelector('[role="alert"]')?.textContent).not.toContain('Could not load bookings.');

      button(el, /Show more/)!.click();
      await settle();
      expect(last().page).toBe(2);
      expect(el.textContent).not.toContain('Could not load more.');
    });
  });

  describe('errors', () => {
    it('a 429 on Show more keeps the rows, adds no message and re-enables the button', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      fail(last(), 429);
      await settle();

      expect(tableRows(el).length).toBe(PAGE);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).not.toContain('Could not load more.');
      const more = button(el, /Show more|Loading/)!;
      expect(more.disabled).toBe(false);
      expect(more.textContent).not.toContain('Loading...');
    });

    it('a bookings 404 gives lotNotFound', async () => {
      const { el, settle } = await render();
      fail(last(), 404, { message: "Lot 'x' not found." });
      await settle();
      expect(el.textContent).toContain('Lot not found.');
      expect(el.textContent).not.toContain("Lot 'x'");
    });

    it('a first-load 429 shows no banner and a neutral Retry that repeats page 1 for the same lot and chip', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      chip(el, 'Completed').click();
      await settle();
      fail(last(), 429, { message: 'raw server text' });
      await settle();

      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).not.toContain('Could not load bookings.');
      expect(el.textContent).not.toContain('raw server text');
      expect(el.querySelector('[data-rate-limited]')?.textContent).toContain(
        "Couldn't load this right now.",
      );
      expect(chip(el, 'Completed')).toBeTruthy();

      (el.querySelector('[data-rate-limited] button') as HTMLButtonElement).click();
      await settle();
      expect(last().lotId).toBe(LOT_A);
      expect(last().status).toBe('Completed');
      expect(last().page).toBe(1);
      respond(last(), rows(1, 3));
      await settle();
      expect(el.querySelector('[data-rate-limited]')).toBeNull();
      expect(tableRows(el).length).toBe(3);
    });

    it('a 429 on the lots request shows the neutral retry and Retry reloads lots then bookings', async () => {
      lotsResult = () => throwError(() => new HttpErrorResponse({ status: 429 }));
      const { el, settle } = await render();
      expect(calls.length).toBe(0);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.querySelector('[data-rate-limited]')).toBeTruthy();

      lotsResult = () => of(envelope(LOTS));
      (el.querySelector('[data-rate-limited] button') as HTMLButtonElement).click();
      await settle();
      await settle();
      expect(lotsCalls.length).toBe(2);
      expect(calls.length).toBe(1);
    });

    it.each([400, 403, 500, 0])('a bookings %i error shows the banner and Retry repeats page 1 for the same lot and chip', async (status) => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      chip(el, 'Completed').click();
      await settle();
      fail(last(), status, { message: 'raw server text', stack: 'at Foo.bar' });
      await settle();
      const alert = el.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('Could not load bookings.');
      expect(el.textContent).not.toContain('raw server text');
      expect(el.textContent).not.toContain(String(status || 'xx') + ' ');

      (alert.querySelector('button') as HTMLButtonElement).click();
      await settle();
      expect(last().lotId).toBe(LOT_A);
      expect(last().status).toBe('Completed');
      expect(last().page).toBe(1);
      respond(last(), rows(1, 3));
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(tableRows(el).length).toBe(3);
    });

    it('a lots failure shows the banner and Retry reloads the lots then the bookings', async () => {
      lotsResult = () => throwError(() => new HttpErrorResponse({ status: 500, error: 'boom' }));
      const { el, settle } = await render();
      expect(calls.length).toBe(0);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load bookings.');

      lotsResult = () => of(envelope(LOTS));
      (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
      await settle();
      expect(lotsCalls.length).toBe(2);
      await settle();
      expect(calls.length).toBe(1);
      respond(last(), rows(1, 1));
      await settle();
      expect(tableRows(el).length).toBe(1);
    });

    it('401 on the lots request clears the session and goes to /login', async () => {
      lotsResult = () => throwError(() => new HttpErrorResponse({ status: 401 }));
      const { router, settle } = await render();
      await settle();
      expect(clearSession).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });

    it('401 on a bookings request clears the session and goes to /login', async () => {
      const { router, settle } = await render();
      fail(last(), 401);
      await settle();
      expect(clearSession).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });

    it('401 on Show more clears the session and goes to /login', async () => {
      const { el, router, settle } = await render();
      respond(last(), rows(1, PAGE));
      await settle();
      button(el, /Show more/)!.click();
      await settle();
      fail(last(), 401);
      await settle();
      expect(clearSession).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });

    it('a missing session user clears the session and makes no request', async () => {
      userId = undefined;
      await render();
      expect(clearSession).toHaveBeenCalled();
      expect(lotsCalls.length).toBe(0);
      expect(calls.length).toBe(0);
    });

    it('a late response after destroy is ignored', async () => {
      const { fixture } = await render();
      const pending = last();
      fixture.destroy();
      expect(pending.subject.observed).toBe(false);
      expect(() => respond(pending, rows(1, 2))).not.toThrow();
    });
  });

  describe('rows', () => {
    it('renders one table row and one card per booking with the column headers', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 3));
      await settle();
      expect(tableRows(el).length).toBe(3);
      expect(el.querySelectorAll('ul[data-cards] > li').length).toBe(3);
      expect(Array.from(el.querySelectorAll('th[scope="col"]')).map((h) => h.textContent?.trim())).toEqual([
        'Spot',
        'Driver vehicle',
        'Start time',
        'Amount',
        'Status',
      ]);
      expect(el.querySelector('ul[data-cards]')?.className).toContain('md:hidden');
    });

    it('formats plate, time and amount with the shared helpers and uses mono for values', async () => {
      const { el, settle } = await render();
      const booking = row(1, { totalAmount: 62.5 });
      respond(last(), [booking]);
      await settle();
      const cells = el.querySelectorAll('tbody tr td');
      expect(cells[0].textContent?.trim()).toBe('A-01');
      expect(cells[0].className).toContain('font-mono');
      expect(cells[1].textContent?.trim()).toBe(formatPlate('KA05MJ4471'));
      expect(cells[1].className).toContain('font-mono');
      expect(cells[2].textContent?.trim()).toBe(formatBookingTime(booking.startTime));
      expect(cells[3].textContent?.trim()).toBe(formatAmount(62.5));
      expect(cells[3].className).toContain('font-mono');
    });

    it('shows a muted "-" with an accessible name for a null spot and plate', async () => {
      const { el, settle } = await render();
      respond(last(), [row(1, { spotNumber: null, plateNumber: null })]);
      await settle();
      const missing = el.querySelectorAll('tbody [aria-label="Not recorded"]');
      expect(missing.length).toBe(2);
      expect(missing[0].textContent?.trim()).toBe('-');
      expect(missing[0].getAttribute('role')).toBe('img');
      expect(missing[0].className).toContain('text-muted');
    });

    it('renders every status, including NoShow and an unknown one, with an aria-hidden dot', async () => {
      const { el, settle } = await render();
      respond(last(), [
        row(1, { status: 'Confirmed' }),
        row(2, { status: 'CheckedIn' }),
        row(3, { status: 'Completed' }),
        row(4, { status: 'Cancelled', cancelReason: 'PaymentTimeout' }),
        row(5, { status: 'NoShow' }),
        row(6, { status: 'Mystery' }),
      ]);
      await settle();
      const pills = Array.from(el.querySelectorAll('tbody [data-pill]'));
      expect(pills.map((p) => p.textContent?.trim())).toEqual([
        'Confirmed',
        'Checked in',
        'Completed',
        'Cancelled',
        'No-show',
        'Mystery',
      ]);
      expect(pills.map((p) => p.querySelector('span')?.className)).toEqual([
        expect.stringContaining('bg-link'),
        expect.stringContaining('bg-green-700'),
        expect.stringContaining('bg-muted'),
        expect.stringContaining('bg-red-700'),
        expect.stringContaining('bg-muted'),
        expect.stringContaining('bg-muted'),
      ]);
      for (const p of pills) expect(p.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
      expect(el.textContent).not.toContain('PaymentTimeout');
    });

    it('has no clickable rows or actions', async () => {
      const { el, settle } = await render();
      respond(last(), rows(1, 2));
      await settle();
      expect(el.querySelectorAll('tbody a, tbody button, ul[data-cards] a, ul[data-cards] button').length).toBe(0);
    });
  });

  describe('states', () => {
    it('loading shows skeletons in table and card shape', async () => {
      const { el } = await render();
      expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(el.querySelector('[data-skeleton="table"]')).toBeTruthy();
      expect(el.querySelector('[data-skeleton="cards"]')).toBeTruthy();
      expect(el.querySelector('table')).toBeNull();
    });

    it('empty shows "No bookings yet." for All inside the card area', async () => {
      const { el, settle } = await render();
      respond(last(), []);
      await settle();
      expect(el.textContent).toContain('No bookings yet.');
      expect(el.querySelector('table')).toBeNull();
    });
  });

  describe('lotBookingRowView', () => {
    const now = new Date();
    it.each([
      ['Confirmed', 'Confirmed', 'bg-link'],
      ['CheckedIn', 'Checked in', 'bg-green-700'],
      ['Completed', 'Completed', 'bg-muted'],
      ['Cancelled', 'Cancelled', 'bg-red-700'],
      ['NoShow', 'No-show', 'bg-muted'],
      ['Mystery', 'Mystery', 'bg-muted'],
    ])('maps %s to "%s" with dot %s', (status, label, dot) => {
      const view = lotBookingRowView(row(1, { status }), now);
      expect(view.statusLabel).toBe(label);
      expect(view.dotClass).toBe(dot);
    });

    it('formats plate, time and amount', () => {
      const booking = row(1, { totalAmount: 62.5 });
      const view = lotBookingRowView(booking, now);
      expect(view.plate).toBe('KA 05 MJ 4471');
      expect(view.startTime).toBe(formatBookingTime(booking.startTime, now));
      expect(view.amount).toBe('₹62.50');
    });
  });
});
