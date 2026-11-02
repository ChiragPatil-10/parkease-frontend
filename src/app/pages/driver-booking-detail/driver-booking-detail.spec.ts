import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DriverBookingDetail } from './driver-booking-detail';

describe('DriverBookingDetail', () => {
  let fixture: ComponentFixture<DriverBookingDetail>;
  let el: HTMLElement;

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const buttons = () => Array.from(el.querySelectorAll('main button')).map((b) => b.textContent?.trim());
  const mono = (value: string) =>
    Array.from(el.querySelectorAll('.font-mono')).some((n) => n.textContent?.trim() === value);

  async function setup(state?: string): Promise<void> {
    const query = new BehaviorSubject(convertToParamMap(state === undefined ? {} : { state }));
    await TestBed.configureTestingModule({
      imports: [DriverBookingDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ bookingId: 'bk-1' }) },
            queryParamMap: query,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DriverBookingDetail);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  describe('confirmed (default)', () => {
    beforeEach(() => setup());

    it('shows the booking card, both buttons and the Payment card', () => {
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Whitefield Central Lot');
      expect(text()).toContain('Today, 4:30 PM');
      expect(buttons()).toEqual(['Check in', 'Cancel booking']);
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Payment');
      expect(text()).toContain('Captured — paid');
      expect(text()).toContain('Paid at');
    });

    it('uses font-mono for spot, plate, amount and order id', () => {
      expect(mono('A-02 · Standard')).toBe(true);
      expect(mono('KA-05 MJ 4471')).toBe(true);
      expect(mono('₹120')).toBe(true);
      expect(mono('order_Nk3xR9Qp')).toBe(true);
    });

    it('has exactly one h1 and a decorative pill dot', () => {
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('h2 + span > span')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks My Bookings active without making it a link', () => {
      const item = Array.from(el.querySelectorAll('nav > *')).find((n) =>
        n.textContent?.includes('My Bookings'),
      ) as HTMLElement;
      expect(item.tagName).toBe('SPAN');
      expect(item.classList).toContain('text-ink');
      expect(item.classList).toContain('font-semibold');
    });
  });

  describe('?state=failed', () => {
    beforeEach(() => setup('failed'));

    it('shows only Book again, the red pill and the reason', () => {
      expect(buttons()).toEqual(['Book again']);
      expect(text()).not.toContain('Check in');
      expect(text()).not.toContain('Cancel booking');
      expect(text()).toContain('Failed');
      expect(text()).toContain('Mon, 26 Oct, 4:30 PM');
      const reason = Array.from(el.querySelectorAll('dd')).find((d) =>
        d.textContent?.includes("couldn't set up the payment"),
      );
      expect(reason?.classList).toContain('text-red-700');
    });

    it('uses font-mono for spot, plate and amount, with one h1', () => {
      expect(mono('A-11 · Standard')).toBe(true);
      expect(mono('KA-05 MJ 4471')).toBe(true);
      expect(mono('₹75')).toBe(true);
      expect(el.querySelectorAll('h1').length).toBe(1);
    });
  });

  describe('?state=notfound', () => {
    beforeEach(() => setup('notfound'));

    it('shows the not found view with no cards', () => {
      expect(el.querySelector('h1')?.textContent?.trim()).toBe(
        'Booking not found or not accessible',
      );
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(buttons()).toEqual(['Back to parking lots']);
      expect(el.querySelector('section')).toBeNull();
      expect(el.querySelector('h2')).toBeNull();
      expect(el.querySelector('main [aria-hidden="true"]')?.textContent?.trim()).toBe('!');
    });
  });

  it('falls back to confirmed for an unknown state', async () => {
    await setup('banana');
    expect(buttons()).toEqual(['Check in', 'Cancel booking']);
  });
});
