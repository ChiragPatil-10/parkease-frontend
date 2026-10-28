import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ManagerLotBookings } from './manager-lot-bookings';

describe('ManagerLotBookings', () => {
  it('keeps the coming-soon content and shows the manager nav with Lot Bookings active', async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerLotBookings],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ManagerLotBookings);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lot Bookings — coming soon.');
    expect(el.querySelector('app-manager-nav')).toBeTruthy();
    const active = el.querySelector('nav a.font-semibold');
    expect(active?.textContent?.trim()).toBe('Lot Bookings');
  });
});
