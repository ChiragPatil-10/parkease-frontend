import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { PARKINGLOT_API } from '../../constants/parkinglot.constants';
import { LotResponse } from '../../models/lot.model';
import { AdminAllLots, GENERIC_ERROR_MESSAGE } from './admin-all-lots';

const ALL_URL = `${environment.apiBaseUrl}${PARKINGLOT_API.all}`;

const lot = (over: Partial<LotResponse>): LotResponse => ({
  lotId: 'l-x',
  name: 'Some Lot',
  address: '1 Main Road',
  city: 'bengaluru',
  latitude: 12.9,
  longitude: 77.6,
  totalSpots: 20,
  availableSpots: 10,
  minPricePerHour: 20,
  maxPricePerHour: 40,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  isApproved: true,
  isOpen: true,
  description: null,
  approvalFeedback: null,
  approvedAt: null,
  managerId: 'mgr-1',
  createdAt: '2026-10-30T09:30:00Z',
  updatedAt: '2026-10-30T09:30:00Z',
  approvalStatus: 'Approved',
  managerName: 'Priya Shah',
  ...over,
});

const OPEN = lot({ lotId: 'l-1', name: 'Whitefield Central Lot', totalSpots: 40 });
const CLOSED = lot({ lotId: 'l-2', name: 'Closed Deck', isOpen: false, managerName: null });
const PENDING = lot({ lotId: 'l-3', name: 'Shah Rooftop Deck', isApproved: false, isOpen: false, approvalStatus: 'Pending', city: 'navi mumbai' });
const REJECTED = lot({ lotId: 'l-4', name: 'Station Road Yard', isApproved: false, isOpen: false, approvalStatus: 'Rejected' });
const UNKNOWN = lot({ lotId: 'l-5', name: 'Odd Lot', approvalStatus: 'Archived' });
const ALL = [OPEN, CLOSED, PENDING, REJECTED, UNKNOWN];

const envelope = (data: unknown) => ({ success: true, message: null, data, errors: null });
const failure = (message: string | null) => ({ success: false, message, data: null, errors: null });
const paged = (items: LotResponse[], page = 1, totalPages = 1, totalCount = items.length) =>
  envelope({ items, totalCount, page, pageSize: 10, totalPages });

