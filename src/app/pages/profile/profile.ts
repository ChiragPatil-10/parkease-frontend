import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import { AuthUser } from '../../models/auth/user.model';
import { UserRole } from '../../models/auth/user-role.enum';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { ToastService } from '../../shared/components/toast/toast.service';
import {
  GENERIC_ERROR,
  PASSWORD_COMPLEXITY_PATTERN,
  PASSWORD_HINT,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  PHONE_PATTERN,
  rateLimitNotice,
  serverFieldErrors,
  serverMessage,
} from '../../shared/auth-form';
import { LOGIN_NOTICE_STATE } from '../../shared/login-notice';
import { LoadRetry } from '../../shared/components/load-retry/load-retry';

export const PROFILE_SAVED_MESSAGE = 'Profile updated.';
export const PROFILE_SAVE_FAILED_MESSAGE = "Couldn't save your profile. Please try again.";
export const PROFILE_LOAD_FAILED_MESSAGE = "Couldn't load your profile. Please try again.";
export const PASSWORD_FAILED_MESSAGE = "Couldn't change your password. Please try again.";

@Component({
  selector: 'app-profile',
  imports: [FormField, FormRoot, DriverNav, ManagerNav, AdminNav, LoadRetry],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly profileStatus = viewChild<ElementRef<HTMLElement>>('profileStatus');
  private readonly passwordStatus = viewChild<ElementRef<HTMLElement>>('passwordStatus');

  protected readonly Role = UserRole;
  protected readonly role = this.authService.getCurrentUser()?.role ?? null;
  protected readonly passwordHint = PASSWORD_HINT;

  // Loading
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loadRateLimited = signal(false);
  protected readonly profile = signal<AuthUser | null>(null);

  // Profile section
  protected readonly savedValues = signal({ fullName: '', phone: '' });
  protected readonly profileRateLimited = signal<string | null>(null);
  protected readonly profileError = signal<string | null>(null);
  protected readonly fullNameServerError = signal<string | null>(null);
  protected readonly phoneServerError = signal<string | null>(null);

  // Password section
  protected readonly passwordRateLimited = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly oldPasswordServerError = signal<string | null>(null);
  protected readonly newPasswordServerError = signal<string | null>(null);
  protected readonly showOld = signal(false);
  protected readonly showNew = signal(false);
  protected readonly showConfirm = signal(false);

  private readonly profileModel = signal({ fullName: '', phone: '' });
  private readonly passwordModel = signal({ oldPassword: '', newPassword: '', confirmPassword: '' });

  protected readonly unchanged = computed(() => {
    const current = this.profileModel();
    const saved = this.savedValues();
    return current.fullName.trim() === saved.fullName && current.phone.trim() === saved.phone;
  });

  protected readonly profileForm = form(
    this.profileModel,
    (path) => {
      validate(path.fullName, (ctx) =>
        ctx.value().trim() ? undefined : { kind: 'required', message: 'Full name is required.' },
      );
      maxLength(path.fullName, 100, { message: 'Full name must not exceed 100 characters.' });

      // Length first, so a number that is too long reads "too long" rather than "digits only".
      maxLength(path.phone, 20, { message: 'Phone must not exceed 20 characters.' });
      pattern(path.phone, PHONE_PATTERN, {
        message: 'Phone can contain digits, spaces, + or - only.',
        when: (ctx) => ctx.value().trim().length > 0,
      });
    },
    {
      submission: {
        action: async () => {
          this.profileError.set(null);
          this.profileRateLimited.set(null);
          this.fullNameServerError.set(null);
          this.phoneServerError.set(null);

          const { fullName, phone } = this.profileModel();
          // The phone is always a string: the typed value, or "" to clear it. Never null.
          // profilePicUrl is left out so the stored value is kept.
          try {
            const response = await firstValueFrom(
              this.authService.updateProfile({ fullName: fullName.trim(), phone: phone.trim() }),
            );
            if (response.data) {
              this.applyProfile(response.data);
              this.authService.updateSessionUser({
                fullName: response.data.fullName,
                profilePicUrl: response.data.profilePicUrl ?? null,
                phone: response.data.phone ?? null,
              });
            }
            this.toast.show(PROFILE_SAVED_MESSAGE);
          } catch (err) {
            this.handleProfileError(err);
          }
          this.focus(this.profileStatus);
          return undefined;
        },
        onInvalid: (root) => {
          root().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  protected readonly passwordForm = form(
    this.passwordModel,
    (path) => {
      required(path.oldPassword, { message: PASSWORD_MESSAGES.oldRequired });

      required(path.newPassword, { message: PASSWORD_MESSAGES.newRequired });
      minLength(path.newPassword, PASSWORD_MIN_LENGTH, { message: PASSWORD_MESSAGES.tooShort });
      pattern(path.newPassword, PASSWORD_COMPLEXITY_PATTERN, {
        message: PASSWORD_MESSAGES.complexity,
      });
      validate(path.newPassword, (ctx) =>
        ctx.value() && ctx.value() === ctx.valueOf(path.oldPassword)
          ? { kind: 'same-as-old', message: PASSWORD_MESSAGES.sameAsOld }
          : undefined,
      );

      required(path.confirmPassword, { message: PASSWORD_MESSAGES.confirmRequired });
      validate(path.confirmPassword, (ctx) =>
        ctx.value() && ctx.value() !== ctx.valueOf(path.newPassword)
          ? { kind: 'mismatch', message: PASSWORD_MESSAGES.mismatch }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          this.passwordError.set(null);
          this.passwordRateLimited.set(null);
          this.oldPasswordServerError.set(null);
          this.newPasswordServerError.set(null);

          const { oldPassword, newPassword } = this.passwordModel();
          try {
            await firstValueFrom(this.authService.changePassword({ oldPassword, newPassword }));
            this.finishPasswordChange();
          } catch (err) {
            this.handlePasswordError(err);
            this.focus(this.passwordStatus);
          }
          return undefined;
        },
        onInvalid: (root) => {
          root().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  ngOnInit(): void {
    void this.load();
  }

  protected retryLoad(): void {
    void this.load();
  }

  protected toggleOld(): void {
    this.showOld.update((shown) => !shown);
  }

  protected toggleNew(): void {
    this.showNew.update((shown) => !shown);
  }

  protected toggleConfirm(): void {
    this.showConfirm.update((shown) => !shown);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.loadRateLimited.set(false);

    try {
      const response = await firstValueFrom(this.authService.getProfile());
      if (response.data) {
        this.applyProfile(response.data);
      } else {
        this.loadError.set(PROFILE_LOAD_FAILED_MESSAGE);
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          this.authService.clearSession();
          void this.router.navigateByUrl('/login');
          return;
        }
        if (err.status === 429) {
          this.loadRateLimited.set(true);
          return;
        }
      }
      this.loadError.set(PROFILE_LOAD_FAILED_MESSAGE);
    } finally {
      this.loading.set(false);
    }
  }

  /** Puts the server copy of the profile into the page and the form, and marks it as saved. */
  private applyProfile(user: AuthUser): void {
    const values = { fullName: user.fullName ?? '', phone: user.phone ?? '' };
    this.profile.set(user);
    this.savedValues.set({ fullName: values.fullName.trim(), phone: values.phone.trim() });
    this.profileModel.set(values);
  }

  private handleProfileError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return;
      }
      if (err.status === 429) {
        // The global toast also shows; this calm notice stays next to the form.
        this.profileRateLimited.set(rateLimitNotice(err));
        return;
      }
      if (err.status === 422) {
        const fieldErrors = serverFieldErrors(err);
        this.fullNameServerError.set(fieldErrors['fullname'] ?? null);
        this.phoneServerError.set(fieldErrors['phone'] ?? null);
        if (fieldErrors['fullname'] || fieldErrors['phone']) {
          return;
        }
        this.profileError.set(serverMessage(err) ?? GENERIC_ERROR);
        this.toast.show(PROFILE_SAVE_FAILED_MESSAGE);
        return;
      }
    }
    this.profileError.set(PROFILE_SAVE_FAILED_MESSAGE);
    this.toast.show(PROFILE_SAVE_FAILED_MESSAGE);
  }

  /** Every device must sign in again, so end this session and show the message on the login page. */
  private finishPasswordChange(): void {
    this.passwordModel.set({ oldPassword: '', newPassword: '', confirmPassword: '' });
    this.authService.logout();
    void this.router.navigateByUrl('/login', {
      state: { [LOGIN_NOTICE_STATE]: 'password-changed' },
    });
  }

  private handlePasswordError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        const message = serverMessage(err);
        if (message) {
          // A wrong old password is not an expired session: keep the session and show it on the field.
          this.oldPasswordServerError.set(message);
          return;
        }
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return;
      }
      if (err.status === 429) {
        this.passwordRateLimited.set(rateLimitNotice(err));
        return;
      }
      if (err.status === 422) {
        const fieldErrors = serverFieldErrors(err);
        this.oldPasswordServerError.set(fieldErrors['oldpassword'] ?? null);
        this.newPasswordServerError.set(fieldErrors['newpassword'] ?? null);
        if (fieldErrors['oldpassword'] || fieldErrors['newpassword']) {
          return;
        }
        this.passwordError.set(serverMessage(err) ?? GENERIC_ERROR);
        return;
      }
    }
    this.passwordError.set(PASSWORD_FAILED_MESSAGE);
  }

  private focus(region: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => region()?.nativeElement.focus(), { injector: this.injector });
  }
}
