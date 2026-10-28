import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { guestGuard } from './guest.guard';
import { UserRole } from '../../models/auth/user-role.enum';
import { SESSION_STORAGE_KEY, makeToken, storeSession } from '../../testing/session';

describe('guestGuard', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('lets a logged-out visitor through', () => {
    expect(runGuard()).toBe(true);
  });

  it('sends a logged-in Driver to /lots', () => {
    storeSession(UserRole.Driver);
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/lots');
  });

  it('sends a logged-in Manager to /manager/lots', () => {
    storeSession(UserRole.Manager);
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/manager/lots');
  });

  it('sends a logged-in Admin to /admin/approvals', () => {
    storeSession(UserRole.Admin);
    expect(router.serializeUrl(runGuard() as UrlTree)).toBe('/admin/approvals');
  });

  it('lets a visitor with an expired token through and clears the session', () => {
    storeSession(UserRole.Driver, makeToken(-60));
    expect(runGuard()).toBe(true);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
