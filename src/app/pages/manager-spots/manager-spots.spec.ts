import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerSpots } from './manager-spots';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { SPOT_API } from '../../constants/spot.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { SpotResponse } from '../../models/spot.model';
import { environment } from '../../../environments/environment';

const SESSION_STORAGE_KEY = 'parkease.session';
const MANAGER_ID = 'mgr-1';
const LOTS_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.byManager(MANAGER_ID)}`;

function spotsUrl(lotId: string): string {
  return `${environment.apiBaseUrl}${SPOT_API.byLot(lotId)}`;
}

/** Unwinds the nested await chains (loadLots -> selectLot -> loadSpots) after a flush. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

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

const LOT_1 = {
  lotId: 'lot-whitefield',
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bangalore',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 40,
  availableSpots: 38,
  minPricePerHour: 20,
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

const LOT_2 = {
  ...LOT_1,
  lotId: 'lot-shah-rooftop',
  name: 'Shah Rooftop Deck',
  isApproved: false,
};

function makeSpot(overrides: Partial<SpotResponse>): SpotResponse {
  return {
    spotId: 'spot-default',
    lotId: LOT_1.lotId,
    managerId: MANAGER_ID,
    spotNumber: 'A-01',
    floor: 1,
    spotType: 'Standard',
    vehicleType: 'FourWheeler',
    status: 'Available',
    isHandicapped: false,
    isEvCharging: false,
    pricePerHour: 25,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const SPOTS_FLOOR_1_AND_2 = [
  makeSpot({ spotId: 'spot-3', spotNumber: 'B-01', floor: 3, status: 'Occupied' }),
  makeSpot({ spotId: 'spot-1', spotNumber: 'A-01', floor: 1, status: 'Available' }),
  makeSpot({ spotId: 'spot-2', spotNumber: 'A-02', floor: 1, status: 'Reserved' }),
];

describe('ManagerSpots', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    storeManagerSession();

    await TestBed.configureTestingModule({
      imports: [ManagerSpots],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ManagerSpots);
    const component = fixture.componentInstance as unknown as {
      lots: ManagerSpots['lots'];
      selectedLotId: ManagerSpots['selectedLotId'];
      spots: ManagerSpots['spots'];
      floors: ManagerSpots['floors'];
      selectedFloor: ManagerSpots['selectedFloor'];
      filteredSpots: ManagerSpots['filteredSpots'];
      selectFloor: ManagerSpots['selectFloor'];
      error: ManagerSpots['error'];
    };
    return { fixture, component };
  }

  it('fetches lots for the logged-in manager, defaults the switcher to the first lot, and loads its spots', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const lotsReq = httpMock.expectOne(LOTS_URL);
    expect(lotsReq.request.method).toBe('GET');
    lotsReq.flush({ success: true, message: null, data: [LOT_1, LOT_2], errors: null });
    await Promise.resolve();

    const spotsReq = httpMock.expectOne(spotsUrl(LOT_1.lotId));
    expect(spotsReq.request.method).toBe('GET');
    spotsReq.flush({ success: true, message: null, data: SPOTS_FLOOR_1_AND_2, errors: null });
    await flushAsync();
    fixture.detectChanges();

    expect(component.selectedLotId()).toBe(LOT_1.lotId);
    expect(component.selectedFloor()).toBe(1);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Whitefield Central Lot');
    expect(text).toContain('A-01');
  });

  it('derives the distinct, sorted floor list from the spots returned for the lot', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [LOT_1], errors: null });
    await Promise.resolve();

    httpMock
      .expectOne(spotsUrl(LOT_1.lotId))
      .flush({ success: true, message: null, data: SPOTS_FLOOR_1_AND_2, errors: null });
    await Promise.resolve();

    expect(component.floors()).toEqual([1, 3]);
  });

  it('shows the per-floor empty state when the filtered spots array for the selected floor is empty', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [LOT_1], errors: null });
    await Promise.resolve();

    httpMock
      .expectOne(spotsUrl(LOT_1.lotId))
      .flush({ success: true, message: null, data: SPOTS_FLOOR_1_AND_2, errors: null });
    await flushAsync();
    fixture.detectChanges();

    expect(component.filteredSpots().length).toBeGreaterThan(0);

    // Selecting a floor whose latest fetch contains no matching spots should trigger the empty state,
    // driven off the real filtered-to-zero-length array rather than any mock data.
    void component.selectFloor(2);
    const secondSpotsReq = httpMock.expectOne(spotsUrl(LOT_1.lotId));
    secondSpotsReq.flush({ success: true, message: null, data: SPOTS_FLOOR_1_AND_2, errors: null });
    await flushAsync();
    fixture.detectChanges();

    expect(component.selectedFloor()).toBe(2);
    expect(component.filteredSpots().length).toBe(0);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Floor 2 has no spots yet.');
    expect(text).toContain('+ Add spots to this floor');
    expect(fixture.nativeElement.querySelectorAll('.grid').length).toBe(0);
  });

  it('clears the session and redirects to /login on a 401 while loading lots', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    httpMock.expectOne(LOTS_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(component.error()).toBe('Your session has expired. Please log in again.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('shows an empty state when the manager has no lots', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();

    httpMock.expectOne(LOTS_URL).flush({ success: true, message: null, data: [], errors: null });
    await Promise.resolve();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("You don't have any lots yet.");
  });
});
