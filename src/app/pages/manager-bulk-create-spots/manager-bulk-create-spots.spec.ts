import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerBulkCreateSpots } from './manager-bulk-create-spots';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { SPOT_API } from '../../constants/spot.constants';
import { environment } from '../../../environments/environment';

const SESSION_STORAGE_KEY = 'parkease.session';
const LOT_ID = 'lot-1';
const LOT_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.byId(LOT_ID)}`;
const BULK_URL = `${environment.apiBaseUrl}${SPOT_API.bulkCreate}`;

const LOT = {
  lotId: LOT_ID,
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bengaluru',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 0,
  availableSpots: 0,
  minPricePerHour: 20,
  maxPricePerHour: 60,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: true,
  isOpen: true,
  description: null,
  approvalFeedback: null,
  approvedAt: '2026-01-01T00:00:00Z',
  managerId: 'mgr-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ManagerBulkCreateSpots', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
  });

  function createFixture(paramMap: Record<string, string> = { lotId: LOT_ID }) {
    TestBed.configureTestingModule({
      imports: [ManagerBulkCreateSpots],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(paramMap) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ManagerBulkCreateSpots);
    const component = fixture.componentInstance as unknown as {
      lotId: ManagerBulkCreateSpots['lotId'];
      lotName: ManagerBulkCreateSpots['lotName'];
      lotLoading: ManagerBulkCreateSpots['lotLoading'];
      lotLoadError: ManagerBulkCreateSpots['lotLoadError'];
      rows: ManagerBulkCreateSpots['rows'];
      rowErrors: ManagerBulkCreateSpots['rowErrors'];
      isFormValid: ManagerBulkCreateSpots['isFormValid'];
      submitting: ManagerBulkCreateSpots['submitting'];
      serverError: ManagerBulkCreateSpots['serverError'];
      serverRowErrors: ManagerBulkCreateSpots['serverRowErrors'];
      updateRow: ManagerBulkCreateSpots['updateRow'];
      onSubmit: ManagerBulkCreateSpots['onSubmit'];
      onCancel: ManagerBulkCreateSpots['onCancel'];
    };
    fixture.detectChanges();
    return { fixture, component };
  }

  async function flushLot(fixture: ReturnType<typeof createFixture>['fixture']) {
    httpMock.expectOne(LOT_URL).flush({ success: true, message: null, data: LOT, errors: null });
    await Promise.resolve();
    fixture.detectChanges();
  }

  function fillValidRow(component: ReturnType<typeof createFixture>['component'], index = 0) {
    component.updateRow(index, 'spotNumber', 'A-16');
    component.updateRow(index, 'floor', 'Floor 2');
    component.updateRow(index, 'spotType', 'Standard');
    component.updateRow(index, 'vehicleType', 'Four Wheeler');
    component.updateRow(index, 'price', '40');
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the lot name on load and shows it in the header', async () => {
    const { fixture } = createFixture();
    await flushLot(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Add spots — Whitefield Central Lot');
  });

  it('clears the session and redirects to /login on a 401 while loading the lot', async () => {
    const { fixture } = createFixture();

    httpMock.expectOne(LOT_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('shows a not-found message when the lot 404s', async () => {
    const { fixture, component } = createFixture();

    httpMock.expectOne(LOT_URL).flush(
      { success: false, message: "Lot not found.", data: null, errors: null },
      { status: 404, statusText: 'Not Found' },
    );
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.lotLoadError()).toBe('This lot could not be found. It may have been removed.');
  });

  describe('client-side validation', () => {
    it('flags an incompatible spotType/vehicleType combination and blocks submit', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);

      component.updateRow(0, 'spotNumber', 'A-16');
      component.updateRow(0, 'price', '40');
      component.updateRow(0, 'spotType', 'Motorbike');
      component.updateRow(0, 'vehicleType', 'Four Wheeler');

      expect(component.isFormValid()).toBe(false);
      expect(component.rowErrors()[0].compatibility).toContain('Two Wheeler');

      await component.onSubmit();
      httpMock.expectNone(BULK_URL);
    });

    it('accepts every entry in the compatibility matrix', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);

      const matrix: Array<[string, string]> = [
        ['Compact', 'Four Wheeler'],
        ['Standard', 'Four Wheeler'],
        ['Large', 'Four Wheeler'],
        ['Large', 'Heavy'],
        ['Motorbike', 'Two Wheeler'],
        ['EV', 'Four Wheeler'],
        ['EV', 'Two Wheeler'],
      ];

      for (const [spotType, vehicleType] of matrix) {
        component.updateRow(0, 'spotNumber', 'A-16');
        component.updateRow(0, 'price', '40');
        component.updateRow(0, 'spotType', spotType);
        component.updateRow(0, 'vehicleType', vehicleType);

        expect(component.rowErrors()[0].compatibility).toBeUndefined();
      }
    });

    it('requires a spot number and a positive price', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);

      component.updateRow(0, 'price', '0');

      expect(component.rowErrors()[0].spotNumber).toBe('Spot number is required.');
      expect(component.rowErrors()[0].price).toBe('Price must be greater than 0.');
    });
  });

  describe('submit', () => {
    it('maps display labels to wire enum values, the floor label to a number, and sets isEvCharging for EV rows', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);

      fillValidRow(component, 0);
      component.updateRow(0, 'spotType', 'EV');
      component.updateRow(0, 'vehicleType', 'Two Wheeler');

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        lotId: LOT_ID,
        spots: [
          {
            spotNumber: 'A-16',
            floor: 2,
            spotType: 'EV',
            vehicleType: 'TwoWheeler',
            isEvCharging: true,
            isHandicapped: false,
            pricePerHour: 40,
          },
        ],
      });
      req.flush({ success: true, message: null, data: [], errors: null });
      await submission;
    });

    it('navigates back to /manager/spots on a successful bulk create', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush({ success: true, message: null, data: [{ spotId: 's-1' }], errors: null });
      await submission;

      expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/spots');
    });

    it('shows the backend message on a 409 (lot not approved)', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush(
        { success: false, message: 'Cannot add spots to a lot that has not been approved.', data: null, errors: null },
        { status: 409, statusText: 'Conflict' },
      );
      await submission;
      fixture.detectChanges();

      expect(component.serverError()).toBe('Cannot add spots to a lot that has not been approved.');
    });

    it('shows the backend message on a 404 (lot not found)', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush({ success: false, message: 'Lot not found.', data: null, errors: null }, { status: 404, statusText: 'Not Found' });
      await submission;

      expect(component.serverError()).toBe('Lot not found.');
    });

    it('surfaces the backend message on a 400 compatibility violation that slipped past client validation', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush(
        { success: false, message: 'Standard spots require FourWheeler vehicles.', data: null, errors: null },
        { status: 400, statusText: 'Bad Request' },
      );
      await submission;

      expect(component.serverError()).toBe('Standard spots require FourWheeler vehicles.');
    });

    it('maps indexed 422 field errors back onto the matching row', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush(
        {
          success: false,
          message: 'Validation failed.',
          data: null,
          errors: { 'Spots[0].SpotNumber': ['Spot number must be unique within the lot.'] },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await submission;
      fixture.detectChanges();

      expect(component.serverRowErrors()[0]).toBe('Spot number must be unique within the lot.');
      expect(component.serverError()).toBeNull();
    });

    it('falls back to a general banner on a 422 with no mappable row error', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush(
        { success: false, message: 'Validation failed.', data: null, errors: { SomeUnknownField: ['Unexpected.'] } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await submission;

      expect(component.serverError()).toBe('Validation failed.');
    });

    it('clears the session and redirects to /login on a 401 during submit', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);
      fillValidRow(component);

      const submission = component.onSubmit();
      const req = httpMock.expectOne(BULK_URL);
      req.flush(null, { status: 401, statusText: 'Unauthorized' });
      await submission;

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });

    it('navigates back to /manager/spots without submitting on cancel', async () => {
      const { fixture, component } = createFixture();
      await flushLot(fixture);

      component.onCancel();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/spots');
      httpMock.expectNone(BULK_URL);
    });
  });
});
