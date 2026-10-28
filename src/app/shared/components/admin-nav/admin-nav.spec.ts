import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminNav, AdminNavTab } from './admin-nav';

describe('AdminNav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNav],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function create(activeTab: AdminNavTab) {
    const fixture = TestBed.createComponent(AdminNav);
    fixture.componentRef.setInput('activeTab', activeTab);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links Manager Applications and Lot Approvals to /admin/approvals and leaves the rest inert', () => {
    const el = create('manager-applications');
    const links = Array.from(el.querySelectorAll('a'));

    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Manager Applications',
      'Lot Approvals',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/approvals?tab=manager-applications',
      '/admin/approvals?tab=lot-approvals',
    ]);
  });

  it('highlights only the active tab', () => {
    const el = create('lot-approvals');
    const links = Array.from(el.querySelectorAll('a'));

    expect(links[1].classList.contains('font-semibold')).toBe(true);
    expect(links[0].classList.contains('font-semibold')).toBe(false);
  });
});
