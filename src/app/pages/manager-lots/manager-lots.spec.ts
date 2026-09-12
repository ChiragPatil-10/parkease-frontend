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

  it('derives Open/Closed/Awaiting approval from isApproved and isOpen', () => {
    const { component } = createFixture();

    expect(component.statusFor(OPEN_LOT)).toBe('open');
    expect(component.statusFor({ ...OPEN_LOT, isOpen: false })).toBe('closed');
    expect(component.statusFor(PENDING_LOT)).toBe('awaiting-approval');
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
});
