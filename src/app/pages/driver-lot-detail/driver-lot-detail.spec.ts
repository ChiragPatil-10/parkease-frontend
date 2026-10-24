import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import {
  DriverLotDetail,
  formatStartTime,
  formatTime12h,
  parseDistanceKm,
} from './driver-lot-detail';
import { environment } from '../../../environments/environment';
import { SpotResponse } from '../../models/spot.model';

const SESSION_STORAGE_KEY = 'parkease.session';
const LOT_URL = `${environment.apiBaseUrl}/api/v1/lots/lot-1`;
const SPOTS_URL = `${environment.apiBaseUrl}/api/v1/spots/lot/lot-1`;
const VEHICLES_URL = `${environment.apiBaseUrl}/api/vehicles/my`;

const LOT = {
  lotId: 'lot-1',
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'bangalore',
  latitude: 12.97,
  longitude: 77.59,
  totalSpots: 5,
  availableSpots: 3,
  minPricePerHour: 10,
  maxPricePerHour: 90,
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

function spot(overrides: Partial<SpotResponse>): SpotResponse {
  return {
    spotId: 'id',
    lotId: 'lot-1',
    managerId: 'mgr-1',
    spotNumber: 'A-01',
    floor: 1,
    spotType: 'Standard',
    vehicleType: 'FourWheeler',
    status: 'Available',
    isHandicapped: false,
    isEvCharging: false,
    pricePerHour: 40,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const SPOTS: SpotResponse[] = [
  spot({ spotId: 's1', spotNumber: 'A-01' }),
  spot({ spotId: 's2', spotNumber: 'A-02', status: 'Reserved' }),
  spot({ spotId: 's3', spotNumber: 'A-03', status: 'Occupied' }),
  spot({ spotId: 's4', spotNumber: 'A-04', isEvCharging: true, spotType: 'EV', pricePerHour: 60 }),
  spot({
    spotId: 's5',
    spotNumber: 'M-01',
    vehicleType: 'TwoWheeler',
    spotType: 'Motorbike',
    pricePerHour: 10,
  }),
];

function vehicle(overrides: Record<string, unknown>) {
  return {
    vehicleId: 'v',
    driverId: 'd',
    plateNumber: 'KA05MJ4471',
    vehicleType: 'FourWheeler',
    make: 'Honda',
    model: 'City',
    isElectric: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const CAR = vehicle({ vehicleId: 'v-car', plateNumber: 'KA05MJ4471' });
const BIKE = vehicle({ vehicleId: 'v-bike', plateNumber: 'KA01AB1234', vehicleType: 'TwoWheeler' });
const OLD_CAR = vehicle({ vehicleId: 'v-old', plateNumber: 'OLD0001', isActive: false });
const EV_CAR = vehicle({ vehicleId: 'v-ev', plateNumber: 'KA09EV0001', isElectric: true });

function envelope<T>(data: T) {
  return { success: true, message: null, data, errors: null };
}

describe('DriverLotDetail', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, 'stale');
    await TestBed.configureTestingModule({
      imports: [DriverLotDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'lots/:lotId', component: DriverLotDetail }]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  interface Responses {
    lot?: unknown;
    spots?: unknown;
    vehicles?: unknown;
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    harness.detectChanges();
  }

  /** Opens /lots/lot-1 and flushes each request: data -> 200 envelope, number -> that status. */
  async function open(responses: Responses = {}, state?: unknown) {
    // The test Location doesn't persist navigation state to window.history, so fake what a real
    // browser would expose after a navigation carrying { distanceKm } from /lots.
    if (state) {
      vi.spyOn(history, 'state', 'get').mockReturnValue(state);
    }
    await router.navigateByUrl('/lots/lot-1');
    harness.detectChanges();

    const respond = (req: TestRequest, value: unknown) => {
      if (typeof value === 'number') {
        req.flush(null, { status: value, statusText: 'err' });
      } else {
        req.flush(envelope(value));
      }
    };
    respond(httpMock.expectOne(LOT_URL), responses.lot ?? LOT);
    respond(httpMock.expectOne(SPOTS_URL), responses.spots ?? SPOTS);
    respond(httpMock.expectOne(VEHICLES_URL), responses.vehicles ?? [CAR, BIKE]);
    await settle();

    const el = harness.fixture.nativeElement as HTMLElement;
    return { el, text: () => el.textContent ?? '' };
  }

  function spotButton(el: HTMLElement, label: string): HTMLButtonElement {
    return el.querySelector<HTMLButtonElement>(`button[aria-label^="${label},"]`)!;
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  }

  function continueButton(el: HTMLElement): HTMLButtonElement {
    return button(el, 'Continue to review');
  }

  async function click(el: HTMLElement, target: HTMLButtonElement): Promise<void> {
    target.click();
    await settle();
    expect(el).toBeTruthy();
  }

  describe('initial load', () => {
    it('renders the lot header, spots and the selected vehicle', async () => {
      const { text, el } = await open();

      expect(text()).toContain('Whitefield Central Lot');
      expect(text()).toContain('2nd Cross, ITPL Main Rd');
      expect(text()).toContain('Open 6:00 AM – 11:00 PM');
      expect(text()).toContain('Bangalore');
      expect(text()).toContain('KA05MJ4471');
      expect(el.querySelectorAll('button.font-mono').length).toBe(4);
    });

    it('shows the spots-empty state for a lot with no spots', async () => {
      const { text } = await open({ spots: [] });

      expect(text()).toContain('This lot has no spots yet.');
    });
  });

  describe('vehicle chip and selected vehicle', () => {
    it('defaults the chip to the first active vehicle type', async () => {
      const { el } = await open({ vehicles: [BIKE, CAR] });

      expect(button(el, 'Two Wheeler').getAttribute('aria-pressed')).toBe('true');
      expect(el.textContent).toContain('KA01AB1234');
    });

    it('defaults to Four Wheeler when the driver has no vehicles', async () => {
      const { el, text } = await open({ vehicles: [] });

      expect(button(el, 'Four Wheeler').getAttribute('aria-pressed')).toBe('true');
      expect(text()).toContain('No vehicle for this type');
      expect(text()).toContain('Add a vehicle');
      expect(continueButton(el).disabled).toBe(true);
    });

    it('renders "Add a vehicle" as a link to /vehicles that passes returnTo state', async () => {
      const { el } = await open({ vehicles: [] });
      const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).find(
        (a) => a.textContent?.trim() === 'Add a vehicle',
      )!;
      expect(link.getAttribute('href')).toBe('/vehicles');

      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      link.click();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][1]?.state).toEqual({ returnTo: '/lots/lot-1' });
    });

    it('uses the first ACTIVE vehicle of the type', async () => {
      const { text } = await open({ vehicles: [OLD_CAR, CAR] });

      expect(text()).toContain('KA05MJ4471');
      expect(text()).not.toContain('OLD0001');
    });

    it('shows a vehicles failure inline without blocking the spot grid', async () => {
      const { el, text } = await open({ vehicles: 500 });

      expect(text()).toContain('Something went wrong on our side');
      expect(el.querySelectorAll('button.font-mono').length).toBe(4);
      expect(continueButton(el).disabled).toBe(true);
    });
  });

  describe('chip filter and selection', () => {
    it('filters the grid by the chosen vehicle type', async () => {
      const { el } = await open();

      await click(el, button(el, 'Two Wheeler'));

      const labels = Array.from(el.querySelectorAll('button.font-mono')).map((b) =>
        b.textContent?.trim(),
      );
      expect(labels).toEqual(['M-01']);
    });

    it('clears the selected spot when the chip changes', async () => {
      const { el, text } = await open();

      await click(el, spotButton(el, 'A-01'));
      expect(text()).toContain('A-01 · Standard');

      await click(el, button(el, 'Two Wheeler'));
      expect(text()).toContain('Select a spot');
      expect(continueButton(el).disabled).toBe(true);
    });

    it('shows an empty state when no spots match the vehicle type', async () => {
      const { el, text } = await open();

      await click(el, button(el, 'Heavy'));

      expect(text()).toContain('No spots for this vehicle type');
    });
  });

  describe('non-selectable spots', () => {
    it('disables reserved and occupied spots', async () => {
      const { el } = await open();

      expect(spotButton(el, 'A-02').disabled).toBe(true);
      expect(spotButton(el, 'A-03').disabled).toBe(true);
      await click(el, spotButton(el, 'A-02'));
      expect(el.textContent).toContain('Select a spot');
    });

    it('disables an EV spot for a non-electric vehicle, with an explanation', async () => {
      const { el } = await open();
      const ev = spotButton(el, 'A-04');

      expect(ev.disabled).toBe(true);
      expect(ev.getAttribute('title')).toContain('electric vehicle');
      expect(ev.getAttribute('aria-label')).toContain('electric vehicle');
    });

    it('allows an EV spot for an electric vehicle', async () => {
      const { el, text } = await open({ vehicles: [EV_CAR] });

      await click(el, spotButton(el, 'A-04'));

      expect(text()).toContain('A-04 · EV');
    });

    it('shows a closed banner, makes no spot selectable and disables Continue', async () => {
      const { el, text } = await open({ lot: { ...LOT, isOpen: false } });

      expect(text()).toContain('This lot is closed right now');
      expect(spotButton(el, 'A-01').disabled).toBe(true);
      expect(continueButton(el).disabled).toBe(true);
    });
  });

  describe('floors', () => {
    it('shows the single-floor label when there is one floor', async () => {
      const { text, el } = await open();

      expect(text()).toContain('PICK A SPOT — FLOOR 1');
      expect(el.querySelector('button[aria-pressed][class*="px-4 py-1.5"]:not(.rounded-full)')).toBeNull();
    });

    it('shows floor tabs, defaulting to the lowest, when there are several', async () => {
      const floor2 = spot({ spotId: 's6', spotNumber: 'B-01', floor: 2 });
      const { el, text } = await open({ spots: [floor2, ...SPOTS] });

      expect(text()).not.toContain('PICK A SPOT — FLOOR');
      expect(button(el, 'Floor 1').getAttribute('aria-pressed')).toBe('true');
      expect(spotButton(el, 'B-01')).toBeNull();

      await click(el, button(el, 'Floor 2'));
      expect(spotButton(el, 'B-01')).toBeTruthy();
      expect(spotButton(el, 'A-01')).toBeNull();
    });
  });

  describe('hours stepper and total', () => {
    it('defaults to 3 hours and computes the total from the spot rate', async () => {
      const { el, text } = await open();

      await click(el, spotButton(el, 'A-01'));

      expect(text()).toContain('Estimated total (3 hrs)');
      expect(text()).toContain('₹40/hr');
      expect(text()).toContain('₹120');
    });

    it('stays within 1 to 4 hours', async () => {
      const { el, text } = await open();
      await click(el, spotButton(el, 'A-01'));

      for (let i = 0; i < 5; i++) {
        await click(el, el.querySelector<HTMLButtonElement>('[aria-label="Increase hours"]')!);
      }
      expect(text()).toContain('Estimated total (4 hrs)');
      expect(text()).toContain('₹160');
      expect(el.querySelector<HTMLButtonElement>('[aria-label="Increase hours"]')!.disabled).toBe(true);

      for (let i = 0; i < 6; i++) {
        await click(el, el.querySelector<HTMLButtonElement>('[aria-label="Decrease hours"]')!);
      }
      expect(text()).toContain('Estimated total (1 hrs)');
      expect(text()).toContain('₹40');
      expect(el.querySelector<HTMLButtonElement>('[aria-label="Decrease hours"]')!.disabled).toBe(true);
    });

    it('enables Continue only with a spot, a vehicle and an open lot', async () => {
      const { el } = await open();
      expect(continueButton(el).disabled).toBe(true);

      await click(el, spotButton(el, 'A-01'));
      expect(continueButton(el).disabled).toBe(false);
    });
  });

  describe('continue to review', () => {
    it('navigates to the booking page with spot, vehicle and hours as query params', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await click(el, spotButton(el, 'A-01'));
      await click(el, el.querySelector<HTMLButtonElement>('[aria-label="Decrease hours"]')!);
      await click(el, continueButton(el));

      expect(navigate).toHaveBeenCalledWith(['/lots', 'lot-1', 'book'], {
        queryParams: { spotId: 's1', vehicleId: 'v-car', hours: 2 },
      });
    });
  });

  describe('distance from router state', () => {
    it('shows the distance when router state carries a valid number', async () => {
      const { text } = await open({}, { distanceKm: 0.84 });

      expect(text()).toContain('0.8 km away');
    });

    it.each([[-1], ['0.4'], [Number.NaN], [Infinity]])(
      'omits the distance for invalid value %s',
      (value) => {
        expect(parseDistanceKm({ distanceKm: value })).toBeNull();
      },
    );

    it('omits the distance when there is no router state', async () => {
      const { text } = await open();

      expect(text()).not.toContain('km away');
      expect(parseDistanceKm(null)).toBeNull();
      expect(parseDistanceKm({})).toBeNull();
      expect(parseDistanceKm({ distanceKm: 0 })).toBe(0);
    });
  });

  describe('errors', () => {
    it('shows "Lot not found" with a link back on a 404', async () => {
      const { el, text } = await open({ lot: 404 });

      expect(text()).toContain('Lot not found');
      expect(el.querySelector('a[href="/lots"]')).toBeTruthy();
    });

    it('treats a 400 on a bad id as not found', async () => {
      const { text } = await open({ lot: 400 });

      expect(text()).toContain('Lot not found');
    });

    it('clears the session and redirects to /login on a 401', async () => {
      await router.navigateByUrl('/lots/lot-1');
      harness.detectChanges();
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      httpMock.expectOne(LOT_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
      httpMock.expectOne(SPOTS_URL).flush(envelope([]));
      httpMock.expectOne(VEHICLES_URL).flush(envelope([]));
      await settle();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });

    it('shows a retry banner on a 429 from the spots request', async () => {
      const { text } = await open({ spots: 429 });

      expect(text()).toContain('retry in a few moments');
    });
  });

  describe('helpers', () => {
    it('converts HH:mm:ss to 12-hour display', () => {
      expect(formatTime12h('06:00:00')).toBe('6:00 AM');
      expect(formatTime12h('23:00:00')).toBe('11:00 PM');
      expect(formatTime12h('00:30:00')).toBe('12:30 AM');
      expect(formatTime12h('12:00:00')).toBe('12:00 PM');
    });

    it('rounds the start time up to the next 15 minutes', () => {
      expect(formatStartTime(new Date(2026, 0, 5, 16, 17))).toBe('Today, 4:30 PM');
      expect(formatStartTime(new Date(2026, 0, 5, 16, 30))).toBe('Today, 4:30 PM');
      expect(formatStartTime(new Date(2026, 0, 5, 16, 46))).toBe('Today, 5:00 PM');
      expect(formatStartTime(new Date(2026, 0, 5, 23, 50))).toBe('Tomorrow, 12:00 AM');
    });
  });
});
