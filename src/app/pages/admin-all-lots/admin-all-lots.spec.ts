import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminAllLots } from './admin-all-lots';
import { MOCK_ALL_LOTS } from './admin-all-lots.mock';

describe('AdminAllLots', () => {
  let fixture: ComponentFixture<AdminAllLots>;
  let component: AdminAllLots;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminAllLots],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminAllLots);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const tableRows = () => Array.from(el.querySelectorAll<HTMLElement>('tbody tr[data-row]'));
  const rowFor = (name: string) => tableRows().find((r) => r.textContent?.includes(name))!;

  it('has 47 mock lots, all API field names, lowercase cities', () => {
    expect(MOCK_ALL_LOTS.length).toBe(47);
    expect(component.totalPages()).toBe(5);
    const first = MOCK_ALL_LOTS[0];
    expect(Object.keys(first)).toEqual(
      expect.arrayContaining([
        'lotId',
        'name',
        'address',
        'city',
        'totalSpots',
        'minPricePerHour',
        'maxPricePerHour',
        'isOpen',
        'approvalStatus',
        'managerName',
        'createdAt',
      ]),
    );
    expect(MOCK_ALL_LOTS.every((l) => l.city === l.city.toLowerCase())).toBe(true);
    expect(MOCK_ALL_LOTS.some((l) => l.managerName === null)).toBe(true);
  });

  it('shows "All lots — 47 total" in the display font and All Lots active in the nav', () => {
    const h1 = el.querySelector('h1')!;
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toBe('All lots — 47 total');
    expect(h1.classList.contains('font-display')).toBe(true);
    expect(el.querySelector('app-admin-nav a.font-semibold')?.textContent?.trim()).toBe('All Lots');
  });

  it('renders the column headers', () => {
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Lot', 'City', 'Manager', 'Spots', 'Status']);
  });

  it('renders 10 rows with capitalised cities and plain spots', () => {
    expect(tableRows().length).toBe(10);
    const cells = rowFor('Whitefield Central Lot').querySelectorAll('td');
    expect(cells[1].textContent?.trim()).toBe('Bengaluru');
    expect(cells[2].textContent?.trim()).toBe('Priya Shah');
    expect(cells[3].textContent?.trim()).toBe('40');
    expect(cells[3].classList.contains('font-mono')).toBe(false);
    expect(cells[4].querySelector('[data-pill]')?.textContent?.trim()).toBe('Open · Approved');
  });

  it('shows "Unknown manager" and a multi-word city', () => {
    const row = rowFor('Old Airport Road Basement');
    expect(row.querySelectorAll('td')[2].textContent?.trim()).toBe('Unknown manager');
    expect(row.querySelector('[data-pill]')?.textContent?.trim()).toBe('Closed · Approved');
    expect(rowFor('Station Road Yard').querySelectorAll('td')[1].textContent?.trim()).toBe(
      'Navi Mumbai',
    );
  });

  it('shows pending and rejected pills with the right dots', () => {
    expect(rowFor('Shah Rooftop Deck').querySelector('[data-pill]')?.textContent?.trim()).toBe(
      'Pending approval',
    );
    expect(rowFor('Shah Rooftop Deck').querySelector('[data-pill] span')?.className).toContain('bg-muted');
    expect(rowFor('Station Road Yard').querySelector('[data-pill]')?.textContent?.trim()).toBe('Rejected');
    expect(rowFor('Station Road Yard').querySelector('[data-pill] span')?.className).toContain('bg-red-700');
    expect(rowFor('Whitefield Central Lot').querySelector('[data-pill] span')?.className).toContain(
      'bg-green-700',
    );
  });

  it('shows an unknown approval status as raw text with the muted dot', () => {
    component.lots.update((list) => [{ ...list[0], approvalStatus: 'Archived' }, ...list.slice(1)]);
    fixture.detectChanges();
    const pill = tableRows()[0].querySelector('[data-pill]')!;
    expect(pill.textContent?.trim()).toBe('Archived');
    expect(pill.querySelector('span')?.className).toContain('bg-muted');
  });

  it('has no row actions and rows are not clickable', () => {
    expect(el.querySelectorAll('tbody button, tbody a').length).toBe(0);
    expect(el.querySelectorAll('[data-card] button, [data-card] a').length).toBe(0);
  });

  it('renders a card for each row for small screens', () => {
    expect(el.querySelectorAll('ul[data-cards] > li').length).toBe(10);
  });

  describe('pagination', () => {
    const pager = () => el.querySelector('app-pagination-controls')!;
    const pagerButton = (label: string) =>
      Array.from(pager().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

    it('starts on page 1 of 5 with Previous disabled', () => {
      expect(pager().textContent).toContain('Page 1 of 5');
      expect(pagerButton('Previous').disabled).toBe(true);
    });

    it('reaches the last page with 7 rows and Next disabled', () => {
      for (let i = 0; i < 4; i++) {
        pagerButton('Next').click();
        fixture.detectChanges();
      }
      expect(pager().textContent).toContain('Page 5 of 5');
      expect(pagerButton('Next').disabled).toBe(true);
      expect(pagerButton('Previous').disabled).toBe(false);
      expect(tableRows().length).toBe(7);
    });
  });

  describe('states', () => {
    it('shows the empty message', () => {
      component.state.set('empty');
      fixture.detectChanges();
      expect(el.textContent).toContain('No parking lots yet.');
      expect(tableRows().length).toBe(0);
    });

    it('shows the empty message when there are no lots even if loaded', () => {
      component.lots.set([]);
      fixture.detectChanges();
      expect(el.textContent).toContain('No parking lots yet.');
    });

    it('shows a skeleton while loading', () => {
      component.state.set('loading');
      fixture.detectChanges();
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(tableRows().length).toBe(0);
    });

    it('shows an error banner with Retry', () => {
      component.state.set('error');
      fixture.detectChanges();
      const alert = el.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('Could not load lots.');
      alert.querySelector('button')!.click();
      fixture.detectChanges();
      expect(tableRows().length).toBe(10);
    });
  });
});
