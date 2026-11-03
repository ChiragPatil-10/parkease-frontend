import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { UserRole } from '../../models/auth/user-role.enum';
import { storeSession } from '../../testing/session';
import { ErrorNotFound } from './error-not-found';

describe('ErrorNotFound', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ErrorNotFound],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(ErrorNotFound);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the 404 label, heading and message', () => {
    const el = render();

    expect(el.querySelector('p.font-mono')?.textContent?.trim()).toBe('ERROR 404');
    const h1 = el.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('This page doesn’t exist');
    expect(h1?.classList.contains('font-display')).toBe(true);
    expect(el.textContent).toContain(
      'The page you’re looking for may have moved or been removed.',
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

  describe('wildcard route', () => {
    it('is the last route', () => {
      const last = routes[routes.length - 1];
      expect(last.path).toBe('**');
      expect(last.component).toBe(ErrorNotFound);
    });

    it('resolves an unknown URL to the 404 page', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/definitely/not/a/page');

      expect(harness.routeNativeElement?.textContent).toContain('ERROR 404');
    });

    it('still resolves the 403 route to the forbidden page', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/403');

      expect(harness.routeNativeElement?.textContent).toContain('ERROR 403');
    });
  });
});
