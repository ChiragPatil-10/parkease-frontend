import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AdminApprovalQueue } from './admin-approval-queue';
import { AUTH_API } from '../../constants/auth.constants';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { ApplicationStatus } from '../../models/auth/application-status.enum';
import { UserRole } from '../../models/auth/user-role.enum';
import { environment } from '../../../environments/environment';

const APPLICATIONS_URL = `${environment.apiBaseUrl}${AUTH_API.managerApplications}`;
const PENDING_LOTS_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.pending}`;
const approveManagerUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.approveManager(id)}`;
const rejectManagerUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.rejectManager(id)}`;
const approveLotUrl = (id: string) => `${environment.apiBaseUrl}${PARKINGLOT_API.approve(id)}`;
const userByIdUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.userById(id)}`;

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
  city: 'Bangalore',
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
};

const USER_SUMMARY_MGR_1 = {
  userId: 'mgr-1',
  fullName: 'Priya Shah',
  email: 'priya.shah@business.com',
  role: UserRole.Manager,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('AdminApprovalQueue', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminApprovalQueue],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(AdminApprovalQueue);
    const component = fixture.componentInstance as unknown as {
      applications: AdminApprovalQueue['applications'];
      applicationsPage: AdminApprovalQueue['applicationsPage'];
      applicationsTotalPages: AdminApprovalQueue['applicationsTotalPages'];
      applicationsLoading: AdminApprovalQueue['applicationsLoading'];
      applicationsError: AdminApprovalQueue['applicationsError'];
      actingApplicationId: AdminApprovalQueue['actingApplicationId'];
      successMessage: AdminApprovalQueue['successMessage'];
      subTab: AdminApprovalQueue['subTab'];
      lots: AdminApprovalQueue['lots'];
      lotsLoaded: AdminApprovalQueue['lotsLoaded'];
      lotsError: AdminApprovalQueue['lotsError'];
      managerNames: AdminApprovalQueue['managerNames'];
      lotFeedbackDrafts: AdminApprovalQueue['lotFeedbackDrafts'];
      changeApplicationsPage: AdminApprovalQueue['changeApplicationsPage'];
      approveApplication: AdminApprovalQueue['approveApplication'];
      rejectApplication: AdminApprovalQueue['rejectApplication'];
      loadPendingLots: AdminApprovalQueue['loadPendingLots'];
      selectSubTab: AdminApprovalQueue['selectSubTab'];
      updateLotFeedback: AdminApprovalQueue['updateLotFeedback'];
      approveLot: AdminApprovalQueue['approveLot'];
    };
    return { fixture, component };
  }

  function flushInitialApplications(items: unknown[] = [APPLICATION_A]) {
    const req = httpMock.expectOne(
      (r) =>
        r.url === APPLICATIONS_URL &&
        r.params.get('page') === '1' &&
        r.params.get('pageSize') === '10' &&
        r.params.get('status') === 'Pending',
    );
    req.flush({
      success: true,
      message: null,
      data: { items, totalCount: items.length, page: 1, pageSize: 10, totalPages: 1 },
      errors: null,
    });
  }

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

    const req = httpMock.expectOne(
      (r) => r.url === APPLICATIONS_URL && r.params.get('page') === '2',
    );
    req.flush({
      success: true,
      message: null,
      data: { items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 2 },
      errors: null,
    });
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
    putReq.flush({
      success: true,
      message: 'Manager application approved. User is now active.',
      data: {},
      errors: null,
    });
    await approval;

    expect(component.successMessage()).toBe('Application approved.');

    flushInitialApplications([]);
    await Promise.resolve();
  });

  it('surfaces the 409 message when rejecting an already-processed application', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const rejection = component.rejectApplication('app-1');

    const putReq = httpMock.expectOne(rejectManagerUrl('app-1'));
    putReq.flush(
      { success: false, message: 'Application is not pending.', data: null, errors: null },
      { status: 409, statusText: 'Conflict' },
    );
    await rejection;

    expect(component.applicationsError()).toBe('Application is not pending.');
    expect(component.successMessage()).toBeNull();
  });

  it('clears the session and redirects to /login on a 401', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === APPLICATIONS_URL,
    );
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(component.applicationsError()).toBe('Your session has expired. Please log in again.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('parkease.session')).toBeNull();
  });

  it('loads pending lots and resolves manager names when opening the Lot approvals tab', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const loading = component.loadPendingLots();

    const lotsReq = httpMock.expectOne(PENDING_LOTS_URL);
    lotsReq.flush({ success: true, message: null, data: [LOT_A], errors: null });
    await Promise.resolve();

    const userReq = httpMock.expectOne(userByIdUrl('mgr-1'));
    userReq.flush({ success: true, message: null, data: USER_SUMMARY_MGR_1, errors: null });
    await loading;

    expect(component.lots()).toEqual([LOT_A]);
    expect(component.managerNames()['mgr-1']).toBe('Priya Shah');
    expect(component.lotsLoaded()).toBe(true);
  });

  it('shows an empty state when there are no pending lots', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const loading = component.loadPendingLots();
    const lotsReq = httpMock.expectOne(PENDING_LOTS_URL);
    lotsReq.flush({ success: true, message: null, data: [], errors: null });
    await loading;

    expect(component.lots()).toEqual([]);

    component.subTab.set('lot-approvals');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No lots waiting for approval');
  });

  it('sends the feedback draft when approving a lot, then refetches', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const loading = component.loadPendingLots();
    const lotsReq = httpMock.expectOne(PENDING_LOTS_URL);
    lotsReq.flush({ success: true, message: null, data: [LOT_A], errors: null });
    await Promise.resolve();
    const userReq = httpMock.expectOne(userByIdUrl('mgr-1'));
    userReq.flush({ success: true, message: null, data: USER_SUMMARY_MGR_1, errors: null });
    await loading;

    component.updateLotFeedback('lot-1', 'Looks good, approved.');
    const approval = component.approveLot('lot-1');

    const putReq = httpMock.expectOne(approveLotUrl('lot-1'));
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ feedback: 'Looks good, approved.' });
    putReq.flush({ success: true, message: 'Lot approved.', data: { ...LOT_A, isApproved: true }, errors: null });
    await Promise.resolve();

    const refetchReq = httpMock.expectOne(PENDING_LOTS_URL);
    refetchReq.flush({ success: true, message: null, data: [], errors: null });
    await approval;

    expect(component.successMessage()).toBe('Lot approved.');
  });

  it('renders the lot Reject button as disabled since no reject endpoint exists', async () => {
    const { fixture, component } = createFixture();
    fixture.detectChanges();
    flushInitialApplications();
    await Promise.resolve();

    const loading = component.loadPendingLots();
    const lotsReq = httpMock.expectOne(PENDING_LOTS_URL);
    lotsReq.flush({ success: true, message: null, data: [LOT_A], errors: null });
    await Promise.resolve();
    const userReq = httpMock.expectOne(userByIdUrl('mgr-1'));
    userReq.flush({ success: true, message: null, data: USER_SUMMARY_MGR_1, errors: null });
    await loading;

    component.subTab.set('lot-approvals');
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('article button');
    const rejectButton = buttons[1] as HTMLButtonElement;
    expect(rejectButton.textContent?.trim()).toBe('Reject');
    expect(rejectButton.disabled).toBe(true);
  });
});
