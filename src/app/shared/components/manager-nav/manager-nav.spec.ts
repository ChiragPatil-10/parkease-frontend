import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerNav, ManagerNavTab } from './manager-nav';

describe('ManagerNav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerNav],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function create(activeTab: ManagerNavTab) {
    const fixture = TestBed.createComponent(ManagerNav);
    fixture.componentRef.setInput('activeTab', activeTab);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a link to each manager section', () => {
    const fixture = create('my-lots');
    const hrefs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a'),
    ).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/manager/lots',
      '/manager/spots',
      '/manager/lot-bookings',
      '/profile',
    ]);
  });

  it('highlights the active tab and not the others', () => {
    const fixture = create('spots');
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    const active = links.find((a) => a.textContent?.trim() === 'Spots');
    const inactive = links.find((a) => a.textContent?.trim() === 'My Lots');

    expect(active?.classList.contains('font-semibold')).toBe(true);
    expect(active?.classList.contains('text-ink')).toBe(true);
    expect(inactive?.classList.contains('font-semibold')).toBe(false);
    expect(inactive?.classList.contains('text-muted')).toBe(true);
  });

  it('puts Profile just before Log out and highlights it only on the profile tab', () => {
    const el = create('profile').nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll('nav > *'));
    expect(items[items.length - 2].textContent?.trim()).toBe('Profile');
    expect(items[items.length - 1].textContent?.trim()).toBe('Log out');
    expect(items[items.length - 2].classList.contains('font-semibold')).toBe(true);
    expect(items[0].classList.contains('font-semibold')).toBe(false);
  });
});
