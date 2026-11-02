import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerLotBookings, LotBookingsState, lotBookingRowView } from './manager-lot-bookings';
import { formatAmount, formatBookingTime } from '../driver-booking-detail/booking-detail-format';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import { MockLotBooking } from './lot-bookings-mock';

async function setup() {
  await TestBed.configureTestingModule({
    imports: [ManagerLotBookings],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(ManagerLotBookings);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const setState = (state: LotBookingsState) => {
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();
  };
  const select = (lotId: string) => {
    const dropdown = el.querySelector('select') as HTMLSelectElement;
    dropdown.value = lotId;
    dropdown.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const chip = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('[role="group"] button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  const click = (label: string) => {
    chip(label).click();
    fixture.detectChanges();
  };
  const tableRows = () => el.querySelectorAll('tbody tr');
  const cards = () => el.querySelectorAll('ul[data-cards] > li');
  return { fixture, el, setState, select, chip, click, tableRows, cards };
}

describe('ManagerLotBookings', () => {
  it('shows the manager nav with Lot Bookings active and the lot name in the h1', async () => {
    const { el } = await setup();
    expect(el.querySelector('app-manager-nav')).toBeTruthy();
    expect(el.querySelector('nav a.font-semibold')?.textContent?.trim()).toBe('Lot Bookings');
    const h1 = el.querySelector('h1')!;
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toBe('Bookings — Whitefield Central Lot');
    expect(h1.className).toContain('font-display');
  });

  describe('lot dropdown', () => {
    it('lists all lots, with the pending suffix on the unapproved one', async () => {
      const { el } = await setup();
      expect(el.querySelector('label[for="lot-select"]')?.textContent?.trim()).toBe('Lot');
      const options = Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim());
      expect(options).toEqual([
        'Whitefield Central Lot',
        'Koramangala Plaza Lot',
        'Indiranagar Metro Lot (pending approval)',
      ]);
    });

    it('updates the h1 without the suffix and resets the filter to All', async () => {
      const { el, select, click, chip } = await setup();
      click('Confirmed');
      select('lot-indiranagar');
      expect(el.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Bookings — Indiranagar Metro Lot',
      );
      expect(chip('All').getAttribute('aria-pressed')).toBe('true');
      expect(el.textContent).toContain('No bookings yet.');
    });

    it('selecting the approved empty lot shows the empty state', async () => {
      const { el, select } = await setup();
      select('lot-koramangala');
      expect(el.textContent).toContain('No bookings yet.');
      expect(el.querySelector('table')).toBeNull();
    });
  });

  describe('filter chips', () => {
    it('is a labelled group of toggle buttons with All pressed by default', async () => {
      const { el, chip } = await setup();
      expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Filter by status');
      const labels = Array.from(el.querySelectorAll('[role="group"] button')).map((b) =>
        b.textContent?.trim(),
      );
      expect(labels).toEqual(['All', 'Confirmed', 'Checked in', 'Completed', 'Cancelled']);
      expect(chip('All').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Confirmed').getAttribute('aria-pressed')).toBe('false');
    });

    it('filters the rows and moves aria-pressed', async () => {
      const { click, chip, tableRows, cards } = await setup();
      expect(tableRows().length).toBe(5);
      click('Checked in');
      expect(chip('Checked in').getAttribute('aria-pressed')).toBe('true');
      expect(chip('All').getAttribute('aria-pressed')).toBe('false');
      expect(tableRows().length).toBe(2);
      expect(cards().length).toBe(2);
      click('Cancelled');
      expect(tableRows().length).toBe(2);
    });

    it('shows a chip-specific empty message', async () => {
      const { el, click, select } = await setup();
      select('lot-koramangala');
      click('Checked in');
      expect(el.textContent).toContain('No checked in bookings.');
      expect(el.querySelectorAll('[role="group"] button').length).toBe(5);
    });

    it('resets to the first page when the chip changes', async () => {
      const { el, fixture, click, tableRows } = await setup();
      (Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Show more',
      ) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(tableRows().length).toBe(8);
      click('Completed');
      click('All');
      expect(tableRows().length).toBe(5);
    });
  });

  describe('rows', () => {
    it('renders one table row and one card per booking, with column headers', async () => {
      const { el, tableRows, cards } = await setup();
      expect(tableRows().length).toBe(5);
      expect(cards().length).toBe(5);
      const headers = Array.from(el.querySelectorAll('th[scope="col"]')).map((h) =>
        h.textContent?.trim(),
      );
      expect(headers).toEqual(['Spot', 'Driver vehicle', 'Start time', 'Amount', 'Status']);
      expect(el.querySelector('table')?.closest('div')?.className).toContain('md:block');
      expect(el.querySelector('ul[data-cards]')?.className).toContain('md:hidden');
    });

    it('uses the existing plate, time and amount helpers', async () => {
      const { el } = await setup();
      const first = el.querySelector('tbody tr')!;
      const cells = first.querySelectorAll('td');
      expect(cells[0].textContent?.trim()).toBe('A-02');
      expect(cells[0].className).toContain('font-mono');
      expect(cells[1].textContent?.trim()).toBe(formatPlate('KA05MJ4471'));
      expect(cells[1].className).toContain('font-mono');
      expect(cells[2].textContent?.trim()).toMatch(/^(Today|Tomorrow), \d{1,2}:\d{2} (AM|PM)$/);
      expect(cells[3].textContent?.trim()).toBe(formatAmount(120));
      expect(cells[3].className).toContain('font-mono');
    });

    it('shows a muted "-" with an accessible name when spot and plate are missing', async () => {
      const { el, click } = await setup();
      click('Completed');
      const rows = el.querySelectorAll('tbody tr');
      const old = rows[rows.length - 1];
      const missing = old.querySelectorAll('[aria-label="Not recorded"]');
      expect(missing.length).toBe(2);
      expect(missing[0].textContent?.trim()).toBe('-');
      expect(missing[0].className).toContain('text-muted');
    });

    it('has no clickable rows or actions', async () => {
      const { el } = await setup();
      expect(el.querySelectorAll('tbody a, tbody button, ul[data-cards] a, ul[data-cards] button').length).toBe(0);
    });
  });

  describe('lotBookingRowView', () => {
    const base: MockLotBooking = {
      bookingId: 'x',
      spotNumber: 'A-01',
      plateNumber: 'KA05MJ4471',
      startTime: new Date().toISOString(),
      amount: 62.5,
      status: 'Confirmed',
    };
    const now = new Date();

    it('formats plate, time and amount through the shared helpers', () => {
      const view = lotBookingRowView(base, now);
      expect(view.plate).toBe('KA 05 MJ 4471');
      expect(view.startTime).toBe(formatBookingTime(base.startTime, now));
      expect(view.amount).toBe('₹62.50');
    });

    it.each([
      ['Confirmed', 'Confirmed', 'bg-link'],
      ['CheckedIn', 'Checked in', 'bg-green-700'],
      ['Completed', 'Completed', 'bg-muted'],
      ['Cancelled', 'Cancelled', 'bg-red-700'],
      ['NoShow', 'No-show', 'bg-muted'],
      ['Mystery', 'Mystery', 'bg-muted'],
    ])('maps %s to label "%s" and dot %s', (status, label, dot) => {
      const view = lotBookingRowView({ ...base, status }, now);
      expect(view.statusLabel).toBe(label);
      expect(view.dotClass).toBe(dot);
    });

    it('keeps null spot and plate as null', () => {
      const view = lotBookingRowView({ ...base, spotNumber: null, plateNumber: null }, now);
      expect(view.spot).toBeNull();
      expect(view.plate).toBeNull();
    });
  });

  describe('status pills', () => {
    it('shows a visible label and an aria-hidden dot, including No-show', async () => {
      const { el } = await setup();
      const pills = Array.from(el.querySelectorAll('tbody [data-pill]'));
      const labels = pills.map((p) => p.textContent?.trim());
      expect(labels).toEqual(['Confirmed', 'Checked in', 'Checked in', 'Completed', 'Cancelled']);
      for (const pill of pills) {
        expect(pill.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
        expect(pill.className).toContain('bg-surface');
        expect(pill.className).toContain('text-muted');
      }
    });

    it('shows No-show only under All (second page)', async () => {
      const { el, fixture } = await setup();
      (Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Show more',
      ) as HTMLButtonElement).click();
      fixture.detectChanges();
      const labels = Array.from(el.querySelectorAll('tbody [data-pill]')).map((p) => p.textContent?.trim());
      expect(labels).toContain('No-show');
      expect(labels.length).toBe(8);
    });
  });

  describe('show more', () => {
    const showMore = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('button')).find((b) => /Show more|Loading\.\.\./.test(b.textContent ?? ''));

    it('is shown on the default view and reveals the rest, then disappears', async () => {
      const { el, fixture, tableRows } = await setup();
      const button = showMore(el)!;
      expect(button.textContent?.trim()).toBe('Show more');
      button.click();
      fixture.detectChanges();
      expect(tableRows().length).toBe(8);
      expect(showMore(el)).toBeUndefined();
    });

    it('is disabled with "Loading..." while loading more', async () => {
      const { el, fixture } = await setup();
      fixture.componentInstance.loadingMore.set(true);
      fixture.detectChanges();
      const button = showMore(el) as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe('Loading...');
      expect(button.disabled).toBe(true);
    });
  });

  describe('states', () => {
    it('loaded: shows the table and cards', async () => {
      const { el } = await setup();
      expect(el.querySelector('table')).toBeTruthy();
      expect(el.querySelector('ul[data-cards]')).toBeTruthy();
    });

    it('loading: shows skeletons in table and card shape, no rows', async () => {
      const { el, setState } = await setup();
      setState('loading');
      expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(el.querySelector('[data-skeleton="table"]')).toBeTruthy();
      expect(el.querySelector('[data-skeleton="cards"]')).toBeTruthy();
      expect(el.querySelector('table')).toBeNull();
    });

    it('empty: shows the message inside the card area with chips visible', async () => {
      const { el, setState } = await setup();
      setState('empty');
      expect(el.textContent).toContain('No bookings yet.');
      expect(el.querySelector('[role="group"]')).toBeTruthy();
      expect(el.querySelector('table')).toBeNull();
    });

    it('error: shows the banner with an inert Retry button', async () => {
      const { el, setState } = await setup();
      setState('error');
      const alert = el.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('Could not load bookings.');
      expect(alert.className).toContain('text-red-700');
      expect(alert.querySelector('button')?.textContent?.trim()).toBe('Retry');
      expect(el.querySelector('[role="group"]')).toBeTruthy();
    });

    it('lotNotFound: shows the message, help text and a link to My Lots, with no controls', async () => {
      const { el, setState } = await setup();
      setState('lotNotFound');
      expect(el.textContent).toContain('Lot not found.');
      expect(el.textContent).toContain("It may have been removed, or it isn't one of your lots.");
      expect(el.querySelector('main a')?.getAttribute('href')).toBe('/manager/lots');
      expect(el.querySelector('select')).toBeNull();
      expect(el.querySelector('[role="group"]')).toBeNull();
    });

    it('noLots: shows the message and link, with no chips, table or dropdown', async () => {
      const { el, setState } = await setup();
      setState('noLots');
      expect(el.textContent).toContain("You don't have any parking lots yet.");
      expect(el.querySelector('main a')?.getAttribute('href')).toBe('/manager/lots');
      expect(el.querySelector('select')).toBeNull();
      expect(el.querySelector('[role="group"]')).toBeNull();
      expect(el.querySelector('table')).toBeNull();
    });
  });
});
