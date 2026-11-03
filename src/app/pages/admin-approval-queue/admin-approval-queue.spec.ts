import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  ALREADY_HANDLED_NOTICE,
  AdminApprovalQueue,
  GENERIC_ERROR_MESSAGE,
  LOT_GONE_NOTICE,
} from './admin-approval-queue';
import { AUTH_API } from '../../constants/auth.constants';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { ApplicationStatus } from '../../models/auth/application-status.enum';
import { environment } from '../../../environments/environment';

const APPLICATIONS_URL = `${environment.apiBaseUrl}${AUTH_API.managerApplications}`;
const PENDING_LOTS_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.pending}`;
const approveManagerUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.approveManager(id)}`;
const rejectManagerUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.rejectManager(id)}`;
const approveLotUrl = (id: string) => `${environment.apiBaseUrl}${PARKINGLOT_API.approve(id)}`;
const rejectLotUrl = (id: string) => `${environment.apiBaseUrl}${PARKINGLOT_API.reject(id)}`;

const APPLICATION_A = {
  applicationId: 'app-1',
  userId: 'user-1',
  fullName: 'Priya Shah',
  email: 'priya.shah@business.com',
  phone: '9876543210',
  businessName: 'Shah Parking Services',
  parkingAddress: '4th Block, Koramangala',
  status: ApplicationStatus.Pending,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const LOT_A = {
  lotId: 'lot-1',
  name: 'Shah Rooftop Deck',
  address: 'Koramangala 6th Block',
  city: 'bangalore',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 18,
  availableSpots: 18,
  minPricePerHour: 35,
  maxPricePerHour: 55,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: false,
  isOpen: false,
  description: null,
  approvalFeedback: null,
  approvedAt: null,
  managerId: 'mgr-1',
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  approvalStatus: 'Pending',
  managerName: 'Priya Shah',
};

const LOT_B = {
  ...LOT_A,
  lotId: 'lot-2',
  name: 'Kumar Auto Deck 2',
  managerId: 'mgr-2',
  managerName: null,
};

const envelope = (data: unknown) => ({ success: true, message: null, data, errors: null });
const failure = (message: string | null) => ({ success: false, message, data: null, errors: null });

describe('AdminApprovalQueue', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminApprovalQueue],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Internals = any;

  function createFixture() {
    const fixture = TestBed.createComponent(AdminApprovalQueue);
    return { fixture, component: fixture.componentInstance as unknown as Internals };
  }

  function flushInitialApplications(items: unknown[] = [APPLICATION_A]) {
    httpMock
      .expectOne(
        (r) =>
          r.url === APPLICATIONS_URL &&
          r.params.get('page') === '1' &&
          r.params.get('pageSize') === '10' &&
          r.params.get('status') === 'Pending',
      )
      .flush(envelope({ items, totalCount: items.length, page: 1, pageSize: 10, totalPages: 1 }));
  }

  /** Renders the page, loads the applications tab, then loads and shows the Lot approvals tab. */
  async function openLots(lots: unknown[] = [LOT_A]) {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const loading = component.loadPendingLots();
    httpMock.expectOne(PENDING_LOTS_URL).flush(envelope(lots));
    await loading;

    component.subTab.set('lot-approvals');
    fixture.detectChanges();
    return { fixture, component, el: fixture.nativeElement as HTMLElement };
  }

  const cards = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('article'));
  const approveBtn = (card: HTMLElement) => card.querySelector<HTMLButtonElement>('[data-approve]')!;
  const rejectBtn = (card: HTMLElement) => card.querySelector<HTMLButtonElement>('[data-reject]')!;

  function confirmRejectDialog(fixture: ComponentFixture<AdminApprovalQueue>) {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button'));
    buttons.find((b) => b.textContent?.trim() === 'Reject')!.click();
    fixture.detectChanges();
  }

  // ---- Manager applications tab ----

  describe('Manager applications tab', () => {
    it('loads pending manager applications on init', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      expect(component.applications()).toEqual([APPLICATION_A]);
      expect(component.applicationsLoading()).toBe(false);
    });

    it('refetches with the new page when the page changes', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      component.changeApplicationsPage(2);
      httpMock
        .expectOne((r) => r.url === APPLICATIONS_URL && r.params.get('page') === '2')
        .flush(envelope({ items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 2 }));
      await Promise.resolve();

      expect(component.applicationsPage()).toBe(2);
    });

    it('approves an application with no body, shows a success message, and refetches', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      const approval = component.approveApplication('app-1');
      const putReq = httpMock.expectOne(approveManagerUrl('app-1'));
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body).toEqual({});
      putReq.flush(envelope({}));
      await approval;

      expect(component.successMessage()).toBe('Application approved.');
      flushInitialApplications([]);
      await Promise.resolve();
    });

    it('shows the server message on a 409 and reloads the list', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      const rejection = component.rejectApplication('app-1');
      httpMock
        .expectOne(rejectManagerUrl('app-1'))
        .flush(failure("Cannot reject an application with status 'Approved'."), {
          status: 409,
          statusText: 'Conflict',
        });
      await rejection;

      expect(component.applicationsError()).toBe("Cannot reject an application with status 'Approved'.");
      expect(component.successMessage()).toBeNull();
      flushInitialApplications([]);
      await Promise.resolve();
    });

    it('shows the server message on a 409 from approve and reloads the list', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      const approval = component.approveApplication('app-1');
      httpMock
        .expectOne(approveManagerUrl('app-1'))
        .flush(failure("Cannot approve an application with status 'Rejected'."), {
          status: 409,
          statusText: 'Conflict',
        });
      await approval;

      expect(component.applicationsError()).toBe("Cannot approve an application with status 'Rejected'.");
      flushInitialApplications([]);
      await Promise.resolve();
    });

    it('clears the session and redirects to /login on a 401', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();

      httpMock
        .expectOne((r) => r.url === APPLICATIONS_URL)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      await Promise.resolve();

      expect(component.applicationsError()).toBe('Your session has expired. Please log in again.');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('parkease.session')).toBeNull();
    });

    it('goes to /403 on a 403', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();

      httpMock
        .expectOne((r) => r.url === APPLICATIONS_URL)
        .flush(null, { status: 403, statusText: 'Forbidden' });
      await Promise.resolve();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/403');
    });

    it('shows no banner on a 429', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();

      httpMock
        .expectOne((r) => r.url === APPLICATIONS_URL)
        .flush(failure('Too many requests. Please try again later.'), {
          status: 429,
          statusText: 'Too Many Requests',
        });
      await Promise.resolve();

      expect(component.applicationsError()).toBeNull();
      expect(component.applicationsLoading()).toBe(false);
    });

    it('shows a friendly message instead of "Failed to fetch" when the network fails', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();

      httpMock
        .expectOne((r) => r.url === APPLICATIONS_URL)
        .error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
      await Promise.resolve();

      expect(component.applicationsError()).toBe(
        "Couldn't reach the server. Check your connection and try again.",
      );
    });

    it('renders the title with an em dash and the error banner in red-700', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('article h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Priya Shah \u2014 Shah Parking Services',
      );

      component.applicationsError.set('Boom');
      fixture.detectChanges();
      const banner = el.querySelector('[role="alert"]')!;
      expect(banner.className).toContain('text-red-700');
      expect(banner.className).not.toContain('text-red-600');
    });
  });

  describe('Manager applications card styling', () => {
    it('matches the lot cards: red-700 Reject, focus rings, stacks on mobile', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const card = (fixture.nativeElement as HTMLElement).querySelector('article')!;

      const reject = card.querySelector('[data-reject-application]')!;
      expect(reject.className).toContain('text-red-700');
      expect(reject.className).toContain('border-red-700');
      expect(reject.className).not.toContain('red-600');
      expect(reject.className).not.toContain('red-300');

      const approve = card.querySelector('[data-approve-application]')!;
      const textarea = card.querySelector('textarea')!;
      for (const el of [approve, reject, textarea]) {
        expect(el.className).toContain('focus-visible:outline-2');
        expect(el.className).not.toContain('focus:outline-none');
        expect(el.className).not.toContain('outline-none');
      }

      expect(card.firstElementChild?.className).toContain('max-md:flex-col');
      expect(approve.parentElement?.className).toContain('max-md:w-full');
    });
  });

  // ---- Tabs ----

  describe('tabs', () => {
    it('has tablist, tab and tabpanel semantics', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('[role="tablist"]')).not.toBeNull();
      const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
      expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Manager applications', 'Lot approvals']);
      expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1']);

      const panel = el.querySelector('[role="tabpanel"]')!;
      expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    });

    it('moves between tabs with the arrow keys, loads the lots, and keeps the ?tab= query', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const tablist = el.querySelector('[role="tablist"]')!;

      tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      httpMock.expectOne(PENDING_LOTS_URL).flush(envelope([]));
      await Promise.resolve();
      fixture.detectChanges();

      const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
      expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0']);
      expect(el.ownerDocument.activeElement).toBe(tabs[1]);
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { tab: 'lot-approvals' } }),
      );

      tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      fixture.detectChanges();
      expect(
        Array.from(el.querySelectorAll('[role="tab"]')).map((t) => t.getAttribute('aria-selected')),
      ).toEqual(['true', 'false']);
    });

    it('ignores other keys', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      el.querySelector('[role="tablist"]')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
      );
      fixture.detectChanges();
      expect(el.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('switches to the Lot approvals tab when the URL carries ?tab=lot-approvals', async () => {
      Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParamMap', {
        value: of(convertToParamMap({ tab: 'lot-approvals' })),
      });
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      httpMock.expectOne(PENDING_LOTS_URL).flush(envelope([]));
      expect(component.subTab()).toBe('lot-approvals');
    });

    it('marks AdminNav active for the selected tab only (default is Manager Applications)', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const active = () =>
        Array.from(el.querySelectorAll('app-admin-nav a.font-semibold')).map((a) => a.textContent?.trim());

      expect(active()).toEqual(['Manager Applications']);
      component.subTab.set('lot-approvals');
      fixture.detectChanges();
      expect(active()).toEqual(['Lot Approvals']);
    });
  });

  // ---- Lot approvals tab ----

  describe('Lot approvals tab', () => {
    it('shows pending lots from the server with managerName, and Unknown manager for null', async () => {
      const { el } = await openLots([LOT_A, LOT_B]);
      const titles = cards(el).map((c) => c.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim());

      expect(titles).toEqual([
        'Shah Rooftop Deck \u2014 Priya Shah',
        'Kumar Auto Deck 2 \u2014 Unknown manager',
      ]);
    });

    it('renders the sub-line, labelled textarea limited to 500 and the counter', async () => {
      const { fixture, component, el } = await openLots();

      expect(el.querySelector('article p')?.textContent).toContain(
        `${LOT_A.address} · 18 spots · ₹35–₹55/hr · Submitted 2 days ago`,
      );
      const textarea = el.querySelector('article textarea') as HTMLTextAreaElement;
      expect(textarea.placeholder).toBe('Optional feedback for the manager (shown if rejected)');
      expect(textarea.getAttribute('maxlength')).toBe('500');
      expect(el.querySelector(`label[for="${textarea.id}"]`)?.textContent?.trim()).toBe(
        `Feedback for ${LOT_A.name}`,
      );
      expect(el.querySelector('[data-feedback-counter]')?.textContent?.trim()).toBe('0/500');

      component.updateLotFeedback(LOT_A.lotId, 'x'.repeat(42));
      fixture.detectChanges();
      expect(el.querySelector('[data-feedback-counter]')?.textContent?.trim()).toBe('42/500');
    });

    it('is not paged and makes no per-manager lookups', async () => {
      const lots = Array.from({ length: 12 }, (_, i) => ({ ...LOT_A, lotId: `lot-${i}`, name: `Lot ${i}` }));
      const { fixture, el } = await openLots(lots);

      expect(cards(el).length).toBe(12);
      expect(el.querySelector('[role="tabpanel"] app-pagination-controls')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Loading manager');
      // httpMock.verify() in afterEach fails if any user lookup was requested.
    });

    it('shows exactly "No lots waiting for approval." when empty', async () => {
      const { el } = await openLots([]);
      expect(el.textContent).toContain('No lots waiting for approval.');
      expect(el.textContent).not.toContain('auto-approved');
    });

    it('approve sends {} even when feedback was typed, removes the card and says so', async () => {
      const { fixture, component, el } = await openLots([LOT_A, LOT_B]);
      component.updateLotFeedback('lot-1', 'Looks good');
      fixture.detectChanges();

      approveBtn(cards(el)[0]).click();
      fixture.detectChanges();
      expect(approveBtn(cards(el)[0]).textContent?.trim()).toBe('Approving...');
      expect(approveBtn(cards(el)[0]).disabled).toBe(true);
      expect(rejectBtn(cards(el)[0]).disabled).toBe(true);

      const req = httpMock.expectOne(approveLotUrl('lot-1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush(envelope({ ...LOT_A, approvalStatus: 'Approved' }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cards(el).length).toBe(1);
      expect(cards(el)[0].textContent).toContain('Kumar Auto Deck 2');
      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Shah Rooftop Deck approved.');
    });

    it('ignores repeated clicks while an action runs', async () => {
      const { fixture, component, el } = await openLots();

      approveBtn(cards(el)[0]).click();
      void component.approveLot('lot-1');
      void component.approveLot('lot-1');
      await component.confirmReject();

      const req = httpMock.expectOne(approveLotUrl('lot-1'));
      req.flush(envelope({}));
      await fixture.whenStable();
    });

    it('Reject opens the confirm dialog; Cancel sends nothing', async () => {
      const { fixture, el } = await openLots();

      rejectBtn(cards(el)[0]).click();
      fixture.detectChanges();

      const dialog = el.querySelector('app-confirm-dialog')!;
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Reject Shah Rooftop Deck?');
      expect(dialog.textContent).toContain('The manager will see your feedback.');

      Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Cancel')!
        .click();
      fixture.detectChanges();
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
      expect(cards(el).length).toBe(1);
    });

    it('reject sends the trimmed feedback, removes the card and says so', async () => {
      const { fixture, component, el } = await openLots();
      component.updateLotFeedback('lot-1', '  Please add signage.  ');
      fixture.detectChanges();

      rejectBtn(cards(el)[0]).click();
      fixture.detectChanges();
      confirmRejectDialog(fixture);
      expect(rejectBtn(cards(el)[0]).textContent?.trim()).toBe('Rejecting...');

      const req = httpMock.expectOne(rejectLotUrl('lot-1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ feedback: 'Please add signage.' });
      req.flush(envelope({ ...LOT_A, approvalStatus: 'Rejected' }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cards(el).length).toBe(0);
      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Shah Rooftop Deck rejected.');
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
    });

    it('reject sends {} when the feedback is empty or only spaces', async () => {
      const { fixture, component, el } = await openLots();
      component.updateLotFeedback('lot-1', '   ');
      rejectBtn(cards(el)[0]).click();
      fixture.detectChanges();
      confirmRejectDialog(fixture);

      const req = httpMock.expectOne(rejectLotUrl('lot-1'));
      expect(req.request.body).toEqual({});
      req.flush(envelope({}));
      await fixture.whenStable();
    });

    it('a 400 on reject shows the server message under the textarea and keeps the card', async () => {
      const { fixture, el } = await openLots();
      rejectBtn(cards(el)[0]).click();
      fixture.detectChanges();
      confirmRejectDialog(fixture);

      httpMock
        .expectOne(rejectLotUrl('lot-1'))
        .flush(failure('Feedback must not exceed 500 characters.'), { status: 400, statusText: 'Bad Request' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cards(el).length).toBe(1);
      expect(cards(el)[0].querySelector('[data-feedback-error]')?.textContent?.trim()).toBe(
        'Feedback must not exceed 500 characters.',
      );
      expect(approveBtn(cards(el)[0]).disabled).toBe(false);
    });

    it('a 404 removes the card and shows "This lot no longer exists."', async () => {
      const { fixture, el } = await openLots();
      approveBtn(cards(el)[0]).click();

      httpMock
        .expectOne(approveLotUrl('lot-1'))
        .flush(failure('Lot not found.'), { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cards(el).length).toBe(0);
      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe(LOT_GONE_NOTICE);
      expect(LOT_GONE_NOTICE).toBe('This lot no longer exists.');
    });

    it('a 409 on approve shows the already-handled notice and reloads the pending list', async () => {
      const { fixture, el } = await openLots([LOT_A, LOT_B]);
      approveBtn(cards(el)[0]).click();

      httpMock
        .expectOne(approveLotUrl('lot-1'))
        .flush(failure('Lot is not pending approval.'), { status: 409, statusText: 'Conflict' });
      await new Promise((resolve) => setTimeout(resolve));
      httpMock.expectOne(PENDING_LOTS_URL).flush(envelope([LOT_B]));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe(
        'This lot was already handled. The list has been refreshed.',
      );
      expect(ALREADY_HANDLED_NOTICE).toBe('This lot was already handled. The list has been refreshed.');
      expect(cards(el).length).toBe(1);
    });

    it('a 409 on reject does the same', async () => {
      const { fixture, el } = await openLots();
      rejectBtn(cards(el)[0]).click();
      fixture.detectChanges();
      confirmRejectDialog(fixture);

      httpMock
        .expectOne(rejectLotUrl('lot-1'))
        .flush(failure('Lot is not pending approval.'), { status: 409, statusText: 'Conflict' });
      await new Promise((resolve) => setTimeout(resolve));
      httpMock.expectOne(PENDING_LOTS_URL).flush(envelope([]));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe(ALREADY_HANDLED_NOTICE);
      expect(cards(el).length).toBe(0);
    });

    it('a 401 clears the session and goes to /login', async () => {
      const { fixture, el } = await openLots();
      approveBtn(cards(el)[0]).click();
      httpMock.expectOne(approveLotUrl('lot-1')).flush(null, { status: 401, statusText: 'Unauthorized' });
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('parkease.session')).toBeNull();
    });

    it('a 403 goes to /403', async () => {
      const { fixture, el } = await openLots();
      approveBtn(cards(el)[0]).click();
      httpMock.expectOne(approveLotUrl('lot-1')).flush(null, { status: 403, statusText: 'Forbidden' });
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/403');
    });

    it('a 429 ends the busy state, keeps the card and shows no banner', async () => {
      const { fixture, component, el } = await openLots();
      approveBtn(cards(el)[0]).click();
      httpMock
        .expectOne(approveLotUrl('lot-1'))
        .flush(failure('Too many requests. Please try again later.'), {
          status: 429,
          statusText: 'Too Many Requests',
        });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.lotsError()).toBeNull();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(cards(el).length).toBe(1);
      expect(approveBtn(cards(el)[0]).disabled).toBe(false);
    });

    it('a 5xx on an action shows the generic message and keeps the card', async () => {
      const { fixture, component, el } = await openLots();
      approveBtn(cards(el)[0]).click();
      httpMock
        .expectOne(approveLotUrl('lot-1'))
        .flush(failure('Internal details'), { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.lotsError()).toBe(GENERIC_ERROR_MESSAGE);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong. Please try again.');
      expect(cards(el).length).toBe(1);
    });

    it('a network failure on an action shows the generic message', async () => {
      const { fixture, component, el } = await openLots();
      approveBtn(cards(el)[0]).click();
      httpMock
        .expectOne(approveLotUrl('lot-1'))
        .error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
      await fixture.whenStable();

      expect(component.lotsError()).toBe(GENERIC_ERROR_MESSAGE);
    });

    it('a failed list load shows the banner with Retry, which reloads', async () => {
      const { fixture, component } = createFixture();
      fixture.detectChanges();
      flushInitialApplications();
      await Promise.resolve();

      const loading = component.loadPendingLots();
      httpMock.expectOne(PENDING_LOTS_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await loading;
      component.subTab.set('lot-approvals');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('[role="alert"]')?.textContent).toContain(GENERIC_ERROR_MESSAGE);
      expect(el.textContent).not.toContain('No lots waiting for approval.');
      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      httpMock.expectOne(PENDING_LOTS_URL).flush(envelope([LOT_A]));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cards(el).length).toBe(1);
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('a 429 on the list load keeps the current data and shows no banner', async () => {
      const { fixture, component, el } = await openLots();
      const loading = component.loadPendingLots();
      httpMock
        .expectOne(PENDING_LOTS_URL)
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await loading;
      fixture.detectChanges();

      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(cards(el).length).toBe(1);
    });

    it('the Reject button is red-700 and cards have no "not supported" text', async () => {
      const { el } = await openLots();
      const reject = rejectBtn(cards(el)[0]);
      expect(reject.className).toContain('text-red-700');
      expect(reject.className).toContain('border-red-700');
      expect(reject.disabled).toBe(false);
      expect(reject.getAttribute('title')).toBeNull();
    });
  });
});
