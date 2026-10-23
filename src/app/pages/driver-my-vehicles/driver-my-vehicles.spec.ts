import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { DriverMyVehicles } from './driver-my-vehicles';
import { AuthService } from '../../services/auth.service';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';
import { environment } from '../../../environments/environment';

@Component({ template: 'stub' })
class Stub {}

const API = environment.apiBaseUrl;

const CAR: VehicleResponse = {
  vehicleId: 'v-1',
  driverId: 'd-1',
  plateNumber: 'KA05MJ4471',
  vehicleType: 'FourWheeler',
  make: 'Honda',
  model: 'City',
  isElectric: false,
  isActive: true,
  createdAt: '2026-09-16T15:30:00Z',
  updatedAt: '2026-09-16T15:30:00Z',
};
const BIKE: VehicleResponse = {
  ...CAR,
  vehicleId: 'v-2',
  plateNumber: 'TEMP-1234',
  vehicleType: 'TwoWheeler',
  make: 'Ather',
  model: '450X',
  isElectric: true,
};

const envelope = (data: unknown, message: string | null = null) => ({
  success: true,
  message,
  data,
  errors: null,
});
const failure = (message: string | null, errors: Record<string, string[]> | null = null) => ({
  success: false,
  message,
  data: null,
  errors,
});

