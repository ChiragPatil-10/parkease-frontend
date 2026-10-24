import { TestBed } from '@angular/core/testing';
import { DriverBookingReview } from './driver-booking-review';

describe('DriverBookingReview', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DriverBookingReview] }).compileComponents();
    const fixture = TestBed.createComponent(DriverBookingReview);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('renders the page heading', () => {
    expect(el.querySelector('h1')?.textContent).toContain('Review your booking');
  });

  it('lists the booking details as a description list', () => {
    const terms = Array.from(el.querySelectorAll('dt')).map((t) => t.textContent?.trim());
    const values = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
    expect(terms).toEqual(['Lot', 'Spot', 'Vehicle', 'Start time', 'Duration']);
    expect(values).toEqual([
      'Whitefield Central Lot',
      'A-02 · Standard',
      'KA 05 MJ 4471',
      'Today, 4:30 PM',
      '3 hours',
    ]);
  });

  it('shows the spot in monospace', () => {
    expect(el.querySelectorAll('dd')[1].classList).toContain('font-mono');
  });

  it('shows the amount due and the Razorpay pay button', () => {
    expect(el.textContent).toContain('Amount due');
    const pay = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Razorpay'),
    );
    expect(pay?.textContent).toContain('Pay ₹120');
    expect(pay?.getAttribute('type')).toBe('button');
  });

  it('renders the back control as a button', () => {
    const back = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back to spot picker'),
    );
    expect(back).toBeTruthy();
  });

  it('shows the footnote', () => {
    expect(el.textContent).toContain('until payment is confirmed server-side.');
  });
});
