import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DriverLots } from './driver-lots';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { environment } from '../../../environments/environment';

const SESSION_STORAGE_KEY = 'parkease.session';
const NEARBY_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.nearby}`;
const SEARCH_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.search}`;

const POSITION = { coords: { latitude: 12.97, longitude: 77.59 } };

const NEARBY_LOT = {
  lotId: 'lot-1',
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bengaluru',
  latitude: 12.97,
  longitude: 77.59,
  availableSpots: 12,
  minPricePerHour: 40,
  maxPricePerHour: 80,
  isOpen: true,
  distanceKm: 0.84,
};

const CITY_LOT = {
  lotId: 'lot-2',
  name: 'Marathahalli Tower Park',
  address: 'Outer Ring Rd',
  city: 'Bengaluru',
  latitude: 12.95,
  longitude: 77.7,
  totalSpots: 20,
  availableSpots: 4,
  minPricePerHour: 35,
  maxPricePerHour: 60,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: true,
  isOpen: true,
  description: null,
  approvalFeedback: null,
  approvedAt: null,
  managerId: 'mgr-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function envelope<T>(data: T) {
  return { success: true, message: null, data, errors: null };
}

function paged<T>(items: T[], totalCount = items.length) {
  return envelope({ items, totalCount, page: 1, pageSize: 50, totalPages: 1 });
}

function stubPermission(state: string | null): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: state === null ? undefined : { query: vi.fn().mockResolvedValue({ state }) },
  });
}

