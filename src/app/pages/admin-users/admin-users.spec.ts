import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AUTH_API } from '../../constants/auth.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { UserSummaryDto } from '../../models/auth/user-summary.model';
import { storeSession } from '../../testing/session';
import { AdminUsers, GENERIC_ERROR_MESSAGE, USER_GONE_MESSAGE, parsePageParam } from './admin-users';

const USERS_URL = `${environment.apiBaseUrl}${AUTH_API.users}`;
const suspendUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.suspendUser(id)}`;
const reactivateUrl = (id: string) => `${environment.apiBaseUrl}${AUTH_API.reactivateUser(id)}`;

const user = (over: Partial<UserSummaryDto>): UserSummaryDto => ({
  userId: 'u-x',
  fullName: 'Someone',
  email: 'someone@example.com',
  role: UserRole.Driver,
  isActive: true,
  createdAt: '2026-06-12T09:30:00Z',
  status: 'Active',
  ...over,
});

const JORDAN = user({ userId: 'u-1', fullName: 'Jordan Lee', email: 'jordan.lee@example.com' });
const PRIYA = user({ userId: 'u-2', fullName: 'Priya Shah', role: UserRole.Manager, createdAt: '2026-03-03T09:30:00Z' });
const ANKIT = user({ userId: 'u-3', fullName: 'Ankit Verma', isActive: false, status: 'Suspended', createdAt: '2026-01-28T09:30:00Z' });
const SELF = user({ userId: '1', fullName: 'Asha Admin', role: UserRole.Admin });
const OTHER_ADMIN = user({ userId: 'u-5', fullName: 'Second Admin', role: UserRole.Admin });
const PENDING = user({ userId: 'u-6', fullName: 'Tara Mehta', role: UserRole.Manager, isActive: false, status: 'PendingApproval' });
const REJECTED = user({ userId: 'u-7', fullName: 'Sameer Dutta', role: UserRole.Manager, isActive: false, status: 'Rejected' });
const UNKNOWN = user({ userId: 'u-8', fullName: 'Mystery Person', status: 'Banned' });
const LONG = user({
  userId: 'u-9',
  fullName: 'Long Email',
  email: 'chandrasekhara.venkataramanan.subramaniam@a-very-long-company-domain-name.example.com',
});
const ALL = [JORDAN, PRIYA, ANKIT, SELF, OTHER_ADMIN, PENDING, REJECTED, UNKNOWN, LONG];

const envelope = (data: unknown) => ({ success: true, message: null, data, errors: null });
const failure = (message: string | null) => ({ success: false, message, data: null, errors: null });
const paged = (items: UserSummaryDto[], page = 1, totalPages = 1, totalCount = items.length) =>
  envelope({ items, totalCount, page, pageSize: 10, totalPages });

describe('parsePageParam', () => {
  it('reads positive whole numbers and falls back to 1', () => {
    expect(parsePageParam('3')).toBe(3);
    for (const value of [null, '', '0', '-2', 'abc', '1.5']) {
      expect(parsePageParam(value)).toBe(1);
    }
  });
});

describe('AdminUsers', () => {
  let fixture: ComponentFixture<AdminUsers>;
  let component: AdminUsers;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;

  async function setup(query: Record<string, string> = {}, firstResponse: object | false = paged(ALL)) {
    TestBed.resetTestingModule();
    localStorage.clear();
    storeSession(UserRole.Admin);
    await TestBed.configureTestingModule({
      imports: [AdminUsers],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParamMap', {
      value: of(convertToParamMap(query)),
    });
    fixture = TestBed.createComponent(AdminUsers);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    if (firstResponse !== false) {
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .flush(firstResponse);
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  afterEach(() => httpMock.verify());

  const tableRows = () => Array.from(el.querySelectorAll<HTMLElement>('tbody tr[data-row]'));
  const rowFor = (name: string) => tableRows().find((r) => r.textContent?.includes(name))!;
  const buttonIn = (row: HTMLElement) => row.querySelector<HTMLButtonElement>('button[data-action]');
  const pager = () => el.querySelector('app-pagination-controls')!;
  const pagerButton = (label: string) =>
    Array.from(pager().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

  function confirmDialog() {
    const confirm = Array.from(el.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent?.trim() !== 'Cancel',
    )!;
    confirm.click();
    fixture.detectChanges();
  }

  async function act(name: string) {
    buttonIn(rowFor(name))!.click();
    fixture.detectChanges();
    confirmDialog();
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('loading', () => {
    it('requests page 1 with pageSize 10 and renders the rows in server order', async () => {
      await setup({}, false);
      const req = httpMock.expectOne((r) => r.url === USERS_URL);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('10');
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      req.flush(paged(ALL));
      await settle();

      expect(tableRows().map((r) => r.querySelectorAll('td')[0].textContent?.trim())).toEqual(
        ALL.map((u) => u.fullName),
      );
    });

    it('shows h1 "Users", the headers, Users active in the nav and a card per row', async () => {
      await setup();
      const h1 = el.querySelector('h1')!;
      expect(h1.textContent?.trim()).toBe('Users');
      expect(h1.classList.contains('font-display')).toBe(true);
      expect(Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual([
        'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions',
      ]);
      expect(el.querySelector('app-admin-nav a.font-semibold')?.textContent?.trim()).toBe('Users');
      expect(el.querySelectorAll('ul[data-cards] > li').length).toBe(ALL.length);
    });

    it('puts the pill under Status and the date under Joined', async () => {
      await setup();
      const cells = rowFor('Jordan Lee').querySelectorAll('td');
      expect(cells[3].querySelector('[data-pill]')?.textContent?.trim()).toBe('Active');
      expect(cells[4].textContent?.trim()).toBe('12 Jun 2026');
    });

    it('wraps long emails and gives them a title', async () => {
      await setup();
      const cell = rowFor('Long Email').querySelectorAll('td')[1];
      expect(cell.getAttribute('title')).toBe(LONG.email);
      expect(cell.classList.contains('break-all')).toBe(true);
    });

    it('shows the empty state for totalCount 0', async () => {
      await setup({}, paged([], 1, 0, 0));
      expect(el.textContent).toContain('No users found.');
      expect(tableRows().length).toBe(0);
    });
  });

  describe('status pills', () => {
    const pillOf = (name: string) => rowFor(name).querySelector('[data-pill]')!;

    it('maps every status', async () => {
      await setup();
      expect(pillOf('Jordan Lee').querySelector('span')?.className).toContain('bg-green-700');
      expect(pillOf('Ankit Verma').textContent?.trim()).toBe('Suspended');
      expect(pillOf('Ankit Verma').querySelector('span')?.className).toContain('bg-red-700');
      expect(pillOf('Tara Mehta').textContent?.trim()).toBe('Pending approval');
      expect(pillOf('Tara Mehta').querySelector('span')?.className).toContain('bg-muted');
      expect(pillOf('Sameer Dutta').textContent?.trim()).toBe('Rejected');
      expect(pillOf('Sameer Dutta').querySelector('span')?.className).toContain('bg-red-700');
    });

    it('shows an unknown status as raw text with the muted dot', async () => {
      await setup();
      expect(pillOf('Mystery Person').textContent?.trim()).toBe('Banned');
      expect(pillOf('Mystery Person').querySelector('span')?.className).toContain('bg-muted');
    });
  });

  describe('action visibility', () => {
    it('offers Suspend for active and Reactivate for suspended users', async () => {
      await setup();
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Suspend');
      expect(buttonIn(rowFor('Priya Shah'))?.textContent?.trim()).toBe('Suspend');
      expect(buttonIn(rowFor('Ankit Verma'))?.textContent?.trim()).toBe('Reactivate');
    });

    it('offers nothing for admins, the signed-in admin, pending, rejected and unknown rows', async () => {
      await setup();
      for (const name of ['Asha Admin', 'Second Admin', 'Tara Mehta', 'Sameer Dutta', 'Mystery Person']) {
        expect(buttonIn(rowFor(name))).toBeNull();
      }
    });

    it('has no delete action', async () => {
      await setup();
      expect(el.textContent).not.toMatch(/delete/i);
    });
  });

  describe('suspend and reactivate', () => {
    it('opens the suspend dialog without claiming the user is logged out', async () => {
      await setup();
      buttonIn(rowFor('Jordan Lee'))!.click();
      fixture.detectChanges();
      const dialog = el.querySelector('app-confirm-dialog')!;
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Suspend Jordan Lee?');
      expect(dialog.textContent).toContain("They won't be able to sign in again until you reactivate them.");
      expect(dialog.textContent).not.toMatch(/logged out|log out|immediately|instantly/i);
    });

    it('opens the reactivate dialog; Cancel sends nothing', async () => {
      await setup();
      buttonIn(rowFor('Ankit Verma'))!.click();
      fixture.detectChanges();
      const dialog = el.querySelector('app-confirm-dialog')!;
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Reactivate Ankit Verma?');
      expect(dialog.textContent).toContain('They will be able to sign in again.');
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel')!.click();
      fixture.detectChanges();
      expect(el.querySelector('app-confirm-dialog')).toBeNull();
    });

    it('suspend: PUT with no meaningful body, busy label, then the row flips and a success line shows', async () => {
      await setup();
      await act('Jordan Lee');
      expect(buttonIn(rowFor('Jordan Lee'))!.textContent?.trim()).toBe('Suspending...');
      expect(buttonIn(rowFor('Jordan Lee'))!.disabled).toBe(true);

      const req = httpMock.expectOne(suspendUrl('u-1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush(envelope({}));
      await settle();

      expect(rowFor('Jordan Lee').querySelector('[data-pill]')?.textContent?.trim()).toBe('Suspended');
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Reactivate');
      expect(component.users().find((u) => u.userId === 'u-1')).toMatchObject({ status: 'Suspended', isActive: false });
      expect(el.querySelector('[data-success]')?.textContent?.trim()).toBe('Jordan Lee suspended.');
      expect(el.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    });

    it('reactivate: PUT, then the row is Active again', async () => {
      await setup();
      await act('Ankit Verma');
      const req = httpMock.expectOne(reactivateUrl('u-3'));
      expect(req.request.method).toBe('PUT');
      req.flush(envelope({}));
      await settle();

      expect(rowFor('Ankit Verma').querySelector('[data-pill]')?.textContent?.trim()).toBe('Active');
      expect(component.users().find((u) => u.userId === 'u-3')).toMatchObject({ status: 'Active', isActive: true });
      expect(el.querySelector('[data-success]')?.textContent?.trim()).toBe('Ankit Verma reactivated.');
    });

    it('ignores repeated clicks while an action runs', async () => {
      await setup();
      await act('Jordan Lee');
      void component.runAction('suspend', JORDAN);
      void component.runAction('suspend', JORDAN);
      httpMock.expectOne(suspendUrl('u-1')).flush(envelope({}));
      await settle();
    });

    it('409 shows the server message, leaves the row, then reloads the current page', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock
        .expectOne(suspendUrl('u-1'))
        .flush(failure('Only active users can be suspended.'), { status: 409, statusText: 'Conflict' });
      await Promise.resolve();
      httpMock
        .expectOne((r) => r.url === USERS_URL && r.params.get('page') === '1')
        .flush(paged([{ ...JORDAN, status: 'Suspended', isActive: false }, ...ALL.slice(1)]));
      await settle();

      const banner = el.querySelector('[data-action-error]')!;
      expect(banner.getAttribute('role')).toBe('alert');
      expect(banner.textContent?.trim()).toBe('Only active users can be suspended.');
      expect(rowFor('Jordan Lee').querySelector('[data-pill]')?.textContent?.trim()).toBe('Suspended');
      expect(el.querySelector('[data-success]')).toBeNull();
    });

    it('404 shows "This user no longer exists." and reloads', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock
        .expectOne(suspendUrl('u-1'))
        .flush(failure("User 'u-1' not found."), { status: 404, statusText: 'Not Found' });
      await Promise.resolve();
      httpMock.expectOne((r) => r.url === USERS_URL).flush(paged(ALL.slice(1)));
      await settle();

      expect(el.querySelector('[data-action-error]')?.textContent?.trim()).toBe(USER_GONE_MESSAGE);
      expect(USER_GONE_MESSAGE).toBe('This user no longer exists.');
      expect(tableRows().some((r) => r.textContent?.includes('Jordan Lee'))).toBe(false);
    });

    it('401 clears the session and goes to /login', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock.expectOne(suspendUrl('u-1')).flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('parkease.session')).toBeNull();
    });

    it('403 goes to /403', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock.expectOne(suspendUrl('u-1')).flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/403');
    });

    it('429 ends the busy state and shows no banner', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock
        .expectOne(suspendUrl('u-1'))
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await settle();

      expect(el.querySelector('[data-action-error]')).toBeNull();
      expect(buttonIn(rowFor('Jordan Lee'))!.disabled).toBe(false);
      expect(buttonIn(rowFor('Jordan Lee'))!.textContent?.trim()).toBe('Suspend');
    });

    it('5xx and network failures show the generic message and leave the row', async () => {
      await setup();
      await act('Jordan Lee');
      httpMock
        .expectOne(suspendUrl('u-1'))
        .flush(failure('internal'), { status: 500, statusText: 'Server Error' });
      await settle();
      expect(el.querySelector('[data-action-error]')?.textContent?.trim()).toBe(GENERIC_ERROR_MESSAGE);
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Suspend');

      await act('Jordan Lee');
      httpMock.expectOne(suspendUrl('u-1')).error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
      await settle();
      expect(el.querySelector('[data-action-error]')?.textContent?.trim()).toBe(GENERIC_ERROR_MESSAGE);
    });
  });

  describe('pagination and ?page=', () => {
    it('shows the pager from totalPages with Previous disabled on page 1', async () => {
      await setup({}, paged(ALL, 1, 3, 25));
      expect(pager().textContent).toContain('Page 1 of 3');
      expect(pagerButton('Previous').disabled).toBe(true);
      expect(pagerButton('Next').disabled).toBe(false);
    });

    it('loads the next page, updates ?page= and disables Next on the last page', async () => {
      await setup({}, paged(ALL, 1, 2, 12));
      pagerButton('Next').click();
      const req = httpMock.expectOne((r) => r.url === USERS_URL && r.params.get('page') === '2');
      req.flush(paged([JORDAN], 2, 2, 12));
      await settle();

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { page: 2 } }),
      );
      expect(pager().textContent).toContain('Page 2 of 2');
      expect(pagerButton('Next').disabled).toBe(true);
      expect(pagerButton('Previous').disabled).toBe(false);
    });

    it('starts on the page given by ?page=', async () => {
      await setup({ page: '2' }, false);
      const req = httpMock.expectOne((r) => r.url === USERS_URL);
      expect(req.request.params.get('page')).toBe('2');
      req.flush(paged([JORDAN], 2, 3, 21));
      await settle();
      expect(pager().textContent).toContain('Page 2 of 3');
    });

    it('treats an invalid ?page= as 1', async () => {
      await setup({ page: 'abc' }, false);
      const req = httpMock.expectOne((r) => r.url === USERS_URL);
      expect(req.request.params.get('page')).toBe('1');
      req.flush(paged(ALL));
      await settle();
    });

    it('loads the last page when totalPages is smaller than the requested page', async () => {
      await setup({ page: '9' }, false);
      httpMock
        .expectOne((r) => r.url === USERS_URL && r.params.get('page') === '9')
        .flush(paged([], 9, 2, 12));
      await Promise.resolve();
      httpMock
        .expectOne((r) => r.url === USERS_URL && r.params.get('page') === '2')
        .flush(paged([JORDAN], 2, 2, 12));
      await settle();

      expect(pager().textContent).toContain('Page 2 of 2');
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { page: 2 } }),
      );
    });
  });

  describe('load errors', () => {
    it('5xx shows the banner with Retry, which reloads', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === USERS_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(GENERIC_ERROR_MESSAGE);

      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      httpMock.expectOne((r) => r.url === USERS_URL).flush(paged(ALL));
      await settle();
      expect(tableRows().length).toBe(ALL.length);
    });

    it('network failure shows the connection message', async () => {
      await setup({}, false);
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain("Couldn't reach the server");
    });

    it('401 clears the session and goes to /login', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === USERS_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('parkease.session')).toBeNull();
    });

    it('403 goes to /403', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === USERS_URL).flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/403');
    });

    it('429 shows no red banner, only a Retry button', async () => {
      await setup({}, false);
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).toContain('Retry');
    });

    it('429 on a later load keeps the current data', async () => {
      await setup();
      void component.load(1, true);
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await settle();
      expect(tableRows().length).toBe(ALL.length);
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
