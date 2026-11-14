import { routes } from './app.routes';
import { guestGuard } from './core/guards/guest.guard';
import { authGuard } from './core/guards/auth.guard';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { UserRole } from './models/auth/user-role.enum';
import { storeSession } from './testing/session';

describe('app routes', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  function guardsFor(path: string): CanActivateFn[] {
    return (routes.find((r) => r.path === path)?.canActivate ?? []) as CanActivateFn[];
  }

  function runAll(path: string): boolean | UrlTree {
    for (const guard of guardsFor(path)) {
      const result = TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as boolean | UrlTree;
      if (result !== true) {
        return result;
      }
    }
    return true;
  }

  for (const path of ['lots', 'lots/:lotId']) {
    describe(`/${path}`, () => {
      it('allows a Driver', () => {
        storeSession(UserRole.Driver);
        expect(runAll(path)).toBe(true);
      });

      for (const role of [UserRole.Manager, UserRole.Admin]) {
        it(`redirects a ${role} to /403`, () => {
          storeSession(role);
          expect(router.serializeUrl(runAll(path) as UrlTree)).toBe('/403');
        });
      }
    });
  }

  it('applies the guest guard to login and registration routes but not the submitted page', () => {
    for (const path of ['', 'login', 'register', 'register-manager']) {
      expect(guardsFor(path)).toContain(guestGuard);
    }
    expect(guardsFor('register-manager/submitted')).toEqual([]);
  });

  describe('password and profile routes', () => {
    const find = (path: string) => routes.find((r) => r.path === path);

    it('leaves forgot-password and reset-password public and lazy', () => {
      for (const path of ['forgot-password', 'reset-password']) {
        expect(guardsFor(path)).toEqual([]);
        expect(find(path)?.loadComponent).toBeDefined();
        expect(find(path)?.component).toBeUndefined();
      }
    });

    it('lazy loads profile behind the auth guard only', () => {
      expect(find('profile')?.loadComponent).toBeDefined();
      expect(guardsFor('profile')).toEqual([authGuard]);
    });

    it('lets every role in and sends a logged out visitor to /login', () => {
      for (const role of [UserRole.Driver, UserRole.Manager, UserRole.Admin]) {
        localStorage.clear();
        storeSession(role);
        expect(runAll('profile')).toBe(true);
      }
      localStorage.clear();
      expect(router.serializeUrl(runAll('profile') as UrlTree)).toBe('/login');
    });
  });
});