describe('DriverMyVehicles', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'vehicles', component: DriverMyVehicles },
          { path: 'lots/:lotId', component: Stub },
          { path: 'lots', component: Stub },
          { path: 'login', component: Stub },
        ]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        await Promise.resolve();
      }
      harness.detectChanges();
    }
  }

  const listRequest = () => httpMock.expectOne(`${API}/api/vehicles/my`);

  /** Opens /vehicles. `list`: array -> 200, number -> that status, undefined -> left pending. */
  async function open(list?: VehicleResponse[] | number, state?: unknown) {
    if (state !== undefined) {
      vi.spyOn(history, 'state', 'get').mockReturnValue(state);
    }
    harness = await RouterTestingHarness.create('/vehicles');
    root = harness.routeNativeElement as HTMLElement;
    if (Array.isArray(list)) {
      listRequest().flush(envelope(list));
    } else if (typeof list === 'number') {
      listRequest().flush(failure('boom'), { status: list, statusText: 'err' });
    }
    await settle();
  }

  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const one = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const text = () => root.textContent ?? '';
  const button = (label: string) =>
    all('button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  const cards = () => all('main li');

  async function click(el: HTMLElement) {
    el.click();
    await settle();
  }

  function type(selector: string, value: string) {
    const input = one<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
  }

  describe('list', () => {
    it('shows a loading state until the vehicles arrive', async () => {
      await open();
      expect(text()).toContain('Loading your vehicles…');
      listRequest().flush(envelope([CAR]));
      await settle();
      expect(text()).not.toContain('Loading your vehicles…');
      expect(cards().length).toBe(1);
    });

    it('renders a card per vehicle, in the order returned', async () => {
      await open([CAR, BIKE]);
      expect(cards().length).toBe(2);
      expect(cards()[0].textContent).toContain('KA 05 MJ 4471');
      expect(cards()[0].textContent).toContain('Honda City');
      expect(cards()[0].textContent).toContain('Four Wheeler');
      expect(cards()[0].textContent).not.toContain('Electric');
      expect(cards()[1].textContent).toContain('Ather 450X');
      expect(cards()[1].textContent).toContain('Two Wheeler · Electric');
      expect(cards().every((c) => c.querySelectorAll('button').length === 1)).toBe(true);
    });

    it('shows a non-standard plate exactly as stored', async () => {
      await open([BIKE]);
      expect(cards()[0].textContent).toContain('TEMP-1234');
    });

    it('shows the empty state with the Add vehicle button', async () => {
      await open([]);
      expect(text()).toContain("You haven't added any vehicles yet.");
      expect(cards().length).toBe(0);
      expect(button('+ Add vehicle')).toBeTruthy();
    });

    it('shows an error banner (and no empty state) when loading fails', async () => {
      await open(500);
      expect(one('[role="alert"]').textContent).toContain('Something went wrong on our side');
      expect(text()).not.toContain("You haven't added any vehicles yet.");
    });

    it('clears the session and redirects to /login on 401', async () => {
      const clear = vi.spyOn(TestBed.inject(AuthService), 'clearSession');
      await open(401);
      await harness.fixture.whenStable();
      expect(clear).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });
  });

  describe('add vehicle', () => {
    beforeEach(async () => {
      await open([CAR]);
      await click(button('+ Add vehicle'));
    });

    const fill = (plate = 'ka 05-mj 4471', make = 'Tata', model = 'Prima') => {
      type('#plate', plate);
      type('#make', make);
      type('#model', model);
    };
    const choose = (label: string) => button(label).click();
    const submit = () => click(one<HTMLButtonElement>('form button[type="submit"]'));
    const createRequest = () => httpMock.expectOne((r) => r.method === 'POST' && r.url === `${API}/api/vehicles`);
    const noCreateRequest = () =>
      httpMock.expectNone((r) => r.method === 'POST' && r.url === `${API}/api/vehicles`);

    it('normalizes the plate and sends vehicleType as an integer', async () => {
      fill();
      choose('Four Wheeler');
      harness.detectChanges();
      await submit();

      const req = createRequest();
      expect(req.request.body).toEqual({
        plateNumber: 'KA05MJ4471',
        vehicleType: 1,
        make: 'Tata',
        model: 'Prima',
        isElectric: false,
      });
      req.flush(envelope(CAR), { status: 201, statusText: 'Created' });
      await settle();
      listRequest().flush(envelope([CAR]));
      await settle();
    });

    it.each([
      ['Two Wheeler', 0],
      ['Heavy', 2],
    ])('sends %s as %i and Heavy is never electric', async (label, value) => {
      fill();
      choose(label);
      harness.detectChanges();
      await submit();

      const req = createRequest();
      expect(req.request.body.vehicleType).toBe(value);
      expect(req.request.body.isElectric).toBe(false);
      req.flush(failure('x'), { status: 500, statusText: 'err' });
      await settle();
    });

    it('closes the modal, returns focus to the opener and refreshes the list on success', async () => {
      fill();
      choose('Four Wheeler');
      harness.detectChanges();
      await submit();

      createRequest().flush(envelope(CAR), { status: 201, statusText: 'Created' });
      await settle();
      expect(root.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(button('+ Add vehicle'));

      listRequest().flush(envelope([CAR, BIKE]));
      await settle();
      expect(cards().length).toBe(2);
    });

    it('validates required fields and shows messages without calling the API', async () => {
      await submit();
      noCreateRequest();
      expect(text()).toContain('Plate number is required.');
      expect(text()).toContain('Choose a vehicle type.');
      expect(text()).toContain('Make is required.');
      expect(text()).toContain('Model is required.');
      expect(one('#plate').getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects a plate over 20 characters and make/model over 50', async () => {
      fill('A'.repeat(21), 'M'.repeat(51), 'X'.repeat(51));
      choose('Four Wheeler');
      harness.detectChanges();
      await submit();
      noCreateRequest();
      expect(text()).toContain('Plate number must be 20 characters or fewer.');
      expect(text()).toContain('Make must be 50 characters or fewer.');
      expect(text()).toContain('Model must be 50 characters or fewer.');
    });

    it('accepts boundary lengths (plate counted after removing spaces and dashes)', async () => {
      fill(`${'A'.repeat(10)} - ${'B'.repeat(10)}`, 'M'.repeat(50), 'X'.repeat(50));
      choose('Four Wheeler');
      harness.detectChanges();
      await submit();
      const req = createRequest();
      expect(req.request.body.plateNumber).toBe('A'.repeat(10) + 'B'.repeat(10));
      req.flush(failure('x'), { status: 500, statusText: 'err' });
      await settle();
    });

    async function submitValid(): Promise<TestRequest> {
      fill();
      choose('Four Wheeler');
      harness.detectChanges();
      await submit();
      return createRequest();
    }

    it('shows the backend message on the plate field for 409 and stays open', async () => {
      const req = await submitValid();
      req.flush(failure("A vehicle with plate number 'KA05MJ4471' is already registered."), {
        status: 409,
        statusText: 'Conflict',
      });
      await settle();
      expect(root.querySelector('[role="dialog"]')).not.toBeNull();
      expect(one('#plate-help').textContent).toContain('is already registered.');
      expect(one('#plate').getAttribute('aria-invalid')).toBe('true');
    });

    it('maps 422 errors to fields case-insensitively', async () => {
      const req = await submitValid();
      req.flush(
        failure('Validation failed.', { PlateNumber: ['Plate is invalid.'], make: ['Make is bad.'] }),
        { status: 422, statusText: 'Unprocessable' },
      );
      await settle();
      expect(text()).toContain('Plate is invalid.');
      expect(text()).toContain('Make is bad.');
    });

    it('shows the top-level message for a 422 without field errors', async () => {
      const req = await submitValid();
      req.flush(failure('Validation failed.'), { status: 422, statusText: 'Unprocessable' });
      await settle();
      expect(one('[role="alert"]').textContent).toContain('Validation failed.');
    });

    it('shows the backend message in the modal for 400', async () => {
      const req = await submitValid();
      req.flush(failure('Heavy vehicles cannot be electric.'), { status: 400, statusText: 'Bad' });
      await settle();
      expect(one('[role="alert"]').textContent).toContain('Heavy vehicles cannot be electric.');
    });

    it('tells the user to retry shortly on 429', async () => {
      const req = await submitValid();
      req.flush(failure(null), { status: 429, statusText: 'Too Many' });
      await settle();
      expect(one('[role="alert"]').textContent).toContain('retry in a few moments');
    });

    it('redirects to /login on 401', async () => {
      const clear = vi.spyOn(TestBed.inject(AuthService), 'clearSession');
      const req = await submitValid();
      req.flush(failure(null), { status: 401, statusText: 'Unauthorized' });
      await settle();
      await harness.fixture.whenStable();
      expect(clear).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });

    it('prevents a double submit and shows the submitting state', async () => {
      fill();
      choose('Four Wheeler');
      harness.detectChanges();
      const submitButton = one<HTMLButtonElement>('form button[type="submit"]');
      submitButton.click();
      submitButton.click();
      await settle();

      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toContain('Adding…');
      const req = createRequest();
      req.flush(failure('x'), { status: 500, statusText: 'err' });
      await settle();
    });
  });

  describe('delete vehicle', () => {
    const deleteUrl = (confirm: boolean) => `${API}/api/vehicles/v-1?confirm=${confirm}`;
    const dialog = () => root.querySelector('[role="alertdialog"]');

    beforeEach(async () => {
      await open([CAR, BIKE]);
      await click(all('main li button')[0]);
    });

    it('deletes without confirm, then closes the dialog and removes the card', async () => {
      expect(dialog()?.textContent).toContain('KA 05 MJ 4471');
      expect(dialog()?.textContent).toContain('(Honda City)');
      await click(dialog()!.querySelectorAll('button')[1]);

      const req = httpMock.expectOne(deleteUrl(false));
      expect(req.request.method).toBe('DELETE');
      req.flush(envelope(null, 'Vehicle deleted.'));
      await settle();

      expect(dialog()).toBeNull();
      expect(cards().length).toBe(1);
      expect(cards()[0].textContent).toContain('Ather 450X');
    });

    it('treats 404 as already deleted', async () => {
      await click(dialog()!.querySelectorAll('button')[1]);
      httpMock.expectOne(deleteUrl(false)).flush(failure('Not found'), { status: 404, statusText: 'NF' });
      await settle();
      expect(dialog()).toBeNull();
      expect(cards().length).toBe(1);
    });

    it('switches to the warning variant on 409 and deletes with confirm=true', async () => {
      await click(dialog()!.querySelectorAll('button')[1]);
      httpMock.expectOne(deleteUrl(false)).flush(
        failure('This vehicle has an upcoming booking — deleting it will cancel that booking.'),
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(dialog()?.textContent).toContain('upcoming booking');
      const confirmButton = dialog()!.querySelectorAll('button')[1];
      expect(confirmButton.textContent?.trim()).toBe('Delete anyway');
      expect(cards().length).toBe(2);

      await click(confirmButton);
      httpMock.expectOne(deleteUrl(true)).flush(envelope(null));
      await settle();
      expect(dialog()).toBeNull();
      expect(cards().length).toBe(1);
    });

    it('makes no call when cancelled, in either step', async () => {
      await click(button('Cancel'));
      expect(dialog()).toBeNull();
      httpMock.expectNone(() => true);
      expect(cards().length).toBe(2);

      await click(all('main li button')[0]);
      await click(dialog()!.querySelectorAll('button')[1]);
      httpMock.expectOne(deleteUrl(false)).flush(failure('Upcoming booking.'), {
        status: 409,
        statusText: 'Conflict',
      });
      await settle();
      await click(button('Cancel'));
      expect(dialog()).toBeNull();
      httpMock.expectNone(() => true);
      expect(cards().length).toBe(2);
    });

    it('ignores a second click while the request is in flight', async () => {
      const confirmButton = dialog()!.querySelectorAll('button')[1];
      confirmButton.click();
      confirmButton.click();
      await settle();
      expect(confirmButton.disabled).toBe(true);
      httpMock.expectOne(deleteUrl(false)).flush(envelope(null));
      await settle();
    });

    it('shows other errors inside the dialog and keeps it open', async () => {
      await click(dialog()!.querySelectorAll('button')[1]);
      httpMock.expectOne(deleteUrl(false)).flush(failure('x'), { status: 500, statusText: 'err' });
      await settle();
      expect(dialog()?.textContent).toContain('Something went wrong on our side');
      expect(cards().length).toBe(2);
    });

    it('redirects to /login on 401', async () => {
      const clear = vi.spyOn(TestBed.inject(AuthService), 'clearSession');
      await click(dialog()!.querySelectorAll('button')[1]);
      httpMock.expectOne(deleteUrl(false)).flush(failure(null), { status: 401, statusText: 'Unauthorized' });
      await settle();
      await harness.fixture.whenStable();
      expect(clear).toHaveBeenCalled();
      expect(router.url).toBe('/login');
    });
  });

  describe('returnTo', () => {
    const backLink = () => all('a').find((a) => a.textContent?.includes('← Back to lot'));
    const bannerButton = () => all('a').find((a) => a.textContent?.trim() === 'Back to lot');

    async function addVehicle() {
      await click(button('+ Add vehicle'));
      type('#plate', 'KA05MJ4471');
      type('#make', 'Honda');
      type('#model', 'City');
      button('Four Wheeler').click();
      harness.detectChanges();
      await click(one<HTMLButtonElement>('form button[type="submit"]'));
      httpMock
        .expectOne((r) => r.method === 'POST')
        .flush(envelope(CAR), { status: 201, statusText: 'Created' });
      await settle();
      listRequest().flush(envelope([CAR]));
      await settle();
    }

    it('shows the back link, and the banner button after a successful add, for a valid returnTo', async () => {
      await open([], { returnTo: '/lots/abc-123' });
      expect(backLink()?.getAttribute('href')).toBe('/lots/abc-123');
      expect(bannerButton()).toBeUndefined();

      await addVehicle();
      expect(text()).toContain('Vehicle added');
      expect(bannerButton()?.getAttribute('href')).toBe('/lots/abc-123');
    });

    it.each([
      ['missing', undefined],
      ['an external URL', { returnTo: 'https://evil.example/lots/1' }],
      ['a wrong path', { returnTo: '/bookings/1' }],
    ])('shows neither the link nor the banner when returnTo is %s', async (_label, state) => {
      await open([], state ?? {});
      expect(backLink()).toBeUndefined();

      await addVehicle();
      expect(text()).not.toContain('Vehicle added');
      expect(bannerButton()).toBeUndefined();
    });
  });

  describe('focus return', () => {
    it('returns focus to the element that triggered the overlay even if it was not focused on click', async () => {
      await open([CAR]);
      const addButton = button('+ Add vehicle');
      expect(document.activeElement).not.toBe(addButton);

      await click(addButton);
      expect(document.activeElement?.id).toBe('plate');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(document.activeElement).toBe(addButton);

      const deleteButton = all('main li button')[0];
      await click(deleteButton);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(document.activeElement).toBe(deleteButton);
    });

    it('moves focus to + Add vehicle after the deleted card (the opener) disappears', async () => {
      await open([CAR]);
      await click(all('main li button')[0]);
      await click(root.querySelector('[role="alertdialog"]')!.querySelectorAll('button')[1]);
      httpMock.expectOne(`${API}/api/vehicles/v-1?confirm=false`).flush(envelope(null));
      await settle();
      expect(document.activeElement).toBe(button('+ Add vehicle'));
    });
  });

  describe('overlay accessibility', () => {
    it('is a labelled modal that locks scroll and restores it', async () => {
      await open([CAR]);
      await click(button('+ Add vehicle'));
      const dialog = one('[role="dialog"]');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');
      await click(button('Cancel'));
      expect(document.body.style.overflow).toBe('');
    });

    it('disables the Electric switch while Heavy is selected', async () => {
      await open([CAR]);
      await click(button('+ Add vehicle'));
      const toggle = one<HTMLButtonElement>('[role="switch"]');
      toggle.click();
      harness.detectChanges();
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      button('Heavy').click();
      harness.detectChanges();
      expect(toggle.disabled).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(text()).toContain("Heavy vehicles can't be electric");
    });

    it('moves the vehicle type with arrow keys', async () => {
      await open([CAR]);
      await click(button('+ Add vehicle'));
      const radios = all('[role="radio"]');
      radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      harness.detectChanges();
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    });
  });
});
