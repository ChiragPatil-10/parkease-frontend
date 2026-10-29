import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DriverPaymentPending } from './driver-payment-pending';

describe('DriverPaymentPending', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverPaymentPending],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(DriverPaymentPending);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('renders the h1 with the expected text', () => {
    const h1 = el.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Payment successful — confirming your booking');
    expect(h1?.classList).toContain('font-display');
  });

  it('shows the sample booking value in the mono font', () => {
    const value = el.querySelector('.font-mono');
    expect(value?.textContent?.trim()).toBe('Whitefield Central · A-02');
  });

  it('shows the Pending pill', () => {
    expect(el.textContent).toContain('Pending');
  });

  it('has a polite status element that is hidden visually', () => {
    const status = el.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.classList).toContain('sr-only');
    expect(status?.textContent).toContain('Payment received. Confirming your booking.');
  });

  it('marks the spinner icon aria-hidden', () => {
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no navigation bar', () => {
    expect(el.querySelector('header, nav')).toBeNull();
  });
});
