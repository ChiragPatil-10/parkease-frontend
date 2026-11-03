import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserRole } from '../../models/auth/user-role.enum';
import { storeSession } from '../../testing/session';
import { Forbidden } from './forbidden';

describe('Forbidden', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Forbidden],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(Forbidden);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the 403 label, heading and message', () => {
    const el = render();

    expect(el.querySelector('p.font-mono')?.textContent?.trim()).toBe('ERROR 403');
    const h1 = el.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('You don’t have access to this page');
    expect(h1?.classList.contains('font-display')).toBe(true);
    expect(el.textContent).toContain(
      'This area is restricted to a different role. If you think this is a mistake, contact your admin.',
    );
  });

  it('logged out: shows only the wordmark and sends Back to home to /login', () => {
    const el = render();

    expect(el.querySelector('header')?.textContent?.trim()).toBe('ParkEase');
    expect(el.querySelector('app-nav-shell')).toBeNull();
    expect(el.querySelector('a[href="/login"]')?.textContent?.trim()).toBe('Back to home');
  });

  const cases: [UserRole, string, string][] = [
    [UserRole.Driver, 'app-driver-nav', '/lots'],
    [UserRole.Manager, 'app-manager-nav', '/manager/lots'],
    [UserRole.Admin, 'app-admin-nav', '/admin/approvals'],
  ];

  for (const [role, navSelector, home] of cases) {
    it(`${role}: shows their nav with no active item and sends Back to home to ${home}`, () => {
      storeSession(role);
      const el = render();

      expect(el.querySelector(navSelector)).not.toBeNull();
      expect(el.querySelectorAll('app-nav-shell a.font-semibold').length).toBe(0);
      expect(el.querySelector(`main a[href="${home}"]`)?.textContent?.trim()).toBe('Back to home');
    });
  }
});
