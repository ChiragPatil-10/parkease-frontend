import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerLots } from './manager-lots';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/components/toast/toast.service';

const SESSION_STORAGE_KEY = 'parkease.session';
const MANAGER_ID = 'mgr-1';
const LOTS_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.byManager(MANAGER_ID)}`;

function storeManagerSession(): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: '2099-01-01T00:00:00Z',
      user: {
        userId: MANAGER_ID,
        fullName: 'Bob Manager',
        email: 'bob@example.com',
        role: UserRole.Manager,
        profilePicUrl: null,
      },
    }),
  );
}

const OPEN_LOT = {
  lotId: 'lot-open',
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bangalore',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 40,
  availableSpots: 40,
  minPricePerHour: 30,
  maxPricePerHour: 50,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: true,
  isOpen: true,
  description: null,
  approvalFeedback: null,
  approvedAt: '2026-01-01T00:00:00Z',
  managerId: MANAGER_ID,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const PENDING_LOT = {
  ...OPEN_LOT,
  lotId: 'lot-pending',
  name: 'Shah Rooftop Deck',
  isApproved: false,
  isOpen: false,
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const REJECTED_LOT = {
  ...OPEN_LOT,
  lotId: 'lot-rejected',
  name: 'Rejected Garage',
  isApproved: false,
  isOpen: false,
  approvalStatus: 'Rejected',
  approvalFeedback: 'Please add a clearer address.',
};

const TOGGLE_URL = (id: string) => `${environment.apiBaseUrl}${PARKINGLOT_API.toggleOpen(id)}`;

describe('ManagerLots', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    storeManagerSession();

    await TestBed.configureTestingModule({
      imports: [ManagerLots],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ManagerLots);
    const component = fixture.componentInstance as unknown as {
      lots: ManagerLots['lots'];
      loading: ManagerLots['loading'];
      error: ManagerLots['error'];
      statusFor: ManagerLots['statusFor'];
      submittedTextFor: ManagerLots['submittedTextFor'];
      feedbackFor: ManagerLots['feedbackFor'];
    };
    return { fixture, component };
  }

  it('fetches lots for the logged-in manager using their own user id', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const req = httpMock.expectOne(LOTS_URL);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: [OPEN_LOT, PENDING_LOT], errors: null });
    await Promise.resolve();

    expect(component.lots()).toEqual([OPEN_LOT, PENDING_LOT]);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('makes exactly one lots request on load', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();
    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [OPEN_LOT], errors: null });
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    httpMock.expectNone(LOTS_URL);
  });

  it('derives pending, rejected, open and closed from approvalStatus with an isApproved fallback', () => {
    const { component } = createFixture();

    expect(component.statusFor(OPEN_LOT)).toBe('open');
    expect(component.statusFor({ ...OPEN_LOT, isOpen: false })).toBe('closed');
    expect(component.statusFor(PENDING_LOT)).toBe('pending');
    expect(component.statusFor({ ...OPEN_LOT, approvalStatus: 'Pending', isApproved: false })).toBe(
      'pending',
    );
    expect(component.statusFor(REJECTED_LOT)).toBe('rejected');
    expect(component.statusFor({ ...OPEN_LOT, approvalStatus: 'Approved', isOpen: false })).toBe(
      'closed',
    );
  });

  it('shows a submitted-time subtext for lots awaiting approval', () => {
    const { component } = createFixture();

    expect(component.submittedTextFor(PENDING_LOT)).toBe('Submitted 2 days ago');
  });

  it('falls back to a generic message when the error body is not the usual envelope', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const req = httpMock.expectOne(LOTS_URL);
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    await Promise.resolve();

    expect(component.error()).toBe("Couldn't load your lots. Please try again.");
  });

  it('surfaces the API message when the error body does follow the envelope', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const req = httpMock.expectOne(LOTS_URL);
    req.flush(
      { success: false, message: 'Something specific went wrong.', data: null, errors: null },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await Promise.resolve();

    expect(component.error()).toBe('Something specific went wrong.');
  });

  it('a first-load 429 shows no banner and a neutral Retry that loads again', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    httpMock
      .expectOne(LOTS_URL)
      .flush(
        { success: false, message: 'Slow down', data: null, errors: null },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(el.querySelector('.text-red-600')).toBeNull();
    expect(el.textContent).not.toContain('Slow down');
    expect(el.textContent).not.toContain("You haven't added any lots yet.");
    expect(el.querySelector('[data-rate-limited]')?.textContent).toContain(
      "Couldn't load this right now.",
    );

    el.querySelector<HTMLButtonElement>('[data-rate-limited] button')!.click();
    httpMock
      .expectOne(LOTS_URL)
      .flush({ success: true, message: null, data: [OPEN_LOT], errors: null });
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.lots()).toEqual([OPEN_LOT]);
    expect(el.querySelector('[data-rate-limited]')).toBeNull();
  });

  it('a 429 on a reload keeps the lots on screen with no banner or retry state', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    httpMock
      .expectOne(LOTS_URL)
      .flush({ success: true, message: null, data: [OPEN_LOT], errors: null });
    await Promise.resolve();

    void (component as unknown as { loadLots(): Promise<void> }).loadLots();
    httpMock.expectOne(LOTS_URL).flush(null, { status: 429, statusText: 'Too Many Requests' });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.lots()).toEqual([OPEN_LOT]);
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(el.querySelector('[data-rate-limited]')).toBeNull();
    expect(el.textContent).toContain('Whitefield Central Lot');
  });

  it('clears the session and redirects to /login on a 401', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const req = httpMock.expectOne(LOTS_URL);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(component.error()).toBe('Your session has expired. Please log in again.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('renders Add new lot and per-lot Edit links pointing at the stub routes', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();
    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [OPEN_LOT], errors: null });
    await Promise.resolve();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('a[href="/manager/lots/new"]')).toBeTruthy();
    expect(
      nativeElement.querySelector(`a[href="/manager/lots/${OPEN_LOT.lotId}/edit"]`),
    ).toBeTruthy();
  });

  it('shows an empty state when the manager has no lots', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();
    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [], errors: null });
    await Promise.resolve();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("You haven't added any lots yet.");
  });

  it('shows a friendly message instead of "Failed to fetch" when the network fails', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    httpMock.expectOne(LOTS_URL).error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
    await Promise.resolve();

    expect(component.error()).toBe("Couldn't reach the server. Check your connection and try again.");
  });

  async function loadWith(lots: unknown[]) {
    const ctx = createFixture();
    ctx.fixture.detectChanges();
    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: lots, errors: null });
    await Promise.resolve();
    ctx.fixture.detectChanges();
    return ctx;
  }

  function dialogButton(label: string): HTMLButtonElement {
    return Array.from(document.querySelectorAll('app-confirm-dialog button')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;
  }

  it('shows the admin feedback and an edit hint on a rejected lot, but no open button', async () => {
    const { fixture, component } = await loadWith([REJECTED_LOT]);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-state-pill]')?.textContent).toContain('Rejected');
    expect(el.querySelector('[data-feedback]')?.textContent).toContain(
      'Please add a clearer address.',
    );
    expect(el.textContent).toContain('send it for review again');
    expect(el.querySelector('[data-toggle-open]')).toBeNull();
    expect(el.querySelector('[data-view-bookings]')).toBeNull();
    expect(component.feedbackFor({ ...REJECTED_LOT, approvalStatus: 'Pending' })).toBeNull();
  });

  it('shows pending text without an open button', async () => {
    const { fixture } = await loadWith([PENDING_LOT]);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-state-pill]')?.textContent).toContain('Pending approval');
    expect(el.textContent).toContain('Pending admin approval');
    expect(el.querySelector('[data-toggle-open]')).toBeNull();
  });

  it('opens a closed approved lot straight away and updates the card from the response', async () => {
    const closed = { ...OPEN_LOT, isOpen: false };
    const { fixture, component } = await loadWith([closed]);
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('[data-toggle-open]')!;
    expect(button.textContent).toContain('Open lot');

    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    const req = httpMock.expectOne(TOGGLE_URL(closed.lotId));
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, message: null, data: { ...closed, isOpen: true }, errors: null });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.lots()[0].isOpen).toBe(true);
    expect(el.querySelector('[data-state-pill]')?.textContent).toContain('Open');
    expect(el.querySelector<HTMLButtonElement>('[data-toggle-open]')!.textContent).toContain(
      'Close lot',
    );
    expect(TestBed.inject(ToastService).message()).toContain('is now open');
  });

  it('asks before closing, and cancelling the dialog sends nothing', async () => {
    const { fixture } = await loadWith([OPEN_LOT]);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('[data-toggle-open]')!.click();
    fixture.detectChanges();
    expect(document.querySelector('app-confirm-dialog')).toBeTruthy();

    dialogButton('Cancel').click();
    fixture.detectChanges();
    httpMock.expectNone(TOGGLE_URL(OPEN_LOT.lotId));
    expect(document.querySelector('app-confirm-dialog')).toBeNull();
  });

  it('closes the lot after confirming', async () => {
    const { fixture, component } = await loadWith([OPEN_LOT]);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('[data-toggle-open]')!.click();
    fixture.detectChanges();
    dialogButton('Close lot').click();

    httpMock
      .expectOne(TOGGLE_URL(OPEN_LOT.lotId))
      .flush({ success: true, message: null, data: { ...OPEN_LOT, isOpen: false }, errors: null });
    await Promise.resolve();
    await Promise.resolve();

    expect(component.lots()[0].isOpen).toBe(false);
    expect(TestBed.inject(ToastService).message()).toContain('is now closed');
  });

  it('shows an error toast when the toggle fails', async () => {
    const closed = { ...OPEN_LOT, isOpen: false };
    const { fixture } = await loadWith([closed]);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-toggle-open]')!
      .click();

    httpMock
      .expectOne(TOGGLE_URL(closed.lotId))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await Promise.resolve();
    await Promise.resolve();

    expect(TestBed.inject(ToastService).message()).toBe(
      "Couldn't update the lot. Please try again.",
    );
  });

  it('links View bookings to the bookings page with the lot filter', async () => {
    const { fixture } = await loadWith([OPEN_LOT]);
    const link = (fixture.nativeElement as HTMLElement).querySelector('[data-view-bookings]')!;
    expect(link.getAttribute('href')).toBe(`/manager/lot-bookings?lotId=${OPEN_LOT.lotId}`);
  });
});
