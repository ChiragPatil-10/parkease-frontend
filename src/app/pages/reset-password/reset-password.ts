import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  FormRoot,
  form,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import {
  GENERIC_ERROR,
  PASSWORD_COMPLEXITY_PATTERN,
  PASSWORD_HINT,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  rateLimitNotice,
  serverFieldErrors,
  serverMessage,
} from '../../shared/auth-form';
import { LOGIN_NOTICE_STATE } from '../../shared/login-notice';

export const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired.';

@Component({
  selector: 'app-reset-password',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly statusRegion = viewChild<ElementRef<HTMLElement>>('statusRegion');

  protected readonly hint = PASSWORD_HINT;
  protected readonly invalidLinkMessage = INVALID_LINK_MESSAGE;

  /** Read once from the query string and kept only here, never logged or shown. */
  private readonly token: string | null;

  /** True when there is no token, or the server said it is invalid, expired or used. */
  protected readonly invalidLink = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly passwordServerError = signal<string | null>(null);
  protected readonly rateLimited = signal<string | null>(null);
  protected readonly showNew = signal(false);
  protected readonly showConfirm = signal(false);

  private readonly model = signal({ newPassword: '', confirmPassword: '' });

  protected readonly resetForm = form(
    this.model,
    (path) => {
      required(path.newPassword, { message: PASSWORD_MESSAGES.newRequired });
      minLength(path.newPassword, PASSWORD_MIN_LENGTH, { message: PASSWORD_MESSAGES.tooShort });
      pattern(path.newPassword, PASSWORD_COMPLEXITY_PATTERN, {
        message: PASSWORD_MESSAGES.complexity,
      });

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
          if (!this.token) {
            this.invalidLink.set(true);
            return undefined;
          }
          this.serverError.set(null);
          this.passwordServerError.set(null);
          this.rateLimited.set(null);

          try {
            await firstValueFrom(
              this.authService.resetPassword({
                token: this.token,
                newPassword: this.model().newPassword,
              }),
            );
            this.finish();
          } catch (err) {
            this.handleError(err);
            this.focusStatus();
          }
          return undefined;
        },
        onInvalid: (root) => {
          root().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') || null;
    if (this.token) {
      // Take the token out of the address bar and history. A reload then shows the invalid link state.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else {
      this.invalidLink.set(true);
    }
  }

  protected toggleNew(): void {
    this.showNew.update((shown) => !shown);
  }

  protected toggleConfirm(): void {
    this.showConfirm.update((shown) => !shown);
  }

  /** Success: drop any session on this browser, then show the message on the login page. */
  private finish(): void {
    if (this.authService.getSession()) {
      this.authService.logout();
    }
    void this.router.navigateByUrl('/login', { state: { [LOGIN_NOTICE_STATE]: 'password-reset' } });
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        // The global toast also shows; this calm notice stays on the page.
        this.rateLimited.set(rateLimitNotice(err));
        return;
      }
      if (err.status === 400) {
        this.markInvalid();
        return;
      }
      if (err.status === 422) {
        const fieldErrors = serverFieldErrors(err);
        if (fieldErrors['token']) {
          this.markInvalid();
          return;
        }
        const message = fieldErrors['newpassword'];
        if (message) {
          this.passwordServerError.set(message);
          return;
        }
        this.serverError.set(serverMessage(err) ?? GENERIC_ERROR);
        return;
      }
    }
    this.serverError.set("We couldn't reset your password. Please try again.");
  }

  private markInvalid(): void {
    this.invalidLink.set(true);
    this.model.set({ newPassword: '', confirmPassword: '' });
  }

  private focusStatus(): void {
    afterNextRender(() => this.statusRegion()?.nativeElement.focus(), { injector: this.injector });
  }
}
