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

  it('links all four items to real routes', () => {
    const el = create('manager-applications');
    const links = Array.from(el.querySelectorAll('a'));

    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Users',
      'Manager Applications',
      'Lot Approvals',
      'All Lots',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/users',
      '/admin/approvals?tab=manager-applications',
      '/admin/approvals?tab=lot-approvals',
      '/admin/lots',
    ]);
  });

  it('highlights only the active tab', () => {
    const el = create('lot-approvals');
    const links = Array.from(el.querySelectorAll('a'));

    expect(links[2].classList.contains('font-semibold')).toBe(true);
    expect(links[1].classList.contains('font-semibold')).toBe(false);
  });

  it('highlights nothing when no tab is active', () => {
    const el = create(null as unknown as AdminNavTab);
    expect(el.querySelectorAll('a.font-semibold').length).toBe(0);
  });
});
