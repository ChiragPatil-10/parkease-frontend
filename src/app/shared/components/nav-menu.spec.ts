import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Component, Type } from '@angular/core';
import { vi } from 'vitest';
import { DriverNav } from './driver-nav/driver-nav';
import { ManagerNav } from './manager-nav/manager-nav';
import { AdminNav } from './admin-nav/admin-nav';
import { UserRole } from '../../models/auth/user-role.enum';
import { SESSION_STORAGE_KEY, storeSession } from '../../testing/session';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

const cases: { name: string; component: Type<unknown>; tab: string; role: UserRole }[] = [
  { name: 'DriverNav', component: DriverNav, tab: 'search-lots', role: UserRole.Driver },
  { name: 'ManagerNav', component: ManagerNav, tab: 'my-lots', role: UserRole.Manager },
  { name: 'AdminNav', component: AdminNav, tab: 'manager-applications', role: UserRole.Admin },
];

for (const { name, component, tab, role } of cases) {
  describe(`${name} collapsible menu`, () => {
    let router: Router;

    beforeEach(async () => {
      localStorage.clear();
      await TestBed.configureTestingModule({
        imports: [component],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            { path: 'lots', component: Blank },
            { path: 'manager/lots', component: Blank },
            { path: 'admin/approvals', component: Blank },
          ]),
        ],
      }).compileComponents();
      router = TestBed.inject(Router);
      storeSession(role);
    });

    function create() {
      const fixture = TestBed.createComponent(component as Type<{ activeTab: unknown }>);
      fixture.componentRef.setInput('activeTab', tab);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      return {
        fixture,
        el,
        button: el.querySelector('button[aria-label="Menu"]') as HTMLButtonElement,
        nav: el.querySelector('nav') as HTMLElement,
      };
    }

    it('renders a labelled menu button wired to the nav list, closed by default', () => {
      const { button, nav } = create();

      expect(button.type).toBe('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-controls')).toBe(nav.id);
      expect(nav.classList.contains('hidden')).toBe(true);
    });

    it('toggles aria-expanded and visibility when the button is clicked', () => {
      const { fixture, button, nav } = create();

      button.click();
      fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(nav.classList.contains('hidden')).toBe(false);

      button.click();
      fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(nav.classList.contains('hidden')).toBe(true);
    });

    it('closes on Escape and returns focus to the button', () => {
      const { fixture, button, nav } = create();
      button.click();
      fixture.detectChanges();

      nav.querySelector<HTMLElement>('a, span, button')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();

      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(button);
    });

    it('closes when an item is chosen', () => {
      const { fixture, button, nav } = create();
      button.click();
      fixture.detectChanges();

      nav.querySelector<HTMLElement>('a, button')!.click();
      fixture.detectChanges();

      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes when the route changes', async () => {
      const { fixture, button } = create();
      button.click();
      fixture.detectChanges();

      await router.navigateByUrl('/lots');
      fixture.detectChanges();

      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('still logs out from the open menu', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const { fixture, button, nav } = create();
      button.click();
      fixture.detectChanges();

      const items = nav.querySelectorAll('nav > *');
      (items[items.length - 1] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      httpMock.expectOne((req) => req.url.endsWith('/auth/logout')).flush({});
    });
  });
}
