import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DriverMyBookings } from './driver-my-bookings';

describe('DriverMyBookings', () => {
  let fixture: ComponentFixture<DriverMyBookings>;
  let el: HTMLElement;

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('main ul > li'));
  const buttons = (row: HTMLElement) =>
    Array.from(row.querySelectorAll('button')).map((b) => b.textContent?.trim());
  const text = (row: HTMLElement) => row.textContent?.replace(/\s+/g, ' ') ?? '';

  async function setup(state?: string): Promise<void> {
    const query = new BehaviorSubject(convertToParamMap(state === undefined ? {} : { state }));
    await TestBed.configureTestingModule({
      imports: [DriverMyBookings],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DriverMyBookings);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  describe('list (default)', () => {
    beforeEach(() => setup());

    it('shows five rows with the sample texts', () => {
      const all = rows();
      expect(all.length).toBe(5);
      expect(text(all[0])).toContain('A-02');
      expect(text(all[0])).toContain('Whitefield Central Lot');
      expect(text(all[0])).toContain('Today, 4:30 PM');
      expect(text(all[0])).toContain('KA-05 MJ 4471');
      expect(text(all[1])).toContain('Marathahalli Tower Park');
      expect(text(all[1])).toContain('Yesterday, 2:00 PM');
      expect(text(all[2])).toContain('Mon, 26 Oct, 10:15 AM');
      expect(text(all[2])).toContain('KA-01 AB 9922');
      expect(text(all[3])).toContain('Mon, 19 Oct, 4:30 PM');
      expect(text(all[4])).toContain('Mon, 12 Oct, 11:00 AM');
    });

    it('matches each pill and button set to its row', () => {
      const expected: [string, string[]][] = [
        ['Confirmed', ['Check in', 'Cancel']],
        ['Checked in', ['Check out']],
        ['Pending', ['Cancel']],
        ['Cancelled — payment timed out', ['Book again']],
        ['Completed', ['View receipt']],
      ];
      rows().forEach((row, i) => {
        expect(text(row)).toContain(expected[i][0]);
        expect(buttons(row)).toEqual(expected[i][1]);
      });
    });

    it('colours the pills by tone and hides the dots from assistive tech', () => {
      const pills = rows().map((r) => r.querySelector('span.inline-flex') as HTMLElement);
      expect(pills[0].classList).toContain('text-link');
      expect(pills[1].classList).toContain('text-green-700');
      expect(pills[2].classList).toContain('text-muted');
      expect(pills[3].classList).toContain('text-red-700');
      expect(pills[4].classList).toContain('text-muted');
      pills.forEach((p) =>
        expect(p.querySelector('span')?.getAttribute('aria-hidden')).toBe('true'),
      );
    });

    it('styles the primary, danger and neutral buttons', () => {
      const [checkIn, cancel] = Array.from(rows()[0].querySelectorAll('button'));
      expect(checkIn.classList).toContain('bg-accent');
      expect(cancel.classList).toContain('text-red-700');
      expect(cancel.classList).toContain('border-red-700');
      expect(rows()[3].querySelector('button')?.classList).toContain('border-border');
      rows().forEach((r) =>
        r.querySelectorAll('button').forEach((b) => expect(b.type).toBe('button')),
      );
    });

    it('uses font-mono for the spot badge and the plate', () => {
      rows().forEach((row) => {
        const mono = Array.from(row.querySelectorAll('.font-mono')).map((n) => n.textContent?.trim());
        expect(mono.length).toBe(2);
      });
      expect(rows()[0].querySelector('.font-mono')?.textContent?.trim()).toBe('A-02');
    });

    it('has one visually hidden h1 and no empty-state content', () => {
      const headings = el.querySelectorAll('h1');
      expect(headings.length).toBe(1);
      expect(headings[0].textContent?.trim()).toBe('My bookings');
      expect(headings[0].classList).toContain('sr-only');
      expect(el.textContent).not.toContain('No bookings yet');
    });


    it('marks My Bookings active in the nav', () => {
      const item = Array.from(el.querySelectorAll('nav > *')).find((n) =>
        n.textContent?.includes('My Bookings'),
      ) as HTMLElement;
      expect(item.classList).toContain('text-ink');
    });
  });

  describe('?state=empty', () => {
    beforeEach(() => setup('empty'));

    it('shows the empty view with one h1 and a link to /lots, and no list', () => {
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('No bookings yet');
      expect(el.querySelector('h1')?.classList).toContain('font-display');
      expect(el.textContent).toContain(
        "Once you book a spot, it'll show up here — with check-in, check-out, and cancel actions.",
      );
      const link = Array.from(el.querySelectorAll('main a')).find((a) =>
        a.textContent?.includes('Find a spot near you'),
      );
      expect(link?.getAttribute('href')).toBe('/lots');
      expect(el.querySelector('ul')).toBeNull();
      expect(el.querySelector('main [aria-hidden="true"]')?.textContent?.trim()).toBe('P');
    });
  });

  it('falls back to the list for an unknown state', async () => {
    await setup('banana');
    expect(rows().length).toBe(5);
  });
});
