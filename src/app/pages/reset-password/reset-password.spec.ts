import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { INVALID_LINK_MESSAGE, ResetPassword } from './reset-password';
import { AUTH_API } from '../../constants/auth.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { environment } from '../../../environments/environment';
import { SESSION_STORAGE_KEY, storeSession } from '../../testing/session';

const RESET_URL = `${environment.apiBaseUrl}${AUTH_API.resetPassword}`;
const LOGOUT_URL = `${environment.apiBaseUrl}${AUTH_API.logout}`;
const GOOD = 'NewPass123';

describe('ResetPassword', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  function setup(token: string | null) {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) },
          },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  }

  afterEach(() => httpMock.verify());

  function create() {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      resetForm: ResetPassword['resetForm'];
    };
    const el = fixture.nativeElement as HTMLElement;
    const fill = (password: string, confirm = password) => {
      component.resetForm.newPassword().value.set(password);
      component.resetForm.confirmPassword().value.set(confirm);
      fixture.detectChanges();
    };
    return { fixture, component, el, fill };
  }

  function flushOk() {
    httpMock
      .expectOne(RESET_URL)
      .flush({ success: true, message: 'Password reset successfully.', data: {}, errors: null });
  }

  describe('without a token', () => {
    beforeEach(() => setup(null));

    it('shows the invalid link state with a link to request a new one', () => {
      const { el } = create();
      expect(el.querySelector('[data-invalid-link]')?.textContent?.trim()).toBe(INVALID_LINK_MESSAGE);
      expect(el.querySelector('[data-request-new]')?.getAttribute('href')).toBe('/forgot-password');
      expect(el.querySelector('form')).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('with a token', () => {
    beforeEach(() => setup('abc%2Fdef=='));

    it('removes the token from the address bar with replaceUrl', () => {
      create();
      expect(router.navigate).toHaveBeenCalledTimes(1);
      const [commands, extras] = (router.navigate as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(commands).toEqual([]);
      expect(extras).toMatchObject({
        replaceUrl: true,
        queryParams: { token: null },
        queryParamsHandling: 'merge',
      });
    });

    it('shows the form with labelled fields and the right autocomplete values', () => {
      const { el } = create();
      expect(el.querySelector('label[for="new-password"]')).not.toBeNull();
      expect(el.querySelector('label[for="confirm-password"]')).not.toBeNull();
      expect(el.querySelector('#new-password')?.getAttribute('autocomplete')).toBe('new-password');
      expect(el.querySelector('#confirm-password')?.getAttribute('autocomplete')).toBe('new-password');
      expect(el.textContent).toContain('uppercase letter, a lowercase letter and a digit');
    });

    it('disables submit while the form is invalid', () => {
      const { fixture, el, fill } = create();
      const button = el.querySelector<HTMLButtonElement>('[data-submit]')!;
      expect(button.disabled).toBe(true);
      fill(GOOD);
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
    });

    it('shows the backend rule messages', () => {
      const { fixture, component, el, fill } = create();
      const message = () => el.querySelector('[data-new-password-error]')?.textContent?.trim();

      fill('');
      component.resetForm.newPassword().markAsTouched();
      fixture.detectChanges();
      expect(message()).toBe('New password is required.');

      fill('Ab1');
      fixture.detectChanges();
      expect(message()).toBe('New password must be at least 8 characters.');

      fill('alllowercase1');
      fixture.detectChanges();
      expect(message()).toBe('Password must contain uppercase, lowercase, and a digit.');
    });

    it('shows a mismatch when the confirmation differs', () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD, 'Different123');
      component.resetForm.confirmPassword().markAsTouched();
      fixture.detectChanges();
      expect(el.querySelector('[data-confirm-error]')?.textContent?.trim()).toBe(
        'The passwords do not match.',
      );
      expect(el.querySelector<HTMLButtonElement>('[data-submit]')?.disabled).toBe(true);
    });

    it('toggles each field between hidden and shown with a labelled button', () => {
      const { fixture, el } = create();
      const input = el.querySelector<HTMLInputElement>('#new-password')!;
      const toggle = el.querySelector<HTMLButtonElement>('[data-toggle-new]')!;
      expect(input.type).toBe('password');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.textContent).toContain('Show');
      expect(toggle.textContent).toContain('new password');

      toggle.click();
      fixture.detectChanges();
      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');

      const confirm = el.querySelector<HTMLInputElement>('#confirm-password')!;
      el.querySelector<HTMLButtonElement>('[data-toggle-confirm]')!.click();
      fixture.detectChanges();
      expect(confirm.type).toBe('text');
      expect(input.type).toBe('text');
    });

    it('posts the token and password, then goes to /login with the reset notice key', async () => {
      const { component, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);

      const req = httpMock.expectOne(RESET_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'abc%2Fdef==', newPassword: GOOD });
      req.flush({ success: true, message: 'Password reset successfully.', data: {}, errors: null });
      await done;

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', {
        state: { loginNotice: 'password-reset' },
      });
    });

    it('clears a session on this browser before going to /login', async () => {
      const { component, fill } = create();
      storeSession(UserRole.Driver);
      fill(GOOD);
      const done = submit(component.resetForm);
      flushOk();
      await done;

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      const logout = httpMock.expectOne(LOGOUT_URL);
      expect(logout.request.body).toEqual({ refreshToken: 'refresh-1' });
      logout.flush({ success: true, message: null, data: {}, errors: null });
    });

    it('does not call logout when there is no session', async () => {
      const { component, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      flushOk();
      await done;
      httpMock.expectNone(LOGOUT_URL);
    });

    it('shows the invalid link state with a link to request a new one after a 400', async () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      httpMock.expectOne(RESET_URL).flush(
        { success: false, message: INVALID_LINK_MESSAGE, data: null, errors: null },
        { status: 400, statusText: 'Bad Request' },
      );
      await done;
      fixture.detectChanges();

      expect(el.querySelector('[data-invalid-link]')?.textContent?.trim()).toBe(INVALID_LINK_MESSAGE);
      expect(el.querySelector('[data-request-new]')?.getAttribute('href')).toBe('/forgot-password');
      expect(el.querySelector('form')).toBeNull();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('maps a 422 on the new password to the field', async () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      httpMock.expectOne(RESET_URL).flush(
        {
          success: false,
          message: 'Validation failed.',
          data: null,
          errors: { NewPassword: ['Password must contain uppercase, lowercase, and a digit.'] },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await done;
      fixture.detectChanges();

      expect(el.querySelector('[data-new-password-error]')?.textContent?.trim()).toBe(
        'Password must contain uppercase, lowercase, and a digit.',
      );
      expect(el.querySelector('[data-invalid-link]')).toBeNull();
    });

    it('treats a 422 on the token as an invalid link', async () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      httpMock.expectOne(RESET_URL).flush(
        { success: false, message: 'Validation failed.', data: null, errors: { Token: ['Token is required.'] } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await done;
      fixture.detectChanges();
      expect(el.querySelector('[data-invalid-link]')).not.toBeNull();
    });

    it('shows a calm notice on a 429 and keeps the form', async () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      httpMock.expectOne(RESET_URL).flush(null, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      });
      await done;
      fixture.detectChanges();

      expect(el.querySelector('[data-rate-limited]')?.textContent).toContain('30 seconds');
      expect(el.querySelector('form')).not.toBeNull();
      expect(component.resetForm.newPassword().value()).toBe(GOOD);
    });

    it('shows a retryable error for other failures', async () => {
      const { fixture, component, el, fill } = create();
      fill(GOOD);
      const done = submit(component.resetForm);
      httpMock.expectOne(RESET_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await done;
      fixture.detectChanges();

      expect(el.querySelector('[data-error]')?.textContent).toContain('Please try again');
      expect(el.querySelector('form')).not.toBeNull();
    });
  });
});
