import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DriverNav, DriverNavTab } from './driver-nav';

describe('DriverNav items', () => {
  function render(tab: DriverNavTab): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DriverNav],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(DriverNav);
    fixture.componentRef.setInput('activeTab', tab);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const item = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('nav > *')).find(
      (n) => n.textContent?.trim() === label,
    ) as HTMLElement;

  it('makes My Bookings a link to /bookings', () => {
    const link = item(render('search-lots'), 'My Bookings');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/bookings');
  });

  it('styles My Bookings as active only on that tab', () => {
    expect(item(render('my-bookings'), 'My Bookings').classList).toContain('text-ink');
    TestBed.resetTestingModule();
    const other = item(render('my-vehicles'), 'My Bookings');
    expect(other.classList).toContain('text-muted');
    expect(other.classList).not.toContain('font-semibold');
  });

  it('makes Notifications a link to /notifications, active only on that tab', () => {
    const link = item(render('my-bookings'), 'Notifications');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/notifications');
    expect(link.classList).toContain('text-muted');
    TestBed.resetTestingModule();
    expect(item(render('notifications'), 'Notifications').classList).toContain('text-ink');
  });
});