describe('AdminAllLots', () => {
  let fixture: ComponentFixture<AdminAllLots>;
  let component: AdminAllLots;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;

  async function setup(query: Record<string, string> = {}, firstResponse: object | false = paged(ALL, 1, 1, 47)) {
    TestBed.resetTestingModule();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminAllLots],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParamMap', {
      value: of(convertToParamMap(query)),
    });
    fixture = TestBed.createComponent(AdminAllLots);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    if (firstResponse !== false) {
      httpMock.expectOne((r) => r.url === ALL_URL).flush(firstResponse);
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  afterEach(() => httpMock.verify());

  const tableRows = () => Array.from(el.querySelectorAll<HTMLElement>('tbody tr[data-row]'));
  const rowFor = (name: string) => tableRows().find((r) => r.textContent?.includes(name))!;
  const pager = () => el.querySelector('app-pagination-controls')!;
  const pagerButton = (label: string) =>
    Array.from(pager().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('requests page 1 with pageSize 10 and shows a skeleton first', async () => {
    await setup({}, false);
    const req = httpMock.expectOne((r) => r.url === ALL_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    req.flush(paged(ALL, 1, 1, 47));
    await settle();
    expect(tableRows().length).toBe(ALL.length);
  });

  it('shows "All lots \u2014 <totalCount> total" in the display font with All Lots active', async () => {
    await setup();
    const h1 = el.querySelector('h1')!;
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toBe('All lots \u2014 47 total');
    expect(h1.classList.contains('font-display')).toBe(true);
    expect(el.querySelector('app-admin-nav a.font-semibold')?.textContent?.trim()).toBe('All Lots');
    expect(Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual([
      'Lot', 'City', 'Manager', 'Spots', 'Status',
    ]);
  });

  it('renders capitalised cities, manager fallback and plain spots', async () => {
    await setup();
    const cells = rowFor('Whitefield Central Lot').querySelectorAll('td');
    expect(cells[1].textContent?.trim()).toBe('Bengaluru');
    expect(cells[2].textContent?.trim()).toBe('Priya Shah');
    expect(cells[3].textContent?.trim()).toBe('40');
    expect(cells[3].classList.contains('font-mono')).toBe(false);
    expect(rowFor('Closed Deck').querySelectorAll('td')[2].textContent?.trim()).toBe('Unknown manager');
    expect(rowFor('Shah Rooftop Deck').querySelectorAll('td')[1].textContent?.trim()).toBe('Navi Mumbai');
  });

  it('maps every status to its pill and dot', async () => {
    await setup();
    const pill = (name: string) => rowFor(name).querySelector('[data-pill]')!;
    expect(pill('Whitefield Central Lot').textContent?.trim()).toBe('Open · Approved');
    expect(pill('Whitefield Central Lot').querySelector('span')?.className).toContain('bg-green-700');
    expect(pill('Closed Deck').textContent?.trim()).toBe('Closed · Approved');
    expect(pill('Closed Deck').querySelector('span')?.className).toContain('bg-muted');
    expect(pill('Shah Rooftop Deck').textContent?.trim()).toBe('Pending approval');
    expect(pill('Shah Rooftop Deck').querySelector('span')?.className).toContain('bg-muted');
    expect(pill('Station Road Yard').textContent?.trim()).toBe('Rejected');
    expect(pill('Station Road Yard').querySelector('span')?.className).toContain('bg-red-700');
    expect(pill('Odd Lot').textContent?.trim()).toBe('Archived');
    expect(pill('Odd Lot').querySelector('span')?.className).toContain('bg-muted');
  });

  it('has no row actions, rows are not clickable, and cards exist for small screens', async () => {
    await setup();
    expect(el.querySelectorAll('tbody button, tbody a, [data-card] button, [data-card] a').length).toBe(0);
    expect(el.querySelectorAll('ul[data-cards] > li').length).toBe(ALL.length);
  });

  it('shows the empty state for totalCount 0', async () => {
    await setup({}, paged([], 1, 0, 0));
    expect(el.textContent).toContain('No parking lots yet.');
    expect(tableRows().length).toBe(0);
  });

  describe('pagination and ?page=', () => {
    it('starts on page 1 with Previous disabled', async () => {
      await setup({}, paged(ALL, 1, 5, 47));
      expect(pager().textContent).toContain('Page 1 of 5');
      expect(pagerButton('Previous').disabled).toBe(true);
    });

    it('loads the next page, updates ?page= and disables Next on the last page', async () => {
      await setup({}, paged(ALL, 1, 2, 12));
      pagerButton('Next').click();
      httpMock
        .expectOne((r) => r.url === ALL_URL && r.params.get('page') === '2')
        .flush(paged([OPEN], 2, 2, 12));
      await settle();

      expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 2 } }));
      expect(pager().textContent).toContain('Page 2 of 2');
      expect(pagerButton('Next').disabled).toBe(true);
    });

    it('starts on the page given by ?page= and treats an invalid one as 1', async () => {
      await setup({ page: '3' }, false);
      const req = httpMock.expectOne((r) => r.url === ALL_URL);
      expect(req.request.params.get('page')).toBe('3');
      req.flush(paged([OPEN], 3, 3, 21));
      await settle();

      await setup({ page: '-4' }, false);
      const second = httpMock.expectOne((r) => r.url === ALL_URL);
      expect(second.request.params.get('page')).toBe('1');
      second.flush(paged(ALL));
      await settle();
    });

    it('loads the last page when the requested page is past totalPages', async () => {
      await setup({ page: '9' }, false);
      httpMock
        .expectOne((r) => r.url === ALL_URL && r.params.get('page') === '9')
        .flush(paged([], 9, 2, 12));
      await Promise.resolve();
      httpMock
        .expectOne((r) => r.url === ALL_URL && r.params.get('page') === '2')
        .flush(paged([OPEN], 2, 2, 12));
      await settle();
      expect(pager().textContent).toContain('Page 2 of 2');
    });
  });

  describe('errors', () => {
    it('5xx shows the banner with Retry, which reloads', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === ALL_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(GENERIC_ERROR_MESSAGE);

      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      httpMock.expectOne((r) => r.url === ALL_URL).flush(paged(ALL, 1, 1, 5));
      await settle();
      expect(tableRows().length).toBe(ALL.length);
    });

    it('network failure shows the connection message', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === ALL_URL).error(new TypeError('Failed to fetch') as unknown as ProgressEvent);
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain("Couldn't reach the server");
    });

    it('401 clears the session and goes to /login', async () => {
      await setup({}, false);
      localStorage.setItem('parkease.session', '{}');
      httpMock.expectOne((r) => r.url === ALL_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('parkease.session')).toBeNull();
    });

    it('403 goes to /403', async () => {
      await setup({}, false);
      httpMock.expectOne((r) => r.url === ALL_URL).flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/403');
    });

    it('429 shows no red banner, only a Retry button', async () => {
      await setup({}, false);
      httpMock
        .expectOne((r) => r.url === ALL_URL)
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).toContain('Retry');
    });

    it('429 on a later load keeps the current data', async () => {
      await setup();
      void component.load(1);
      httpMock
        .expectOne((r) => r.url === ALL_URL)
        .flush(failure('Too many requests. Please try again later.'), { status: 429, statusText: 'Too Many Requests' });
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
