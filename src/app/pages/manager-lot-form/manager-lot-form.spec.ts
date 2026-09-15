import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { ManagerLotForm } from './manager-lot-form';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { environment } from '../../../environments/environment';

const LOT_ID = 'lot-1';
const CREATE_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.create}`;
const BY_ID_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.byId(LOT_ID)}`;

const EXISTING_LOT = {
  lotId: LOT_ID,
  name: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bengaluru',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 40,
  availableSpots: 40,
  minPricePerHour: 30,
  maxPricePerHour: 60,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: true,
  isOpen: true,
  description: 'Covered multi-level lot near ITPL tech park, CCTV monitored.',
  approvalFeedback: null,
  approvedAt: '2026-01-01T00:00:00Z',
  managerId: 'mgr-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ManagerLotForm', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  function createFixture(paramMap: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ManagerLotForm],
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
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ManagerLotForm);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      heading: string;
      lotForm: ManagerLotForm['lotForm'];
      serverError: ManagerLotForm['serverError'];
      loading: ManagerLotForm['loading'];
      loadError: ManagerLotForm['loadError'];
      onCancel: ManagerLotForm['onCancel'];
    };
    return { fixture, component };
  }

  function fillValidForm(component: ReturnType<typeof createFixture>['component']) {
    component.lotForm.name().value.set('Central Mall Parking');
    component.lotForm.address().value.set('123 MG Road, Bangalore, India');
    component.lotForm.city().value.set('Bangalore');
    component.lotForm.totalSpots().value.set(50);
    component.lotForm.minPricePerHour().value.set(20);
    component.lotForm.maxPricePerHour().value.set(80);
    component.lotForm.openTime().value.set('06:00');
    component.lotForm.closeTime().value.set('23:00');
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the create heading and does not fetch a lot when there is no id param', () => {
    const { component } = createFixture();

    expect(component.heading).toBe('Add a new lot');
    expect(component.loading()).toBe(false);
  });

  it('fetches and pre-fills the lot in edit mode', async () => {
    const { component } = createFixture({ id: LOT_ID });

    expect(component.loading()).toBe(true);
    const req = httpMock.expectOne(BY_ID_URL);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: EXISTING_LOT, errors: null });
    await Promise.resolve();

    expect(component.heading).toBe('Edit lot');
    expect(component.loading()).toBe(false);
    expect(component.lotForm.name().value()).toBe('Whitefield Central Lot');
    expect(component.lotForm.totalSpots().value()).toBe(40);
    expect(component.lotForm.openTime().value()).toBe('06:00');
    expect(component.lotForm.closeTime().value()).toBe('23:00');
  });

  it('redirects to the dashboard with a message when the lot is not found (404)', async () => {
    const { component } = createFixture({ id: LOT_ID });

    const req = httpMock.expectOne(BY_ID_URL);
    req.flush(
      { success: false, message: "Parking lot 'lot-1' not found.", data: null, errors: null },
      { status: 404, statusText: 'Not Found' },
    );
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/manager/lots'], {
      state: { errorMessage: 'That lot could not be found. It may have been removed.' },
    });
  });

  it('redirects to the dashboard with a message when the manager does not own the lot (401)', async () => {
    const { component } = createFixture({ id: LOT_ID });

    const req = httpMock.expectOne(BY_ID_URL);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/manager/lots'], {
      state: { errorMessage: "You don't have permission to edit this lot." },
    });
  });

  it('flags max price lower than min price with the inline message', () => {
    const { component } = createFixture();

    component.lotForm.minPricePerHour().value.set(30);
    component.lotForm.maxPricePerHour().value.set(25);

    expect(component.lotForm.maxPricePerHour().valid()).toBe(false);
    expect(component.lotForm.maxPricePerHour().errors()[0]?.message).toBe(
      'Max price must be greater than or equal to min price',
    );
  });

  it('rejects a total spots of 0 or less', () => {
    const { component } = createFixture();

    component.lotForm.totalSpots().value.set(0);

    expect(component.lotForm.totalSpots().valid()).toBe(false);
  });

  it('creates a lot without sending latitude/longitude and navigates back on success', async () => {
    const { component } = createFixture();
    fillValidForm(component);

    const submission = submit(component.lotForm);

    const req = httpMock.expectOne(CREATE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Central Mall Parking',
      address: '123 MG Road, Bangalore, India',
      city: 'Bangalore',
      totalSpots: 50,
      minPricePerHour: 20,
      maxPricePerHour: 80,
      openTime: '06:00:00',
      closeTime: '23:00:00',
    });
    req.flush({
      success: true,
      message: 'Parking lot created and approved.',
      data: { ...EXISTING_LOT, lotId: 'new-lot' },
      errors: null,
    });

    await submission;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/lots');
  });

  it('updates a lot with the full request body on submit', async () => {
    const { component } = createFixture({ id: LOT_ID });
    httpMock.expectOne(BY_ID_URL).flush({ success: true, message: null, data: EXISTING_LOT, errors: null });
    await Promise.resolve();

    component.lotForm.description().value.set('Updated description');
    const submission = submit(component.lotForm);

    const req = httpMock.expectOne(BY_ID_URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      name: 'Whitefield Central Lot',
      address: '2nd Cross, ITPL Main Rd',
      city: 'Bengaluru',
      totalSpots: 40,
      minPricePerHour: 30,
      maxPricePerHour: 60,
      openTime: '06:00:00',
      closeTime: '23:00:00',
      description: 'Updated description',
    });
    req.flush({ success: true, message: null, data: EXISTING_LOT, errors: null });

    await submission;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/lots');
  });

  it('surfaces the backend message directly on a geocode-failure 409', async () => {
    const { component } = createFixture();
    fillValidForm(component);

    const submission = submit(component.lotForm);

    const req = httpMock.expectOne(CREATE_URL);
    req.flush(
      {
        success: false,
        message: "Could not resolve coordinates for address: '123 Fake St'. Please provide a more specific address (include city and country).",
        data: null,
        errors: null,
      },
      { status: 409, statusText: 'Conflict' },
    );

    await submission;

    expect(component.serverError()).toBe(
      "Could not resolve coordinates for address: '123 Fake St'. Please provide a more specific address (include city and country).",
    );
  });

  it('maps a 422 field validation error onto the matching input', async () => {
    const { component } = createFixture();
    fillValidForm(component);

    const submission = submit(component.lotForm);

    const req = httpMock.expectOne(CREATE_URL);
    req.flush(
      {
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: { Name: ['Name must be between 1 and 200 characters.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await submission;

    expect(component.lotForm.name().errors()[0]?.message).toBe(
      'Name must be between 1 and 200 characters.',
    );
    expect(component.serverError()).toBeNull();
  });

  it('falls back to the top-level message on a 422 with no mappable field', async () => {
    const { component } = createFixture();
    fillValidForm(component);

    const submission = submit(component.lotForm);

    const req = httpMock.expectOne(CREATE_URL);
    req.flush(
      {
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: { SomeUnknownField: ['Unexpected.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await submission;

    expect(component.serverError()).toBe('Validation failed.');
  });

  it('navigates back to the dashboard on cancel', () => {
    const { component } = createFixture();

    component.onCancel();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/lots');
  });
});
