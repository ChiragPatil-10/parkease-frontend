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
      '/manager/applications',
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
});
