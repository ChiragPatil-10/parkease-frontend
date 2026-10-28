import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { UserRole } from '../../models/auth/user-role.enum';
import { SESSION_STORAGE_KEY, makeToken, storeSession } from '../../testing/session';

describe('authGuard', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('allows a session with an unexpired token', () => {
    storeSession(UserRole.Driver);
    expect(runGuard()).toBe(true);
  });

  it('redirects a logged-out visitor to the home route', () => {
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/');
  });

  it('clears the session and redirects to /login when the token has expired', () => {
    storeSession(UserRole.Driver, makeToken(-60));
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('treats a malformed token as logged out', () => {
    storeSession(UserRole.Driver, 'not-a-jwt');
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('treats a token without an exp claim as logged out', () => {
    storeSession(UserRole.Driver, `${btoa('{}')}.${btoa('{"sub":"1"}')}.sig`);
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/login');
  });
});
