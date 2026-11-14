import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { PROFILE_LOAD_FAILED_MESSAGE, Profile } from './profile';
import { AUTH_API } from '../../constants/auth.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../../environments/environment';
import { SESSION_STORAGE_KEY, storeSession } from '../../testing/session';

const PROFILE_URL = `${environment.apiBaseUrl}${AUTH_API.profile}`;
const PASSWORD_URL = `${environment.apiBaseUrl}${AUTH_API.password}`;
const LOGOUT_URL = `${environment.apiBaseUrl}${AUTH_API.logout}`;

const USER = {
  userId: '1',
  fullName: 'Test User',
  email: 'test@example.com',
  role: UserRole.Driver,
  profilePicUrl: null,
  phone: '+91 98765 43210',
};

const envelope = <T>(data: T, message: string | null = null) => ({
  success: true,
  message,
  data,
  errors: null,
});

describe('Profile', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;

  beforeEach(async () => {
    localStorage.clear();
    storeSession(UserRole.Driver);
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    toast = TestBed.inject(ToastService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => httpMock.verify());

  type Component = {
    profileForm: Profile['profileForm'];
    passwordForm: Profile['passwordForm'];
  };

  async function create(user: object | null = USER) {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    if (user) {
      httpMock.expectOne(PROFILE_URL).flush(envelope(user));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance as unknown as Component,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  const text = (el: HTMLElement, selector: string) =>
    el.querySelector(selector)?.textContent?.trim() ?? null;

  describe('loading', () => {
    it('shows a loading state, then the read only email and role and the prefilled fields', async () => {
      const fixture = TestBed.createComponent(Profile);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Loading your profile');
      httpMock.expectOne(PROFILE_URL).flush(envelope(USER));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(text(el, '[data-email]')).toBe('test@example.com');
      expect(text(el, '[data-role]')).toBe('Driver');
      expect(el.querySelector<HTMLInputElement>('#full-name')?.value).toBe('Test User');
      expect(el.querySelector<HTMLInputElement>('#phone')?.value).toBe('+91 98765 43210');
    });

    it('shows an error with Retry, and Retry loads again', async () => {
      const fixture = TestBed.createComponent(Profile);
      fixture.detectChanges();
      httpMock.expectOne(PROFILE_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el, '[data-load-error]')).toContain(PROFILE_LOAD_FAILED_MESSAGE);

      el.querySelector<HTMLButtonElement>('[data-retry]')!.click();
      httpMock.expectOne(PROFILE_URL).flush(envelope(USER));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[data-load-error]')).toBeNull();
      expect(text(el, '[data-email]')).toBe('test@example.com');
    });

    it('shows a neutral Retry block on a 429', async () => {
      const fixture = TestBed.createComponent(Profile);
      fixture.detectChanges();
      httpMock.expectOne(PROFILE_URL).flush(null, { status: 429, statusText: 'Too Many Requests' });
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el, '[data-rate-limited]')).toContain("Couldn't load this right now.");
      expect(el.querySelector('[data-load-error]')).toBeNull();
      expect(el.querySelector('[data-retry]')).not.toBeNull();
    });

    it('clears the session and goes to /login on a 401', async () => {
      const fixture = TestBed.createComponent(Profile);
      fixture.detectChanges();
      httpMock.expectOne(PROFILE_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
      await fixture.whenStable();
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    for (const [role, selector] of [
      [UserRole.Driver, 'app-driver-nav'],
      [UserRole.Manager, 'app-manager-nav'],
      [UserRole.Admin, 'app-admin-nav'],
    ] as const) {
      it(`renders the ${role} nav with Profile active`, async () => {
        localStorage.clear();
        storeSession(role);
        const fixture = TestBed.createComponent(Profile);
        fixture.detectChanges();
        TestBed.inject(HttpTestingController).expectOne(PROFILE_URL).flush(envelope({ ...USER, role }));
        await fixture.whenStable();
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector(selector)).not.toBeNull();
        expect(el.querySelector('[data-profile]')?.classList).toContain('font-semibold');
      });
    }
  });

  describe('saving the profile', () => {
    it('disables Save while the form is unchanged and enables it after an edit', async () => {
      const { fixture, component, el } = await create();
      const save = el.querySelector<HTMLButtonElement>('[data-save]')!;
      expect(save.disabled).toBe(true);

      component.profileForm.fullName().value.set('New Name');
      fixture.detectChanges();
      expect(save.disabled).toBe(false);

      component.profileForm.fullName().value.set('Test User');
      fixture.detectChanges();
      expect(save.disabled).toBe(true);
    });

    it('sends the typed name and phone, omits profilePicUrl, then updates the session and shows a toast', async () => {
      const { fixture, component, el } = await create();
      component.profileForm.fullName().value.set('  New Name ');
      component.profileForm.phone().value.set('+91 11111 22222');
      fixture.detectChanges();

      const done = submit(component.profileForm);
      fixture.detectChanges();
      expect(el.querySelector<HTMLButtonElement>('[data-save]')?.disabled).toBe(true);

      const req = httpMock.expectOne(PROFILE_URL);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ fullName: 'New Name', phone: '+91 11111 22222' });
      expect('profilePicUrl' in req.request.body).toBe(false);
      req.flush(
        envelope({ ...USER, fullName: 'New Name', phone: '+91 11111 22222' }, 'Profile updated successfully.'),
      );
      await done;
      fixture.detectChanges();

      expect(toast.visible()).toBe(true);
      expect(toast.message()).toBe('Profile updated.');
      const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!);
      expect(stored.user.fullName).toBe('New Name');
      expect(stored.user.phone).toBe('+91 11111 22222');
      expect(stored.accessToken).toBeTruthy();
      expect(el.querySelector<HTMLButtonElement>('[data-save]')?.disabled).toBe(true);
    });

    it('sends an empty string, never null, to clear a phone', async () => {
      const { fixture, component } = await create();
      component.profileForm.phone().value.set('');
      fixture.detectChanges();

      const done = submit(component.profileForm);
      const req = httpMock.expectOne(PROFILE_URL);
      expect(req.request.body).toEqual({ fullName: 'Test User', phone: '' });
      expect(req.request.body.phone).not.toBeNull();
      req.flush(envelope({ ...USER, phone: null }));
      await done;
    });

    it('sends an empty phone string when the user never had one', async () => {
      const { fixture, component } = await create({ ...USER, phone: null });
      component.profileForm.fullName().value.set('Other');
      fixture.detectChanges();
      const done = submit(component.profileForm);
      const req = httpMock.expectOne(PROFILE_URL);
      expect(req.request.body).toEqual({ fullName: 'Other', phone: '' });
      req.flush(envelope({ ...USER, fullName: 'Other', phone: null }));
      await done;
    });

    it('shows the backend validation messages and sends nothing when invalid', async () => {
      const { fixture, component, el } = await create();
      component.profileForm.fullName().value.set('   ');
      component.profileForm.phone().value.set('abc');
      fixture.detectChanges();
      component.profileForm.fullName().markAsTouched();
      component.profileForm.phone().markAsTouched();
      fixture.detectChanges();
      expect(text(el, '[data-full-name-error]')).toBe('Full name is required.');
      expect(text(el, '[data-phone-error]')).toBe('Phone can contain digits, spaces, + or - only.');

      component.profileForm.fullName().value.set('x'.repeat(101));
      component.profileForm.phone().value.set('1'.repeat(21));
      fixture.detectChanges();
      expect(text(el, '[data-full-name-error]')).toBe('Full name must not exceed 100 characters.');
      expect(text(el, '[data-phone-error]')).toBe('Phone must not exceed 20 characters.');
      expect(el.querySelector<HTMLButtonElement>('[data-save]')?.disabled).toBe(true);
      httpMock.expectNone(PROFILE_URL);
    });

    it('maps a 422 to the fields', async () => {
      const { fixture, component, el } = await create();
      component.profileForm.phone().value.set('12345');
      fixture.detectChanges();
      const done = submit(component.profileForm);
      httpMock.expectOne(PROFILE_URL).flush(
        {
          success: false,
          message: 'Validation failed.',
          data: null,
          errors: { Phone: ['Phone can contain digits, spaces, + or - only.'] },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await done;
      fixture.detectChanges();
      expect(text(el, '[data-phone-error]')).toBe('Phone can contain digits, spaces, + or - only.');
    });

    it('shows an error toast and keeps the form on a server error', async () => {
      const { fixture, component, el } = await create();
      component.profileForm.fullName().value.set('New Name');
      fixture.detectChanges();
      const done = submit(component.profileForm);
      httpMock.expectOne(PROFILE_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await done;
      fixture.detectChanges();

      expect(toast.message()).toBe("Couldn't save your profile. Please try again.");
      expect(text(el, '[data-profile-error]')).toContain('Please try again');
      expect(component.profileForm.fullName().value()).toBe('New Name');
      expect(el.querySelector<HTMLButtonElement>('[data-save]')?.disabled).toBe(false);
    });

    it('shows a calm notice on a 429', async () => {
      const { fixture, component, el } = await create();
      component.profileForm.fullName().value.set('New Name');
      fixture.detectChanges();
      const done = submit(component.profileForm);
      httpMock.expectOne(PROFILE_URL).flush(null, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '12' },
      });
      await done;
      fixture.detectChanges();
      expect(text(el, '[data-profile-rate-limited]')).toContain('12 seconds');
      expect(el.querySelector('[data-profile-error]')).toBeNull();
    });
  });

  describe('changing the password', () => {
    function fill(
      component: Component,
      fixture: { detectChanges(): void },
      oldPassword = 'OldPass123',
      newPassword = 'NewPass123',
      confirm = newPassword,
    ) {
      component.passwordForm.oldPassword().value.set(oldPassword);
      component.passwordForm.newPassword().value.set(newPassword);
      component.passwordForm.confirmPassword().value.set(confirm);
      fixture.detectChanges();
    }

    it('uses the right autocomplete values and labelled toggles', async () => {
      const { el } = await create();
      expect(el.querySelector('#old-password')?.getAttribute('autocomplete')).toBe('current-password');
      expect(el.querySelector('#new-password')?.getAttribute('autocomplete')).toBe('new-password');
      expect(el.querySelector('#confirm-password')?.getAttribute('autocomplete')).toBe('new-password');
      expect(el.querySelector('#full-name')?.getAttribute('autocomplete')).toBe('name');
      expect(el.querySelector('#phone')?.getAttribute('autocomplete')).toBe('tel');
      for (const label of ['old-password', 'new-password', 'confirm-password']) {
        expect(el.querySelector(`label[for="${label}"]`)).not.toBeNull();
      }
      expect(el.textContent).toContain('uppercase letter, a lowercase letter and a digit');
    });

    it('toggles each password field between hidden and shown', async () => {
      const { fixture, el } = await create();
      const input = el.querySelector<HTMLInputElement>('#old-password')!;
      const toggle = el.querySelector<HTMLButtonElement>('[data-toggle-old]')!;
      expect(input.type).toBe('password');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      toggle.click();
      fixture.detectChanges();
      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    });

    it('disables the button while invalid and shows the backend messages', async () => {
      const { fixture, component, el } = await create();
      const button = el.querySelector<HTMLButtonElement>('[data-change-password]')!;
      expect(button.disabled).toBe(true);

      component.passwordForm.oldPassword().markAsTouched();
      component.passwordForm.newPassword().markAsTouched();
      fixture.detectChanges();
      expect(text(el, '[data-old-password-error]')).toBe('Old password is required.');
      expect(text(el, '[data-new-password-error]')).toBe('New password is required.');

      fill(component, fixture, 'OldPass123', 'Ab1');
      expect(text(el, '[data-new-password-error]')).toBe('New password must be at least 8 characters.');

      fill(component, fixture, 'OldPass123', 'alllowercase1');
      expect(text(el, '[data-new-password-error]')).toBe(
        'Password must contain uppercase, lowercase, and a digit.',
      );

      fill(component, fixture, 'OldPass123', 'OldPass123');
      expect(text(el, '[data-new-password-error]')).toBe('New password must differ from old password.');

      component.passwordForm.confirmPassword().markAsTouched();
      fill(component, fixture, 'OldPass123', 'NewPass123', 'Different123');
      expect(text(el, '[data-confirm-error]')).toBe('The passwords do not match.');
      expect(button.disabled).toBe(true);

      fill(component, fixture);
      expect(button.disabled).toBe(false);
    });

    it('success: clears the form, ends the session and goes to /login with the changed notice key', async () => {
      const { fixture, component } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);

      const req = httpMock.expectOne(PASSWORD_URL);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ oldPassword: 'OldPass123', newPassword: 'NewPass123' });
      req.flush(envelope({}, 'Password changed successfully.'));
      await done;

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      const logout = httpMock.expectOne(LOGOUT_URL);
      expect(logout.request.body).toEqual({ refreshToken: 'refresh-1' });
      logout.flush(envelope({}));
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', {
        state: { loginNotice: 'password-changed' },
      });
      expect(component.passwordForm.oldPassword().value()).toBe('');
      expect(component.passwordForm.newPassword().value()).toBe('');
      expect(component.passwordForm.confirmPassword().value()).toBe('');
    });

    it('a 401 with a message is an old password field error and keeps the session', async () => {
      const { fixture, component, el } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);
      httpMock.expectOne(PASSWORD_URL).flush(
        { success: false, message: 'Old password is incorrect.', data: null, errors: null },
        { status: 401, statusText: 'Unauthorized' },
      );
      await done;
      fixture.detectChanges();

      expect(text(el, '[data-old-password-error]')).toBe('Old password is incorrect.');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(component.passwordForm.newPassword().value()).toBe('NewPass123');
    });

    it('a 401 with an empty body clears the session and goes to /login', async () => {
      const { fixture, component } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);
      httpMock.expectOne(PASSWORD_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
      await done;

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('maps a 422 to the old and new password fields', async () => {
      const { fixture, component, el } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);
      httpMock.expectOne(PASSWORD_URL).flush(
        {
          success: false,
          message: 'Validation failed.',
          data: null,
          errors: {
            OldPassword: ['Old password is required.'],
            NewPassword: ['New password must differ from old password.'],
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await done;
      fixture.detectChanges();
      expect(text(el, '[data-old-password-error]')).toBe('Old password is required.');
      expect(text(el, '[data-new-password-error]')).toBe('New password must differ from old password.');
    });

    it('shows a calm notice on a 429 and keeps the session', async () => {
      const { fixture, component, el } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);
      httpMock.expectOne(PASSWORD_URL).flush(null, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '9' },
      });
      await done;
      fixture.detectChanges();
      expect(text(el, '[data-password-rate-limited]')).toContain('9 seconds');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    });

    it('shows a retryable error for other failures', async () => {
      const { fixture, component, el } = await create();
      fill(component, fixture);
      const done = submit(component.passwordForm);
      httpMock.expectOne(PASSWORD_URL).flush(null, { status: 500, statusText: 'Server Error' });
      await done;
      fixture.detectChanges();
      expect(text(el, '[data-password-error]')).toContain('Please try again');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    });
  });
});
