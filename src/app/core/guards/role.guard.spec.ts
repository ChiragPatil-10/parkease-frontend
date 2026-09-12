import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { roleGuard } from './role.guard';
import { UserRole } from '../../models/auth/user-role.enum';

const SESSION_STORAGE_KEY = 'parkease.session';

function storeSession(role: UserRole): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: '2026-01-01T00:00:00Z',
      user: {
        userId: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        role,
        profilePicUrl: null,
      },
    }),
  );
}

describe('roleGuard', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    router = TestBed.inject(Router);
  });

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      roleGuard(UserRole.Admin)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('allows an Admin through', () => {
    storeSession(UserRole.Admin);
    expect(runGuard()).toBe(true);
  });

  it('redirects a non-Admin to /403', () => {
    storeSession(UserRole.Manager);
    const result = runGuard() as UrlTree;
    expect(router.serializeUrl(result)).toBe('/403');
  });

  it('redirects an unauthenticated visitor to the home route', () => {
    const result = runGuard() as UrlTree;
    expect(router.serializeUrl(result)).toBe('/');
  });
});
