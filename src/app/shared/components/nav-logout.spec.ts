import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Type } from '@angular/core';
import { vi } from 'vitest';
import { DriverNav } from './driver-nav/driver-nav';
import { ManagerNav } from './manager-nav/manager-nav';
import { AdminNav } from './admin-nav/admin-nav';
import { UserRole } from '../../models/auth/user-role.enum';
import { SESSION_STORAGE_KEY, storeSession } from '../../testing/session';

const cases: { name: string; component: Type<unknown>; tab: string; role: UserRole }[] = [
  { name: 'DriverNav', component: DriverNav, tab: 'search-lots', role: UserRole.Driver },
  { name: 'ManagerNav', component: ManagerNav, tab: 'my-lots', role: UserRole.Manager },
  { name: 'AdminNav', component: AdminNav, tab: 'manager-applications', role: UserRole.Admin },
];

for (const { name, component, tab, role } of cases) {
  describe(`${name} log out`, () => {
    let httpMock: HttpTestingController;
    let router: Router;

    beforeEach(async () => {
      localStorage.clear();
      await TestBed.configureTestingModule({
        imports: [component],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      }).compileComponents();
      httpMock = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    });

    it('renders a Log out button as the last control and clears the session on click', () => {
      storeSession(role);
      const fixture = TestBed.createComponent(component as Type<{ activeTab: unknown }>);
      fixture.componentRef.setInput('activeTab', tab);
      fixture.detectChanges();

      const controls = (fixture.nativeElement as HTMLElement).querySelectorAll('nav > *');
      const button = controls[controls.length - 1] as HTMLButtonElement;
      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
      expect(button.textContent?.trim()).toBe('Log out');

      button.click();

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      httpMock.expectOne((req) => req.url.endsWith('/auth/logout')).flush({});
    });
  });
}