function stubGeolocation(outcome: 'success' | 'error') {
  const getCurrentPosition = vi.fn((ok: (p: unknown) => void, fail: (e: unknown) => void) => {
    if (outcome === 'success') {
      ok(POSITION);
    } else {
      fail({ code: 1, message: 'denied' });
    }
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}

describe('DriverLots', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, 'stale');
    await TestBed.configureTestingModule({
      imports: [DriverLots],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  interface Internals {
    locationGranted: DriverLots['locationGranted'];
    resolvingPermission: DriverLots['resolvingPermission'];
    selectedRadius: DriverLots['selectedRadius'];
    nearbyLots: DriverLots['nearbyLots'];
    nearbyLoading: DriverLots['nearbyLoading'];
    nearbyError: DriverLots['nearbyError'];
    cityInput: DriverLots['cityInput'];
    cityLots: DriverLots['cityLots'];
    cityLotsCount: DriverLots['cityLotsCount'];
    searchedCity: DriverLots['searchedCity'];
    searchError: DriverLots['searchError'];
    locationHint: DriverLots['locationHint'];
    bannerDismissed: DriverLots['bannerDismissed'];
    selectRadius: DriverLots['selectRadius'];
    enableLocation: DriverLots['enableLocation'];
    dismissBanner: DriverLots['dismissBanner'];
    search: DriverLots['search'];
  }

  function createFixture() {
    const fixture = TestBed.createComponent(DriverLots);
    return { fixture, c: fixture.componentInstance as unknown as Internals };
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  function nearbyRequest() {
    return vi.waitFor(() => httpMock.expectOne((r) => r.url === NEARBY_URL));
  }

  async function startGranted() {
    stubPermission('granted');
    stubGeolocation('success');
    const ctx = createFixture();
    ctx.fixture.detectChanges();
    return ctx;
  }

  async function startDenied() {
    stubPermission('denied');
    stubGeolocation('error');
    const ctx = createFixture();
    ctx.fixture.detectChanges();
    await settle();
    return ctx;
  }

  describe('initial state', () => {
    it('shows State A and fetches nearby lots when permission is granted', async () => {
      stubPermission('granted');
      const geo = stubGeolocation('success');
      const { fixture, c } = createFixture();
      fixture.detectChanges();

      const req = await nearbyRequest();
      expect(geo).toHaveBeenCalled();
      expect(req.request.params.get('latitude')).toBe('12.97');
      expect(req.request.params.get('longitude')).toBe('77.59');
      expect(req.request.params.get('radiusKm')).toBe('2');
      req.flush(envelope([NEARBY_LOT]));
      await settle();

      expect(c.locationGranted()).toBe(true);
      expect(c.nearbyLots()).toEqual([NEARBY_LOT]);
    });

    it.each(['prompt', 'denied'])(
      'shows State B without geolocating when permission is %s',
      async (state) => {
        stubPermission(state);
        const geo = stubGeolocation('success');
        const { fixture, c } = createFixture();
        fixture.detectChanges();
        await settle();

        expect(c.locationGranted()).toBe(false);
        expect(c.resolvingPermission()).toBe(false);
        expect(geo).not.toHaveBeenCalled();
      },
    );

    it('shows State B when the Permissions API is unavailable', async () => {
      stubPermission(null);
      stubGeolocation('success');
      const { fixture, c } = createFixture();
      fixture.detectChanges();
      await settle();

      expect(c.locationGranted()).toBe(false);
      expect(c.resolvingPermission()).toBe(false);
    });
  });

  describe('Enable location', () => {
    it('switches to State A and fetches on success', async () => {
      const { c } = await startDenied();
      stubGeolocation('success');

      const done = c.enableLocation();
      const req = await nearbyRequest();
      req.flush(envelope([NEARBY_LOT]));
      await done;

      expect(c.locationGranted()).toBe(true);
      expect(c.nearbyLots()).toEqual([NEARBY_LOT]);
    });

    it('stays in State B with a settings hint on error', async () => {
      const { c } = await startDenied();

      await c.enableLocation();

      expect(c.locationGranted()).toBe(false);
      expect(c.locationHint()).toContain('browser settings');
    });

    it('Dismiss only hides the banner', async () => {
      const { fixture, c } = await startDenied();

      c.dismissBanner();
      fixture.detectChanges();

      expect(c.bannerDismissed()).toBe(true);
      expect(c.locationGranted()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Enable location');
    });
  });

  describe('nearby lots', () => {
    it('refetches with the chosen radiusKm when a chip is clicked', async () => {
      const { c } = await startGranted();
      (await nearbyRequest()).flush(envelope([]));
      await settle();

      c.selectRadius(5);
      const req = httpMock.expectOne((r) => r.url === NEARBY_URL);
      expect(req.request.params.get('radiusKm')).toBe('5');
      req.flush(envelope([NEARBY_LOT]));
      await settle();

      expect(c.selectedRadius()).toBe(5);
      expect(c.nearbyLots()).toEqual([NEARBY_LOT]);
    });

    it('shows the empty state when nothing is within the radius', async () => {
      const { fixture } = await startGranted();
      (await nearbyRequest()).flush(envelope([]));
      await settle();
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('0 open lots nearby');
      expect(text).toContain('No open lots within 2km');
    });

    it('renders the card from the nearby response', async () => {
      const { fixture } = await startGranted();
      (await nearbyRequest()).flush(envelope([NEARBY_LOT]));
      await settle();
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('1 open lots nearby');
      expect(text).toContain('Whitefield Central Lot');
      expect(text).toContain('0.8 km away');
      expect(text).toContain('₹40/hr');
      expect(text).toContain('Open now');
    });

    it.each([
      [429, 'retry'],
      [500, 'Something went wrong'],
      [422, "wasn't valid"],
      [0, 'reach the server'],
    ])('shows a banner message for status %i', async (status, fragment) => {
      const { c } = await startGranted();
      const req = await nearbyRequest();
      if (status === 0) {
        req.error(new ProgressEvent('error'));
      } else {
        req.flush(null, { status, statusText: 'err' });
      }
      await settle();

      expect(c.nearbyError()).toContain(fragment);
      expect(c.nearbyLoading()).toBe(false);
    });

    it('clears the session and redirects to /login on a 401', async () => {
      await startGranted();
      (await nearbyRequest()).flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('city search', () => {
    it('ignores empty or whitespace-only input', async () => {
      const { c } = await startDenied();
      c.cityInput.set('   ');

      await c.search();

      httpMock.expectNone((r) => r.url === SEARCH_URL);
      expect(c.searchedCity()).toBeNull();
    });

    it('shows a prompt before the first search', async () => {
      const { fixture } = await startDenied();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Search a city to see lots',
      );
    });

    it('sends the trimmed city as typed, page 1, pageSize 50, and reads items and totalCount', async () => {
      const { fixture, c } = await startDenied();
      c.cityInput.set('  Bengaluru ');

      const done = c.search();
      const req = httpMock.expectOne((r) => r.url === SEARCH_URL);
      expect(req.request.params.get('city')).toBe('Bengaluru');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('50');
      req.flush(paged([CITY_LOT], 12));
      await done;
      fixture.detectChanges();

      expect(c.cityLots()).toEqual([CITY_LOT]);
      expect(c.cityLotsCount()).toBe(12);
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('12 LOTS IN BENGALURU');
      expect(text).toContain('₹35/hr');
      expect(text).toContain('4 available');
    });

    it('shows an empty state when no lots are found', async () => {
      const { fixture, c } = await startDenied();
      c.cityInput.set('Nowhere');

      const done = c.search();
      httpMock.expectOne((r) => r.url === SEARCH_URL).flush(paged([], 0));
      await done;
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('0 LOTS IN NOWHERE');
      expect(text).toContain('No lots found for Nowhere');
    });

    it('shows an error banner when the search fails', async () => {
      const { c } = await startDenied();
      c.cityInput.set('Bengaluru');

      const done = c.search();
      httpMock
        .expectOne((r) => r.url === SEARCH_URL)
        .flush(null, { status: 429, statusText: 'Too Many Requests' });
      await done;

      expect(c.searchError()).toContain('retry');
    });
  });

  describe('lot card links', () => {
    it('State A cards link to /lots/:lotId', async () => {
      const { fixture } = await startGranted();
      (await nearbyRequest()).flush(envelope([NEARBY_LOT]));
      await settle();
      fixture.detectChanges();

      const link = (fixture.nativeElement as HTMLElement).querySelector(
        `a[href="/lots/${NEARBY_LOT.lotId}"]`,
      );
      expect(link).toBeTruthy();
      expect(link?.textContent).toContain('Whitefield Central Lot');
    });

    it('State B cards link to /lots/:lotId', async () => {
      const { fixture, c } = await startDenied();
      c.cityInput.set('Bengaluru');

      const done = c.search();
      httpMock.expectOne((r) => r.url === SEARCH_URL).flush(paged([CITY_LOT]));
      await done;
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(`a[href="/lots/${CITY_LOT.lotId}"]`),
      ).toBeTruthy();
    });
  });
});
